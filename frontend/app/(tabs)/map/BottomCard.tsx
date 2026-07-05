import React, { useState, useRef } from 'react';
import { Text, View, ActivityIndicator, Alert, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, UnauthorizedError } from '../../../utils/api';
import { Colors } from '../../../constants/theme';
import AvatarCircle from '../../../components/AvatarCircle';
import { DirectionsButton } from '../../../components/DirectionsButton';
import type { MapItem, Participant } from '../../../types';
import { API } from '../../../constants/endpoints';
import { ROUTES } from '../../../constants/routes';

export function BottomCard({ court, userId, token, onJoined }: {
  court: MapItem;
  userId?: number;
  token: string | null;
  onJoined: (newCount: number) => void;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isOwnGame  = court.isLocalGame && court.host_id === userId;
  const [isJoined, setIsJoined] = useState(!!court.is_joined);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const participantCount = court.participant_count ?? 0;
  const isFull = court.max_players != null && participantCount >= court.max_players - 1;
  const displayCount = participantCount + 1;
  const playersLabel = court.max_players
    ? `${displayCount} / ${court.max_players} players`
    : `${displayCount} player${displayCount !== 1 ? 's' : ''}`;

  React.useEffect(() => {
    if (!court.isLocalGame || !court.id || !token) return;
    apiFetch(API.gameParticipants(court.id), { token })
      .then(r => r.json())
      .then(d => { if (d.success) setParticipants(d.participants); })
      .catch(() => {});
  }, [court.id]);

  React.useEffect(() => () => { scaleAnim.stopAnimation(); }, []);

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    if (!court.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    setJoining(true);
    try {
      const res = await apiFetch(API.gameJoin(court.id), { method: 'POST', token });
      const data = await res.json();
      if (!data.success) {
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      springBack();
      if (data.waitlisted) {
        setIsWaitlisted(true);
        Alert.alert("You're on the waitlist!", `You're #${data.waitlist_position} in line.`);
      } else {
        setIsJoined(true);
        onJoined(data.participant_count);
        Alert.alert("You're in! 🎉", 'Game added to My Schedule.');
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      springBack();
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setJoining(false);
    }
  };

  const spotsLeft = court.max_players != null
    ? (court.max_players - 1) - participantCount
    : null;

  return (
    <View style={styles.bottomCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{court.name}</Text>
          <View style={styles.cardBadgeRow}>
            <Text style={styles.sportBadgeText}>{court.sport_type?.toUpperCase()}</Text>
            {spotsLeft !== null && spotsLeft <= 2 && spotsLeft > 0 && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>Only {spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left!</Text>
              </View>
            )}
          </View>
        </View>
        {court.isLocalGame ? (
          <View style={styles.levelBadge}>
            <Ionicons name="flash" size={13} color={Colors.blue} />
            <Text style={styles.levelBadgeText}>Lv.{court.rating}</Text>
          </View>
        ) : (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color={Colors.yellow} />
            <Text style={styles.ratingText}>{court.rating}</Text>
          </View>
        )}
      </View>

      {court.vicinity ? <Text style={styles.cardAddress}>{court.vicinity}</Text> : null}

      {court.isLocalGame && (
        <View style={styles.playersRow}>
          <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.playersText}>{playersLabel}</Text>
        </View>
      )}

      {court.isLocalGame && participants.length > 0 && (
        <View style={styles.participantsRow}>
          <View style={styles.participantAvatars}>
            {participants.slice(0, 5).map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.avatarMiniWrap, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
                onPress={() => router.push({ pathname: ROUTES.PLAYER_PROFILE as any, params: { userId: String(p.id) } })}
              >
                <AvatarCircle username={p.username} avatar={p.avatar} size={30} />
              </TouchableOpacity>
            ))}
            {participants.length > 5 && (
              <View style={[styles.avatarMiniWrap, styles.avatarMiniMore, { marginLeft: -10 }]}>
                <Text style={styles.avatarMiniMoreText}>+{participants.length - 5}</Text>
              </View>
            )}
          </View>
          {participants[0] && (
            <Text style={styles.participantLabel} numberOfLines={1}>
              {participants[0].role === 'host' ? `${participants[0].username} (host)` : participants[0].username}
              {participants.length > 1 ? ` & ${participants.length - 1} more` : ''}
            </Text>
          )}
        </View>
      )}

      {court.isLocalGame ? (
        isOwnGame ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.surface, flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
            <Text style={[styles.joinButtonText, { color: Colors.accent }]}>Your Game</Text>
          </View>
        ) : isWaitlisted ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.warning + '22', borderWidth: 1.5, borderColor: Colors.warningBorder, flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={[styles.joinButtonText, { color: Colors.warning }]}>On Waitlist</Text>
          </View>
        ) : isJoined ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.accentFaint, borderWidth: 1.5, borderColor: Colors.accentBorder, flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
            <Text style={[styles.joinButtonText, { color: Colors.accent }]}>Joined</Text>
          </View>
        ) : isFull ? (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: Colors.warning + '22', borderWidth: 1.5, borderColor: Colors.warningBorder, flexDirection: 'row', gap: 6 }]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color={Colors.warning} />
                : <>
                    <Ionicons name="time-outline" size={18} color={Colors.warning} />
                    <Text style={[styles.joinButtonText, { color: Colors.warning }]}>Join Waitlist</Text>
                  </>}
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={joining}>
              {joining
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={styles.joinButtonText}>Join Game</Text>}
            </TouchableOpacity>
          </Animated.View>
        )
      ) : (
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: Colors.surface, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
          onPress={() => router.push({
            pathname: ROUTES.COURT_DETAIL as any,
            params: {
              placeId: court.place_id,
              name: court.name,
              sport: court.sport_type ?? '',
              vicinity: court.vicinity ?? '',
            },
          })}
        >
          <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
          <Text style={[styles.joinButtonText, { color: Colors.accent }]}>View Details</Text>
        </TouchableOpacity>
      )}
      <DirectionsButton
        lat={court.geometry.location.lat}
        lng={court.geometry.location.lng}
        label={court.name}
        style={[styles.joinButton, { marginTop: 8, backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.border }]}
        textStyle={[styles.joinButtonText, { color: Colors.text }]}
        iconColor={Colors.text}
        iconSize={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.bg },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  sportBadgeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  urgentBadge: { backgroundColor: Colors.errorFaint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.errorBorder },
  urgentBadgeText: { color: Colors.error, fontSize: 11, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.lightRatingBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, height: 25 },
  ratingText: { fontSize: 14, fontWeight: '700', marginLeft: 4, color: Colors.lightRatingText },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.blueFaint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, height: 25 },
  levelBadgeText: { fontSize: 14, fontWeight: '700', color: Colors.blue },
  cardAddress: { fontSize: 14, color: Colors.textMuted, marginBottom: 10, lineHeight: 22 },
  playersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  playersText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  participantAvatars: { flexDirection: 'row', alignItems: 'center' },
  avatarMiniWrap: {},
  avatarMiniMore: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface2, borderColor: Colors.textMuted },
  avatarMiniMoreText: { color: Colors.textSub, fontSize: 10, fontWeight: '800' },
  participantLabel: { flex: 1, fontSize: 12, color: Colors.textMuted },
  joinButton: { backgroundColor: Colors.accent, paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  joinButtonText: { fontSize: 16, fontWeight: 'bold', color: Colors.bg },
});
