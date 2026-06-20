import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { isPastGame } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../../constants/sports';
import { Colors, Spacing, Radius, Type, Shadow } from '../../constants/theme';
import { GamesSkeleton } from '../../components/SkeletonLoader';
import { API } from '../../constants/endpoints';
import { ROUTES } from '../../constants/routes';
import { isOutdoorSport, fetchWeatherForGame, WeatherResult } from '../../utils/weather';
import { Springs } from '../../constants/motion';
import type { Game } from '../../types';

function isWithinCheckinWindow(scheduledTime: string | null): boolean {
  if (!scheduledTime) return false;
  const scheduled = new Date(scheduledTime.replace(' ', 'T') + ':00');
  const now = new Date();
  const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
  return diffMin >= -30 && diffMin <= 30;
}

function AnimatedSectionHeader({ title, style }: { title: string; style?: any }) {
  const translateX = useSharedValue(-20);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(0, Springs.bouncy);
    opacity.value    = withTiming(1, { duration: 250 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Text style={styles.sectionHeader}>{title}</Text>
    </Animated.View>
  );
}

function PulsingBadge({ children, style }: { children: React.ReactNode; style?: any }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1500 }),
        withTiming(1.0, { duration: 1500 }),
      ),
      -1,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

function StaggeredCard({ index, children }: { index: number; children: React.ReactNode }) {
  const translateY = useSharedValue(20);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    const delay = Math.min(index * 60, 400);
    translateY.value = withDelay(delay, withSpring(0, Springs.bouncy));
    opacity.value    = withDelay(delay, withTiming(1, { duration: 250 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

function MyGameCard({
  game, token, onRatePlayers, onViewResults, onCloseGame, onEdit, onDelete, onLeave, onChat, onViewParticipants, onPhotoAdded,
}: {
  game: Game;
  token: string | null;
  onRatePlayers: () => void;
  onViewResults: () => void;
  onCloseGame: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onChat: () => void;
  onViewParticipants: () => void;
  onPhotoAdded?: (gameId: number, photo: string) => void;
}) {
  const color        = SPORT_COLORS[game.sport_type] ?? Colors.accent;
  const icon         = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  const displayCount = game.participant_count + 1;
  const playersLabel = game.max_players
    ? `${displayCount}/${game.max_players} players`
    : `${displayCount} player${displayCount !== 1 ? 's' : ''}`;
  const past = isPastGame(game.scheduled_time);

  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [boostedAt, setBoostedAt] = useState(game.boosted_at ?? null);
  const [checkedIn, setCheckedIn] = useState(game.checked_in ?? false);

  useEffect(() => {
    if (!past && isOutdoorSport(game.sport_type) && game.latitude && game.longitude && game.scheduled_time) {
      fetchWeatherForGame(game.id, game.latitude, game.longitude, game.scheduled_time).then(setWeather);
    }
  }, [game.id]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res  = await apiFetch(API.gameCheckin(game.id), { method: 'POST', token });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      setCheckedIn(true);
      Alert.alert('Checked In!', "You've been checked in.");
    } catch (err: any) {
      if (err?.name === 'UnauthorizedError') return;
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const res  = await apiFetch(API.gameBoost(game.id), { method: 'POST', token });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      setBoostedAt(new Date().toISOString());
      Alert.alert('Boosted!', 'Nearby players with this sport will be notified!');
    } catch (err: any) {
      if (err?.name === 'UnauthorizedError') return;
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setBoosting(false);
    }
  };

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    const base64 = result.assets[0].base64;
    try {
      const res  = await apiFetch(API.gamePostPhoto(game.id), {
        method: 'PUT', token, body: JSON.stringify({ photo: base64 }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      onPhotoAdded?.(game.id, base64);
      Alert.alert('Photo Added!', 'Post-game memory saved.');
    } catch (err: any) {
      if (err?.name === 'UnauthorizedError') return;
      Alert.alert('Error', 'Could not upload photo');
    }
  };

  return (
    <View style={[styles.card, Shadow.card]}>
      {/* Sport color accent bar */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <View style={styles.cardInner}>
        {/* Left: icon */}
        <View style={[styles.iconCircle, { backgroundColor: color + '18', borderColor: color + '55' }]}>
          <MaterialCommunityIcons name={icon as any} size={26} color={color} />
        </View>

        {/* Right: content */}
        <View style={styles.cardBody}>
          {/* Top row: sport label + badge */}
          <View style={styles.cardTopRow}>
            <Text style={[styles.sportLabel, { color }]}>
              {game.sport_type.toUpperCase()}
            </Text>
            {game.participant_status === 'waitlist' ? (
              <View style={[styles.badge, styles.badgeWaitlist]}>
                <Text style={[styles.badgeText, { color: Colors.warning }]}>
                  WAITLIST{game.waitlist_position ? ` #${game.waitlist_position}` : ''}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, game.is_host ? styles.badgeHost : styles.badgeJoined]}>
                <Text style={[styles.badgeText, { color: game.is_host ? Colors.accent : Colors.orange }]}>
                  {game.is_host ? 'HOST' : 'JOINED'}
                </Text>
              </View>
            )}
            {game.recurrence && game.recurrence !== 'none' && (
              <View style={styles.badgeRecurring}>
                <Ionicons name="repeat-outline" size={10} color={Colors.blue} />
                <Text style={styles.badgeRecurringText}>
                  {game.recurrence === 'weekly' ? 'WEEKLY' : 'BI-WEEKLY'}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          {game.title ? (
            <Text style={styles.cardTitle}>{game.title}</Text>
          ) : null}

          {/* Location */}
          {game.location_desc ? (
            <Text style={styles.locationText} numberOfLines={1}>{game.location_desc}</Text>
          ) : null}

          {/* Meta */}
          <View style={styles.metaRow}>
            {game.scheduled_time ? (
              !past ? (
                <PulsingBadge style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{game.scheduled_time}</Text>
                </PulsingBadge>
              ) : (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{game.scheduled_time}</Text>
                </View>
              )
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText}>{playersLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="flash-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText}>Level {game.level}</Text>
            </View>
            {weather && !past && (
              <View style={styles.metaItem}>
                <Text style={{ fontSize: 13 }}>{weather.icon}</Text>
                <Text style={styles.metaText}>{weather.tempC}° {weather.condition}</Text>
              </View>
            )}
          </View>

          {/* Actions — upcoming games */}
          {!past && (
            <View style={[styles.actionRow, { marginTop: Spacing.sm }]}>
              {game.is_host ? (
                <>
                  <TouchableOpacity style={[styles.btnIcon, { borderColor: Colors.blueBorder, backgroundColor: Colors.blueFaint }]} onPress={onChat}>
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.blue} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnIcon, { borderColor: Colors.purple + '55', backgroundColor: Colors.purple + '15' }]} onPress={onViewParticipants}>
                    <Ionicons name="people-outline" size={15} color={Colors.purple} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.btnGhost]} onPress={onChat}>
                    <Ionicons name="chatbubble-outline" size={13} color={Colors.blue} />
                    <Text style={[styles.btnGhostText, { color: Colors.blue }]}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGhost, { borderColor: Colors.purple + '55', backgroundColor: Colors.purple + '15' }]} onPress={onViewParticipants}>
                    <Ionicons name="people-outline" size={13} color={Colors.purple} />
                    <Text style={[styles.btnGhostText, { color: Colors.purple }]}>Players</Text>
                  </TouchableOpacity>
                </>
              )}
              {game.is_host ? (
                <>
                  <TouchableOpacity style={[styles.btnIcon, { borderColor: Colors.border, backgroundColor: Colors.surface2 }]} onPress={onEdit}>
                    <Ionicons name="pencil-outline" size={15} color={Colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnIcon, { borderColor: Colors.errorBorder, backgroundColor: Colors.errorFaint }]} onPress={onDelete}>
                    <Ionicons name="trash-outline" size={15} color={Colors.error} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnGhost, boostedAt
                      ? { borderColor: Colors.border, backgroundColor: Colors.surface2 }
                      : { borderColor: Colors.orange + '55', backgroundColor: Colors.orange + '15' }
                    ]}
                    onPress={handleBoost}
                    disabled={!!boostedAt || boosting}
                  >
                    <Ionicons name="rocket-outline" size={13} color={boostedAt ? Colors.textMuted : Colors.orange} />
                    <Text style={[styles.btnGhostText, { color: boostedAt ? Colors.textMuted : Colors.orange }]}>
                      {boostedAt ? 'Boosted' : 'Boost'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.btnGhost, { borderColor: Colors.orange + '55', backgroundColor: Colors.orange + '15' }]} onPress={onLeave}>
                    <Ionicons name="exit-outline" size={13} color={Colors.orange} />
                    <Text style={[styles.btnGhostText, { color: Colors.orange }]}>Leave</Text>
                  </TouchableOpacity>
                  {game.participant_status === 'joined' && isWithinCheckinWindow(game.scheduled_time) && !checkedIn && (
                    <TouchableOpacity
                      style={[styles.btnGhost, { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint }]}
                      onPress={handleCheckIn}
                      disabled={checkingIn}
                    >
                      <Ionicons name="location" size={13} color={Colors.accent} />
                      <Text style={[styles.btnGhostText, { color: Colors.accent }]}>
                        {checkingIn ? '...' : 'Check In'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {game.participant_status === 'joined' && checkedIn && (
                    <View style={[styles.btnGhost, { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint }]}>
                      <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
                      <Text style={[styles.btnGhostText, { color: Colors.accent }]}>Checked In</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Host: close & rate past active game */}
          {past && game.is_host && game.status === 'active' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={onCloseGame}>
                <Ionicons name="checkmark-circle-outline" size={15} color={Colors.bg} />
                <Text style={styles.btnPrimaryText}>Close & Rate</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Past game — rate / results (icon-only to fit all actions) */}
          {past && (!game.is_host || game.status === 'completed') && (
            <View style={styles.actionRow}>
              {game.status === 'completed' && game.is_host && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.btnIcon, { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint }]}
                onPress={onRatePlayers}
              >
                <Ionicons name="star-outline" size={16} color={Colors.accent} />
              </TouchableOpacity>
              {game.status === 'completed' && (
                <TouchableOpacity
                  style={[styles.btnIcon, { borderColor: Colors.yellow + '55', backgroundColor: Colors.yellow + '20' }]}
                  onPress={onViewResults}
                >
                  <Ionicons name="bar-chart-outline" size={16} color={Colors.yellow} />
                </TouchableOpacity>
              )}
              {game.status === 'completed' && game.is_host && !game.post_game_photo && (
                <TouchableOpacity
                  style={[styles.btnIcon, { borderColor: Colors.purple + '55', backgroundColor: Colors.purple + '15' }]}
                  onPress={handleAddPhoto}
                >
                  <Ionicons name="camera-outline" size={16} color={Colors.purple} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function GamesScreen() {
  const { token } = useAuth();
  const router    = useRouter();
  const [games, setGames]       = useState<Game[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tabOpacity = useSharedValue(0);
  const tabFadeStyle = useAnimatedStyle(() => ({ opacity: tabOpacity.value }));

  useFocusEffect(
    useCallback(() => {
      tabOpacity.value = 0;
      tabOpacity.value = withTiming(1, { duration: 180 });
    }, [])
  );

  const removeGame      = (id: number) => setGames(prev => prev.filter(g => g.id !== id));
  const markCompleted   = (id: number) =>
    setGames(prev => prev.map(g => g.id === id ? { ...g, status: 'completed' } : g));
  const handlePhotoAdded = (gameId: number, photo: string) =>
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, post_game_photo: photo } : g));

  const handleClose = (game: Game) => {
    Alert.alert(
      'Close Game',
      'Mark this game as completed and rate player attendance?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close & Rate',
          onPress: async () => {
            try {
              const res  = await apiFetch(API.gameComplete(game.id), { method: 'POST', token });
              const data = await res.json();
              if (!data.success) return Alert.alert('Error', data.message);
              markCompleted(game.id);
              router.push({
                pathname: ROUTES.RATE_PLAYERS,
                params: { gameId: game.id, sport: game.sport_type, scheduledTime: game.scheduled_time ?? '' },
              });
            } catch (err) {
              if (err instanceof UnauthorizedError) return;
              Alert.alert('Error', 'Could not connect to server');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (game: Game) => {
    Alert.alert(
      'Delete Game',
      'Are you sure? All participants will be notified and lose access to this game.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const res  = await apiFetch(API.game(game.id), { method: 'DELETE', token });
              const data = await res.json();
              if (!data.success) return Alert.alert('Error', data.message);
              removeGame(game.id);
            } catch (err) {
              if (err instanceof UnauthorizedError) return;
              Alert.alert('Error', 'Could not connect to server');
            }
          },
        },
      ]
    );
  };

  const handleLeave = (game: Game) => {
    Alert.alert(
      'Leave Game',
      `Leave this ${game.sport_type} game?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const res  = await apiFetch(API.gameLeave(game.id), { method: 'DELETE', token });
              const data = await res.json();
              if (!data.success) return Alert.alert('Error', data.message);
              removeGame(game.id);
            } catch (err) {
              if (err instanceof UnauthorizedError) return;
              Alert.alert('Error', 'Could not connect to server');
            }
          },
        },
      ]
    );
  };

  const fetchMyGames = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res  = await apiFetch(API.MY_GAMES, { token });
      const data = await res.json();
      if (data.success) setGames(data.games);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      console.error('My games fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => { fetchMyGames(); }, [fetchMyGames])
  );

  const upcoming = games.filter(g => !isPastGame(g.scheduled_time));
  const history  = games.filter(g =>  isPastGame(g.scheduled_time));

  const makeCardProps = (item: Game) => ({
    game: item,
    token,
    onPhotoAdded: handlePhotoAdded,
    onChat: () => router.push({
      pathname: ROUTES.GAME_CHAT,
      params: { id: String(item.id), name: `${sportLabel(item.sport_type)} Game` },
    }),
    onRatePlayers: () => router.push({
      pathname: ROUTES.RATE_PLAYERS,
      params: { gameId: item.id, sport: item.sport_type, scheduledTime: item.scheduled_time ?? '' },
    }),
    onViewResults: () => router.push({
      pathname: ROUTES.GAME_RESULTS as any,
      params: { gameId: String(item.id), title: item.title ?? '', sport: item.sport_type, scheduledTime: item.scheduled_time ?? '' },
    }),
    onCloseGame:       () => handleClose(item),
    onEdit: () => router.push({
      pathname: ROUTES.MODAL,
      params: {
        gameId:               String(item.id),
        existingSport:        item.sport_type,
        existingLevel:        String(item.level),
        existingTitle:        item.title          ?? '',
        existingLocationDesc: item.location_desc   ?? '',
        existingTime:         item.scheduled_time  ?? '',
        existingEquipment:    item.equipment_notes ?? '',
        existingMaxPlayers:   item.max_players != null ? String(item.max_players) : '',
        existingPhoto:        item.photo ?? '',
      },
    }),
    onDelete: () => handleDelete(item),
    onLeave:  () => handleLeave(item),
    onViewParticipants: () => router.push({
      pathname: ROUTES.GAME_PARTICIPANTS,
      params: { gameId: String(item.id), title: item.title ?? `${sportLabel(item.sport_type)} Game` },
    } as any),
  });

  return (
    <Animated.View style={[styles.container, tabFadeStyle]}>
      <Text style={styles.title}>My Schedule</Text>

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <GamesSkeleton />
        </ScrollView>
      ) : upcoming.length === 0 && history.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={42} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySub}>Go to the map and find or create a game!</Text>
          <TouchableOpacity style={styles.mapBtn} onPress={() => router.push(ROUTES.TABS as any)}>
            <Ionicons name="map-outline" size={16} color={Colors.bg} />
            <Text style={styles.mapBtnText}>Open Map</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchMyGames(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {upcoming.length > 0 && (
            <>
              <AnimatedSectionHeader title="Upcoming" />
              {upcoming.map((item, index) => (
                <StaggeredCard key={String(item.id)} index={index}>
                  <MyGameCard {...makeCardProps(item)} />
                </StaggeredCard>
              ))}
            </>
          )}
          {history.length > 0 && (
            <>
              <AnimatedSectionHeader title="History" style={upcoming.length > 0 ? { marginTop: Spacing.lg } : undefined} />
              {history.map((item, index) => (
                <StaggeredCard key={String(item.id)} index={upcoming.length + index}>
                  <MyGameCard {...makeCardProps(item)} />
                </StaggeredCard>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.xl },
  title:     { ...Type.screenTitle, color: Colors.text, marginTop: 60, marginBottom: Spacing.xl },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { paddingBottom: 30 },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    marginBottom: 12,
    overflow: 'hidden',
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 1 },
  cardInner: { flexDirection: 'row', padding: 14, paddingLeft: 18 },
  iconCircle:{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardBody:  { flex: 1 },

  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sportLabel:  { ...Type.cardSport },
  badge:       { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.sm },
  badgeHost:     { backgroundColor: Colors.accentFaint },
  badgeJoined:   { backgroundColor: Colors.orange + '22' },
  badgeWaitlist: { backgroundColor: Colors.warning + '22' },
  badgeText:   { fontSize: 10, fontWeight: '800' },
  badgeRecurring:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.blueFaint, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  badgeRecurringText: { fontSize: 9, fontWeight: '800', color: Colors.blue },

  cardTitle:    { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  locationText: { fontSize: 13, color: Colors.textSub, marginBottom: 6 },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Type.meta, color: Colors.textMuted },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },

  btnGhost:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 32, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.blueBorder, backgroundColor: Colors.blueFaint, paddingHorizontal: 10 },
  btnGhostText: { fontWeight: '700', fontSize: 12, color: Colors.blue },
  btnIcon:      { width: 32, height: 32, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  btnPrimary:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, height: 36, borderRadius: Radius.md },
  btnPrimaryText: { color: Colors.bg, fontWeight: '800', fontSize: 13 },

  btnResults: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.yellow + '20', borderWidth: 1, borderColor: Colors.yellow + '55', height: 36, borderRadius: Radius.md },

  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.successFaint, borderRadius: Radius.sm },
  completedText:  { color: Colors.accent, fontSize: 11, fontWeight: '700' },

  sectionHeader: { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: 10, marginTop: 4 },

  // Empty state
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyTitle:    { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub:      { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: Spacing.xxl },
  mapBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 13, borderRadius: Radius.pill },
  mapBtnText:    { color: Colors.bg, fontWeight: '800', fontSize: 15 },
});
