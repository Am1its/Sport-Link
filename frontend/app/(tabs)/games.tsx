import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { isPastGame } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../../constants/sports';
import { Colors, Spacing, Radius, Type, Shadow } from '../../constants/theme';
import { GamesSkeleton } from '../../components/SkeletonLoader';
import type { Game } from '../../types';

function GameCard({
  game, onRatePlayers, onViewResults, onCloseGame, onEdit, onDelete, onLeave, onChat, onViewParticipants,
}: {
  game: Game;
  onRatePlayers: () => void;
  onViewResults: () => void;
  onCloseGame: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onChat: () => void;
  onViewParticipants: () => void;
}) {
  const color        = SPORT_COLORS[game.sport_type] ?? Colors.accent;
  const icon         = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  const displayCount = game.participant_count + 1;
  const playersLabel = game.max_players
    ? `${displayCount}/${game.max_players} players`
    : `${displayCount} player${displayCount !== 1 ? 's' : ''}`;
  const past = isPastGame(game.scheduled_time);

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
            <View style={[styles.badge, game.is_host ? styles.badgeHost : styles.badgeJoined]}>
              <Text style={[styles.badgeText, { color: game.is_host ? Colors.accent : Colors.orange }]}>
                {game.is_host ? 'HOST' : 'JOINED'}
              </Text>
            </View>
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
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>{game.scheduled_time}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText}>{playersLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="flash-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.metaText}>Level {game.level}</Text>
            </View>
          </View>

          {/* Actions — upcoming games */}
          {!past && (
            <View style={[styles.actionRow, { marginTop: Spacing.sm }]}>
              <TouchableOpacity style={styles.btnGhost} onPress={onChat}>
                <Ionicons name="chatbubble-outline" size={13} color={Colors.blue} />
                <Text style={[styles.btnGhostText, { color: Colors.blue }]}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnGhost, { borderColor: Colors.purple + '55', backgroundColor: Colors.purple + '15' }]} onPress={onViewParticipants}>
                <Ionicons name="people-outline" size={13} color={Colors.purple} />
                <Text style={[styles.btnGhostText, { color: Colors.purple }]}>Players</Text>
              </TouchableOpacity>
              {game.is_host ? (
                <>
                  <TouchableOpacity style={[styles.btnGhost, { borderColor: Colors.border, backgroundColor: Colors.surface2 }]} onPress={onEdit}>
                    <Ionicons name="pencil-outline" size={13} color={Colors.text} />
                    <Text style={[styles.btnGhostText, { color: Colors.text }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGhost, { borderColor: Colors.errorBorder, backgroundColor: Colors.errorFaint }]} onPress={onDelete}>
                    <Ionicons name="trash-outline" size={13} color={Colors.error} />
                    <Text style={[styles.btnGhostText, { color: Colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.btnGhost, { borderColor: Colors.orange + '55', backgroundColor: Colors.orange + '15' }]} onPress={onLeave}>
                  <Ionicons name="exit-outline" size={13} color={Colors.orange} />
                  <Text style={[styles.btnGhostText, { color: Colors.orange }]}>Leave</Text>
                </TouchableOpacity>
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

          {/* Past game — rate / results */}
          {past && (!game.is_host || game.status === 'completed') && (
            <View style={styles.actionRow}>
              {game.status === 'completed' && game.is_host && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
              <TouchableOpacity style={styles.btnPrimary} onPress={onRatePlayers}>
                <Ionicons name="star-outline" size={15} color={Colors.bg} />
                <Text style={styles.btnPrimaryText}>Rate Players</Text>
              </TouchableOpacity>
              {game.status === 'completed' && (
                <TouchableOpacity style={styles.btnResults} onPress={onViewResults}>
                  <Ionicons name="bar-chart-outline" size={15} color={Colors.yellow} />
                  <Text style={[styles.btnGhostText, { color: Colors.yellow }]}>Results</Text>
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

  const removeGame    = (id: number) => setGames(prev => prev.filter(g => g.id !== id));
  const markCompleted = (id: number) =>
    setGames(prev => prev.map(g => g.id === id ? { ...g, status: 'completed' } : g));

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
              const res  = await apiFetch(`/api/games/${game.id}/complete`, { method: 'POST', token });
              const data = await res.json();
              if (!data.success) return Alert.alert('Error', data.message);
              markCompleted(game.id);
              router.push({
                pathname: '/rate-players',
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
            try {
              const res  = await apiFetch(`/api/games/${game.id}`, { method: 'DELETE', token });
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
            try {
              const res  = await apiFetch(`/api/games/${game.id}/leave`, { method: 'DELETE', token });
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
      const res  = await apiFetch('/api/games/mine', { token });
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
    onChat: () => router.push({
      pathname: '/game-chat',
      params: { id: String(item.id), name: `${sportLabel(item.sport_type)} Game` },
    }),
    onRatePlayers: () => router.push({
      pathname: '/rate-players',
      params: { gameId: item.id, sport: item.sport_type, scheduledTime: item.scheduled_time ?? '' },
    }),
    onViewResults: () => router.push({
      pathname: '/game-results' as any,
      params: { gameId: String(item.id), title: item.title ?? '', sport: item.sport_type, scheduledTime: item.scheduled_time ?? '' },
    }),
    onCloseGame:       () => handleClose(item),
    onEdit: () => router.push({
      pathname: '/modal',
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
      pathname: '/game-participants',
      params: { gameId: String(item.id), title: item.title ?? `${sportLabel(item.sport_type)} Game` },
    } as any),
  });

  return (
    <View style={styles.container}>
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
          <TouchableOpacity style={styles.mapBtn} onPress={() => router.push('/(tabs)')}>
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
              <Text style={styles.sectionHeader}>Upcoming</Text>
              {upcoming.map(item => <GameCard key={String(item.id)} {...makeCardProps(item)} />)}
            </>
          )}
          {history.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, upcoming.length > 0 && { marginTop: Spacing.lg }]}>History</Text>
              {history.map(item => <GameCard key={String(item.id)} {...makeCardProps(item)} />)}
            </>
          )}
        </ScrollView>
      )}
    </View>
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
  badgeHost:   { backgroundColor: Colors.accentFaint },
  badgeJoined: { backgroundColor: Colors.orange + '22' },
  badgeText:   { fontSize: 10, fontWeight: '800' },

  cardTitle:    { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  locationText: { fontSize: 13, color: Colors.textSub, marginBottom: 6 },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Type.meta, color: Colors.textMuted },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md, flexWrap: 'wrap' },

  btnGhost:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 32, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.blueBorder, backgroundColor: Colors.blueFaint, paddingHorizontal: 10 },
  btnGhostText: { fontWeight: '700', fontSize: 12, color: Colors.blue },

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
