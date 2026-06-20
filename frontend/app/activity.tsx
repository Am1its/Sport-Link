import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../constants/sports';
import { getAvatarColor } from '../utils/avatar';
import { Colors, Spacing, Radius, Shadow, Type } from '../constants/theme';
import { API } from '../constants/endpoints';
import { ROUTES } from '../constants/routes';

type Activity = {
  type: 'joined' | 'created';
  actor_id: number;
  actor_username: string;
  actor_avatar: string | null;
  game_id: number;
  sport_type: string;
  title: string | null;
  location_desc: string | null;
  latitude: number;
  longitude: number;
  scheduled_time: string | null;
  happened_at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ActivityCard({ item, onPress, onPressActor }: {
  item: Activity;
  onPress: () => void;
  onPressActor: () => void;
}) {
  const color      = SPORT_COLORS[item.sport_type] ?? Colors.accent;
  const icon       = SPORT_ICONS[item.sport_type]  ?? 'map-marker';
  const avatarColor = getAvatarColor(item.actor_username);
  const gameTitle  = item.title || `${sportLabel(item.sport_type)} Game`;

  const verb = item.type === 'joined' ? 'joined' : 'created';
  const verbColor = item.type === 'joined' ? Colors.accent : Colors.blue;

  return (
    <TouchableOpacity style={[styles.card, Shadow.card]} onPress={onPress} activeOpacity={0.8}>
      {/* Sport color accent bar */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <View style={styles.cardInner}>
        {/* Avatar */}
        <TouchableOpacity onPress={onPressActor} activeOpacity={0.75}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + '22', borderColor: avatarColor }]}>
            {item.actor_avatar ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${item.actor_avatar}` }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={[styles.avatarLetter, { color: avatarColor }]}>
                {item.actor_username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Headline */}
          <Text style={styles.headline} numberOfLines={2}>
            <Text style={styles.actorName}>{item.actor_username} </Text>
            <Text style={[styles.verb, { color: verbColor }]}>{verb} </Text>
            <Text style={styles.gameTitle}>{gameTitle}</Text>
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name={icon as any} size={13} color={color} />
            <Text style={[styles.metaSport, { color }]}>{item.sport_type.toUpperCase()}</Text>
            {item.location_desc ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{item.location_desc}</Text>
              </>
            ) : null}
          </View>

          {/* Time row */}
          <View style={styles.metaRow}>
            {item.scheduled_time ? (
              <>
                <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>{item.scheduled_time}</Text>
                <Text style={styles.metaDot}>·</Text>
              </>
            ) : null}
            <Text style={styles.timeAgo}>{timeAgo(item.happened_at)}</Text>
          </View>
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res  = await apiFetch(API.ACTIVITY, { token });
      const data = await res.json();
      if (data.success) setActivities(data.activities);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchActivity(); }, [fetchActivity]));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Friend Activity</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item, i) => `${item.type}_${item.game_id}_${item.actor_id}_${i}`}
          renderItem={({ item }) => (
            <ActivityCard
              item={item}
              onPress={() => router.push({ pathname: ROUTES.GAME_DETAIL as any, params: { id: String(item.game_id) } })}
              onPressActor={() => router.push({ pathname: ROUTES.PLAYER_PROFILE as any, params: { userId: String(item.actor_id) } })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchActivity(true)} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={38} color={Colors.surface2} />
              </View>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyBody}>
                Add friends to see when they join or create games near you.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push(ROUTES.FRIENDS as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>Find Friends</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { ...Type.screenTitle, color: Colors.text },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: { width: 3 },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImage:  { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 18, fontWeight: '900' },

  content: { flex: 1, gap: 4 },

  headline:   { fontSize: 14, lineHeight: 20, color: Colors.text },
  actorName:  { fontWeight: '800', color: Colors.text },
  verb:       { fontWeight: '600' },
  gameTitle:  { color: Colors.textSub },

  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaSport: { fontSize: 11, fontWeight: '700' },
  metaDot:   { color: Colors.textMuted, fontSize: 11 },
  metaText:  { fontSize: 12, color: Colors.textMuted, flexShrink: 1 },
  timeAgo:   { fontSize: 11, color: Colors.textMuted },

  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: { ...Type.cardTitle, color: Colors.text, marginBottom: Spacing.sm },
  emptyBody:  { ...Type.body, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.xl },
  emptyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm + 2,
  },
  emptyBtnText: { ...Type.btnSmall, color: Colors.bg },
});
