import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Share, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../../constants/sports';
import { Colors, Spacing, Radius, Shadow, Type } from '../../constants/theme';
import type { Game } from '../../types';

type GameDetail = Game & { host_username: string; status: string };

export default function GameLandingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();

  const [game, setGame]       = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res  = await apiFetch(`/api/games/${id}`, { token });
        const data = await res.json();
        if (data.success) {
          setGame(data.game);
          setIsJoined(!!data.game.is_joined);
        }
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const handleJoin = async () => {
    if (!token) return router.push({ pathname: '/login', params: { redirect: `/game/${id}` } } as any);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setJoining(true);
    try {
      const res  = await apiFetch(`/api/games/${id}/join`, { method: 'POST', token });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsJoined(true);
      setGame(g => g ? { ...g, participant_count: data.participant_count } : g);
      Alert.alert("You're in!", 'Game added to My Schedule.');
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    if (!game) return;
    const label = sportLabel(game.sport_type);
    const title = game.title || `${label} Game`;
    await Share.share({
      message: `Join my ${label} game on SportLink!\n${title}${game.scheduled_time ? `\n🕒 ${game.scheduled_time}` : ''}${game.location_desc ? `\n📍 ${game.location_desc}` : ''}\n\nsportlink://game/${id}`,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.notFoundText}>Game not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const color     = SPORT_COLORS[game.sport_type] ?? Colors.accent;
  const icon      = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  const title     = game.title || `${sportLabel(game.sport_type)} Game`;
  const isOwn     = game.host_id === user?.id;
  const spotsLeft = game.max_players != null ? (game.max_players - 1) - game.participant_count : null;
  const isFull    = spotsLeft != null && spotsLeft <= 0 && !isJoined && !isOwn;

  return (
    <View style={styles.container}>
      {/* Hero band */}
      <View style={[styles.hero, { backgroundColor: color + '22' }]}>
        <View style={[styles.orb, styles.orb1, { backgroundColor: color + '30' }]} />
        <View style={[styles.orb, styles.orb2, { backgroundColor: color + '18' }]} />

        {/* Back */}
        <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={Colors.text} />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.shareCircle} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={Colors.text} />
        </TouchableOpacity>

        {/* Sport icon */}
        <View style={[styles.heroIcon, { backgroundColor: color + '28', borderColor: color + '55' }]}>
          <MaterialCommunityIcons name={icon as any} size={36} color={color} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.sportBadge, { color }]}>{game.sport_type.toUpperCase()}</Text>

        {/* Photo */}
        {game.photo ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${game.photo}` }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : null}

        {/* Info card */}
        <View style={[styles.card, Shadow.card]}>
          <Row icon="person-outline" label="Hosted by" value={game.host_username} />
          {game.scheduled_time ? <Row icon="time-outline" label="When" value={game.scheduled_time} /> : null}
          {game.location_desc  ? <Row icon="location-outline" label="Where" value={game.location_desc} /> : null}
          <Row
            icon="people-outline"
            label="Players"
            value={game.max_players
              ? `${game.participant_count + 1} / ${game.max_players}`
              : `${game.participant_count + 1} joined`}
          />
          <Row icon="flash-outline" label="Level" value={`${game.level} / 5`} />
          {game.equipment_notes ? <Row icon="bag-outline" label="Bring" value={game.equipment_notes} /> : null}
        </View>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          {(isOwn || isJoined) ? (
            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaBtnMuted]}
              onPress={() => router.push({ pathname: '/game-chat', params: { id: String(game.id), name: title } })}
            >
              <Ionicons name="chatbubble-outline" size={18} color={Colors.accent} />
              <Text style={[styles.ctaBtnText, { color: Colors.accent }]}>Open Chat</Text>
            </TouchableOpacity>
          ) : isFull ? (
            <View style={[styles.ctaBtn, styles.ctaBtnMuted]}>
              <Text style={[styles.ctaBtnText, { color: Colors.error }]}>Game Full</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: color }]}
              onPress={handleJoin}
              disabled={joining}
              activeOpacity={0.85}
            >
              {joining
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.ctaBtnTextDark}>Join Game</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  notFoundText:     { ...Type.body, color: Colors.textMuted, marginTop: Spacing.sm },
  backBtn:          { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.pill },
  backBtnText:      { ...Type.btnSmall, color: Colors.text },

  hero:        { height: 170, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: Spacing.lg },
  orb1:        { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -60, left: -40 },
  orb2:        { position: 'absolute', width: 160, height: 160, borderRadius: 80, bottom: -40, right: -20 },
  orb:         {},
  backCircle:  { position: 'absolute', top: 56, left: Spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  shareCircle: { position: 'absolute', top: 56, right: Spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  heroIcon:    { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },

  scroll:        { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.huge },

  title:      { ...Type.screenTitle, color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  sportBadge: { ...Type.label, marginBottom: Spacing.lg },

  photo: { width: '100%', height: 180, borderRadius: Radius.lg, marginBottom: Spacing.lg },

  card:     { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xl, ...Shadow.card },
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowIcon:  { marginTop: 2 },
  rowLabel: { ...Type.label, color: Colors.textMuted, width: 64 },
  rowValue: { ...Type.body, color: Colors.text, flex: 1 },

  ctaWrap:       { marginTop: Spacing.sm },
  ctaBtn:        { borderRadius: Radius.pill, height: 52, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  ctaBtnMuted:   { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.accentBorder },
  ctaBtnText:    { ...Type.btnPrimary },
  ctaBtnTextDark:{ ...Type.btnPrimary, color: '#000' },
});
