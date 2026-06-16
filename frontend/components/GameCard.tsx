import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Image, Share, Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { usePressAnimation, useSuccessBurst } from '../hooks/useAnimations';
import * as Haptics from 'expo-haptics';
import { useSound } from '../context/SoundContext';
import { Springs } from '../constants/motion';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { API_BASE } from '../constants/api';
import { API } from '../constants/endpoints';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../constants/sports';
import { Colors, Spacing, Radius, Type, Shadow } from '../constants/theme';
import type { Game } from '../types';

export function GameCard({
  game, userId, token, onJoined, onViewParticipants, onNeighborhoodPress,
}: {
  game: Game;
  userId?: number;
  token: string | null;
  onJoined: (id: number, newCount: number) => void;
  onViewParticipants: () => void;
  onNeighborhoodPress?: (neighborhood: string) => void;
}) {
  const handleShare = async () => {
    const label    = sportLabel(game.sport_type);
    const title    = game.title || `${label} Game`;
    const shareUrl = `${API_BASE}/game/${game.id}`;
    await Share.share({
      title,
      message: `Join my ${label} game on SportLink!\n${title}${game.scheduled_time ? `\n🕒 ${game.scheduled_time}` : ''}${game.location_desc ? `\n📍 ${game.location_desc}` : ''}\n\n${shareUrl}`,
      url: shareUrl,
    });
  };
  const [joining, setJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(!!game.is_joined);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const { animatedStyle: joinPressStyle, onPressIn: joinPressIn, onPressOut: joinPressOut } = usePressAnimation({
    scaleDown: 0.94,
    scaleUp: 1.08,
    stiffness: 400,
    damping: 20,
  });
  const { trigger: triggerBurst, dotStyles } = useSuccessBurst();
  const { play } = useSound();
  const fillWidth = useSharedValue(0);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value * 100}%` as any,
  }));
  const color  = SPORT_COLORS[game.sport_type] ?? '#0FEA95';
  const icon   = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  const isOwn  = game.host_id === userId;
  const spotsLeft = game.max_players != null
    ? (game.max_players - 1) - game.participant_count
    : null;
  const isFull   = spotsLeft != null && spotsLeft <= 0;
  const isUrgent = spotsLeft != null && spotsLeft <= 2 && spotsLeft > 0;
  const displayCount  = game.participant_count + 1;
  const playersLabel  = game.max_players
    ? `${displayCount}/${game.max_players}`
    : `${displayCount}`;

  const handleJoin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isFull) onJoined(game.id, game.participant_count + 1);
    setJoining(true);
    try {
      const res  = await apiFetch(API.gameJoin(game.id), { method: 'POST', token });
      const data = await res.json();
      if (!data.success) {
        if (!isFull) onJoined(game.id, game.participant_count);
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsJoined(true);
      fillWidth.value = withSpring(1, Springs.bouncy);
      play('chime');
      triggerBurst();
      if (data.waitlisted) {
        setIsWaitlisted(true);
        Alert.alert("You're on the waitlist!", `You're #${data.waitlist_position} in line.`);
      } else {
        onJoined(game.id, data.participant_count);
        Alert.alert("You're in!", 'Game added to My Schedule.');
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      if (!isFull) onJoined(game.id, game.participant_count);
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setJoining(false);
    }
  };

  const showJoinedBorder = isJoined || isOwn;

  return (
    <View style={[styles.card, Shadow.card, showJoinedBorder && styles.cardJoined]}>
      {/* Sport color accent bar */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      {/* Photo — full width at top */}
      {game.photo ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${game.photo}` }}
          style={styles.cardPhoto}
          resizeMode="cover"
        />
      ) : null}

      {/* Main content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          {/* Icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: color + '18', borderColor: color + '55' }]}>
            <MaterialCommunityIcons name={icon as any} size={24} color={color} />
          </View>

          <View style={styles.cardInfo}>
            {/* Sport label row */}
            <View style={styles.sportRow}>
              <Text style={[styles.sportLabel, { color }]}>
                {game.sport_type.toUpperCase()}
              </Text>
              {isOwn ? (
                <View style={styles.myBadge}>
                  <Ionicons name="star" size={9} color={Colors.accent} />
                  <Text style={styles.myBadgeText}>Your Game</Text>
                </View>
              ) : isWaitlisted ? (
                <View style={styles.waitlistChip}>
                  <Ionicons name="time-outline" size={10} color={Colors.warning} />
                  <Text style={styles.waitlistChipText}>Waitlist</Text>
                </View>
              ) : isJoined ? (
                <View style={styles.joinedChip}>
                  <Ionicons name="checkmark-circle" size={10} color={Colors.accent} />
                  <Text style={styles.joinedChipText}>Joined</Text>
                </View>
              ) : isUrgent ? (
                <View style={styles.urgencyBadge}>
                  <Ionicons name="flame" size={10} color={Colors.warning} />
                  <Text style={styles.urgencyText}>
                    {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Neighborhood tag */}
            {game.neighborhood ? (
              <TouchableOpacity
                style={styles.neighborhoodTag}
                onPress={() => onNeighborhoodPress?.(game.neighborhood!)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={10} color={Colors.textMuted} />
                <Text style={styles.neighborhoodText}>{game.neighborhood}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Title */}
            <Text style={styles.cardTitle} numberOfLines={1}>
              {game.title || `${sportLabel(game.sport_type)} Game`}
            </Text>

            {/* Meta row */}
            <View style={styles.metaRow}>
              {game.scheduled_time ? (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{game.scheduled_time}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.metaItem} onPress={onViewParticipants} activeOpacity={0.7}>
                <Ionicons name="people-outline" size={12} color={isUrgent ? Colors.warning : Colors.blue} />
                <Text style={[styles.metaText, { color: isUrgent ? Colors.warning : Colors.blue }]}>
                  {playersLabel} players
                </Text>
              </TouchableOpacity>
              <View style={styles.metaItem}>
                <Ionicons name="flash-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>Lv.{game.level}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Location */}
        {game.location_desc ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.locationText} numberOfLines={1}>{game.location_desc}</Text>
          </View>
        ) : null}

        {/* Equipment notes */}
        {game.equipment_notes ? (
          <View style={styles.equipRow}>
            <Ionicons name="bag-outline" size={12} color={Colors.textHint} />
            <Text style={styles.equipText} numberOfLines={1}>{game.equipment_notes}</Text>
          </View>
        ) : null}
      </View>

      {/* Join + Share row */}
      <View style={styles.joinBtnWrap}>
        {dotStyles.map((dotStyle, i) => (
          <Animated.View
            key={i}
            style={[styles.burstDot, dotStyle]}
            pointerEvents="none"
          />
        ))}
        <View style={styles.joinRow}>
          {isOwn ? (
            <View style={[styles.joinBtn, styles.joinBtnMuted]}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
              <Text style={[styles.joinBtnText, { color: Colors.accent }]}>Your Game</Text>
            </View>
          ) : isWaitlisted ? (
            <View style={[styles.joinBtn, styles.joinBtnMuted]}>
              <Ionicons name="time-outline" size={16} color={Colors.warning} />
              <Text style={[styles.joinBtnText, { color: Colors.warning }]}>On Waitlist</Text>
            </View>
          ) : isJoined ? (
            <View style={[styles.joinBtn, styles.joinBtnMuted]}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
              <Text style={[styles.joinBtnText, { color: Colors.accent }]}>Joined</Text>
            </View>
          ) : isFull ? (
            <Animated.View style={[joinPressStyle, { flex: 1 }]}>
              <Pressable style={[styles.joinBtn, styles.joinBtnWaitlist]} onPress={handleJoin} onPressIn={joinPressIn} onPressOut={joinPressOut} disabled={joining}>
                {joining
                  ? <ActivityIndicator color={Colors.warning} size="small" />
                  : <>
                      <Ionicons name="time-outline" size={16} color={Colors.warning} />
                      <Text style={[styles.joinBtnText, { color: Colors.warning }]}>Join Waitlist</Text>
                    </>}
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View style={[joinPressStyle, { flex: 1 }]}>
              <Pressable style={[styles.joinBtn, styles.joinBtnOverflow]} onPress={handleJoin} onPressIn={joinPressIn} onPressOut={joinPressOut} disabled={joining}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: Colors.accent, borderRadius: Radius.pill },
                    fillStyle,
                  ]}
                />
                {joining
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <>
                      <Text style={styles.joinBtnText}>Join Game</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.bg} />
                    </>}
              </Pressable>
            </Animated.View>
          )}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={18} color={Colors.textSub} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardJoined: { borderWidth: 1.5, borderColor: Colors.accentBorder },
  accentBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 1 },
  cardPhoto:   { width: '100%', height: 170 },
  cardContent: { padding: 14, paddingLeft: 18 },
  cardTop:     { flexDirection: 'row', gap: 12, marginBottom: Spacing.sm },
  iconCircle:  { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cardInfo:    { flex: 1 },

  sportRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sportLabel:  { ...Type.cardSport },
  joinedChip:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.accentFaint, borderRadius: 6, borderWidth: 1, borderColor: Colors.accentBorder, paddingHorizontal: 6, paddingVertical: 2 },
  joinedChipText: { color: Colors.accent, fontSize: 10, fontWeight: '800' },
  waitlistChip:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningFaint, borderRadius: 6, borderWidth: 1, borderColor: Colors.warningBorder, paddingHorizontal: 6, paddingVertical: 2 },
  waitlistChipText: { color: Colors.warning, fontSize: 10, fontWeight: '800' },
  myBadge:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.accentFaint, borderRadius: 6, borderWidth: 1, borderColor: Colors.accentBorder, paddingHorizontal: 6, paddingVertical: 2 },
  myBadgeText:    { color: Colors.accent, fontSize: 10, fontWeight: '800' },
  urgencyBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningFaint, borderRadius: 6, borderWidth: 1, borderColor: Colors.warningBorder, paddingHorizontal: 6, paddingVertical: 2 },
  urgencyText:    { color: Colors.warning, fontSize: 10, fontWeight: '800' },

  cardTitle:   { ...Type.cardTitle, color: Colors.text, marginBottom: 6 },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...Type.meta, color: Colors.textMuted },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 4 },
  locationText:{ fontSize: 13, color: Colors.textSub, flex: 1 },

  equipRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  equipText: { color: Colors.textMuted, fontSize: 12, flex: 1 },

  joinBtnWrap: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, overflow: 'hidden' },
  joinRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, height: 44, borderRadius: Radius.pill },
  joinBtnOverflow: { overflow: 'hidden' },
  joinBtnMuted:    { backgroundColor: Colors.surface2 },
  joinBtnWaitlist: { backgroundColor: Colors.warning + '22', borderWidth: 1, borderColor: Colors.warningBorder },
  joinBtnText: { color: Colors.bg, ...Type.btnPrimary },
  shareBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center' },

  neighborhoodTag:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4, alignSelf: 'flex-start' },
  neighborhoodText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  burstDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    bottom: 22,
    alignSelf: 'center',
  },
});
