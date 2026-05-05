import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { isPastGame } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS } from '../../constants/sports';

type Game = {
  id: number;
  sport_type: string;
  level: number;
  title: string | null;
  scheduled_time: string | null;
  location_desc: string | null;
  equipment_notes: string | null;
  max_players: number | null;
  participant_count: number;
  is_host: boolean;
  status: string;
  created_at: string;
};

function GameCard({
  game, onRatePlayers, onCloseGame, onEdit, onDelete, onLeave, onChat,
}: {
  game: Game;
  onRatePlayers: () => void;
  onCloseGame: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onChat: () => void;
}) {
  const color = SPORT_COLORS[game.sport_type] ?? '#0FEA95';
  const icon  = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  // Host occupies one slot; display total = participants + host
  const displayCount = game.participant_count + 1;
  const playersLabel = game.max_players
    ? `${displayCount} / ${game.max_players} players`
    : `${displayCount} player${displayCount !== 1 ? 's' : ''}`;
  const past = isPastGame(game.scheduled_time);

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color }]}>
          <MaterialCommunityIcons name={icon as any} size={28} color={color} />
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.sportLabel}>{game.sport_type.toUpperCase()}</Text>
          <View style={[styles.badge, game.is_host ? styles.badgeHost : styles.badgeJoined]}>
            <Text style={styles.badgeText}>{game.is_host ? 'HOST' : 'JOINED'}</Text>
          </View>
        </View>

        {game.title ? (
          <Text style={styles.gameTitle}>{game.title}</Text>
        ) : null}

        {game.location_desc ? (
          <Text style={styles.locationText}>{game.location_desc}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          {game.scheduled_time ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#8E8E93" />
              <Text style={styles.metaText}>{game.scheduled_time}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color="#8E8E93" />
            <Text style={styles.metaText}>{playersLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="flash-outline" size={14} color="#8E8E93" />
            <Text style={styles.metaText}>Level {game.level}</Text>
          </View>
        </View>

        {!past && (
          <View style={[styles.actionRow, { marginTop: 10 }]}>
            <TouchableOpacity style={styles.chatBtn} onPress={onChat}>
              <Ionicons name="chatbubble-outline" size={14} color="#4F9EFF" />
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>
            {game.is_host ? (
              <>
                <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
                  <Ionicons name="pencil-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={14} color="#FF453A" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
                <Ionicons name="exit-outline" size={14} color="#FF8C00" />
                <Text style={styles.leaveBtnText}>Leave Game</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {past && game.is_host && game.status === 'active' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={onCloseGame}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#1C1C1E" />
              <Text style={styles.closeBtnText}>Close & Rate</Text>
            </TouchableOpacity>
          </View>
        )}
        {past && (!game.is_host || game.status === 'completed') && (
          <View style={styles.actionRow}>
            {game.status === 'completed' && game.is_host && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#0FEA95" />
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            )}
            <TouchableOpacity style={styles.rateBtn} onPress={onRatePlayers}>
              <Ionicons name="star-outline" size={15} color="#1C1C1E" />
              <Text style={styles.rateBtnText}>Rate Players</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function GamesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const removeGame = (id: number) => setGames((prev) => prev.filter((g) => g.id !== id));
  const markCompleted = (id: number) =>
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, status: 'completed' } : g));

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
              const res = await apiFetch(`/api/games/${game.id}/complete`, { method: 'POST', token });
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
              const res = await apiFetch(`/api/games/${game.id}`, { method: 'DELETE', token });
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
              const res = await apiFetch(`/api/games/${game.id}/leave`, { method: 'DELETE', token });
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
      const res = await apiFetch('/api/games/mine', { token });
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Schedule</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : (() => {
        const upcoming = games.filter(g => !isPastGame(g.scheduled_time));
        const history  = games.filter(g => isPastGame(g.scheduled_time));

        const renderCard = (item: Game) => (
          <GameCard
            key={String(item.id)}
            game={item}
            onChat={() =>
              router.push({
                pathname: '/game-chat',
                params: {
                  id: String(item.id),
                  name: `${item.sport_type.charAt(0).toUpperCase() + item.sport_type.slice(1)} Game`,
                },
              })
            }
            onRatePlayers={() =>
              router.push({
                pathname: '/rate-players',
                params: { gameId: item.id, sport: item.sport_type, scheduledTime: item.scheduled_time ?? '' },
              })
            }
            onCloseGame={() => handleClose(item)}
            onEdit={() =>
              router.push({
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
                },
              })
            }
            onDelete={() => handleDelete(item)}
            onLeave={() => handleLeave(item)}
          />
        );

        return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchMyGames(true)}
                tintColor="#0FEA95"
                colors={['#0FEA95']}
              />
            }
          >
            {upcoming.length === 0 && history.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="calendar-outline" size={80} color="#2C2C2E" />
                <Text style={styles.emptyTitle}>No upcoming games.</Text>
                <Text style={styles.emptySubtitle}>Go to the map and find a game to join!</Text>
                <TouchableOpacity style={styles.mapButton} onPress={() => router.push('/(tabs)')}>
                  <Text style={styles.mapButtonText}>Open Map</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <>
                    <Text style={styles.sectionHeader}>Upcoming</Text>
                    {upcoming.map(renderCard)}
                  </>
                )}
                {history.length > 0 && (
                  <>
                    <Text style={styles.sectionHeader}>History</Text>
                    {history.map(renderCard)}
                  </>
                )}
              </>
            )}
          </ScrollView>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 60, marginBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 30 },

  card: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 18, padding: 16, marginBottom: 14 },
  cardLeft: { marginRight: 14, justifyContent: 'center' },
  iconCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sportLabel: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeHost:   { backgroundColor: '#0FEA9533' },
  badgeJoined: { backgroundColor: '#FF8C0033' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  gameTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  locationText: { fontSize: 13, color: '#AEAEB2', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8E8E93' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chatBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#4F9EFF22', height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#4F9EFF55', paddingHorizontal: 14 },
  chatBtnText: { color: '#4F9EFF', fontWeight: '800', fontSize: 13 },
  editBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3A3A3C', height: 36, borderRadius: 10 },
  editBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FF453A22', height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#FF453A55' },
  deleteBtnText: { color: '#FF453A', fontWeight: '800', fontSize: 13 },
  leaveBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FF8C0022', height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#FF8C0055' },
  leaveBtnText: { color: '#FF8C00', fontWeight: '800', fontSize: 13 },
  closeBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4F9EFF', height: 36, borderRadius: 10 },
  closeBtnText: { color: '#1C1C1E', fontWeight: '800', fontSize: 13 },
  rateBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0FEA95', height: 36, borderRadius: 10 },
  rateBtnText: { color: '#1C1C1E', fontWeight: '800', fontSize: 13 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0FEA9515', borderRadius: 8 },
  completedBadgeText: { color: '#0FEA95', fontSize: 12, fontWeight: '700' },

  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#636366', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, marginTop: 15, fontWeight: 'bold' },
  emptySubtitle: { color: '#8E8E93', fontSize: 14, marginTop: 5, textAlign: 'center' },
  mapButton: { marginTop: 24, backgroundColor: '#0FEA95', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14 },
  mapButtonText: { color: '#1C1C1E', fontWeight: 'bold', fontSize: 16 },
});
