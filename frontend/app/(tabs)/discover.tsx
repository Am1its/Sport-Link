import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Alert, Animated, RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../constants/api';

type Game = {
  id: number;
  place_id: string;
  sport_type: string;
  level: number;
  scheduled_time: string | null;
  location_desc: string | null;
  equipment_notes: string | null;
  max_players: number | null;
  participant_count: number;
  host_id: number;
};

const SPORT_COLORS: Record<string, string> = {
  basketball: '#FF8C00',
  tennis:     '#CCFF00',
  volleyball: '#FFD700',
  football:   '#FFFFFF',
};
const SPORT_ICONS: Record<string, string> = {
  basketball: 'basketball',
  tennis:     'tennis',
  volleyball: 'volleyball',
  football:   'soccer',
};
const SPORT_FILTERS = ['all', 'basketball', 'tennis', 'volleyball', 'football'] as const;
const SPORT_LABELS: Record<string, string> = {
  all: 'All', basketball: '🏀', tennis: '🎾', volleyball: '🏐', football: '⚽',
};

function GameCard({
  game, userId, token, onJoined,
}: {
  game: Game;
  userId?: number;
  token: string | null;
  onJoined: (id: number, newCount: number) => void;
}) {
  const [joining, setJoining] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const color = SPORT_COLORS[game.sport_type] ?? '#0FEA95';
  const icon  = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  const isOwn = game.host_id === userId;
  const isFull = game.max_players != null && game.participant_count >= game.max_players;
  const spotsLeft = game.max_players != null ? game.max_players - game.participant_count : null;
  const isUrgent = spotsLeft != null && spotsLeft <= 2 && spotsLeft > 0;
  const playersLabel = game.max_players
    ? `${game.participant_count} / ${game.max_players}`
    : `${game.participant_count}`;

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/games/${game.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onJoined(game.id, data.participant_count);
      springBack();
      Alert.alert("You're in! 🎉", 'Game added to My Schedule.');
    } catch {
      springBack();
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color }]}>
          <MaterialCommunityIcons name={icon as any} size={26} color={color} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.sportRow}>
            <Text style={styles.sportLabel}>{game.sport_type.toUpperCase()}</Text>
            {isUrgent && (
              <View style={styles.urgencyBadge}>
                <Text style={styles.urgencyText}>Only {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left!</Text>
              </View>
            )}
          </View>
          {game.location_desc ? (
            <Text style={styles.locationText} numberOfLines={1}>{game.location_desc}</Text>
          ) : null}
          <View style={styles.metaRow}>
            {game.scheduled_time ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color="#8E8E93" />
                <Text style={styles.metaText}>{game.scheduled_time}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color="#8E8E93" />
              <Text style={[styles.metaText, isUrgent && { color: '#FF9F0A' }]}>{playersLabel} players</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="flash-outline" size={13} color="#8E8E93" />
              <Text style={styles.metaText}>Lv.{game.level}</Text>
            </View>
          </View>
        </View>
      </View>

      {game.equipment_notes ? (
        <View style={styles.equipRow}>
          <Ionicons name="bag-outline" size={13} color="#636366" />
          <Text style={styles.equipText} numberOfLines={1}>{game.equipment_notes}</Text>
        </View>
      ) : null}

      {isOwn ? (
        <View style={[styles.joinBtn, styles.joinBtnMuted]}>
          <Text style={[styles.joinBtnText, { color: '#0FEA95' }]}>Your Game</Text>
        </View>
      ) : isFull ? (
        <View style={[styles.joinBtn, styles.joinBtnMuted]}>
          <Text style={[styles.joinBtnText, { color: '#FF453A' }]}>Full</Text>
        </View>
      ) : (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={joining}>
            {joining
              ? <ActivityIndicator color="#1C1C1E" size="small" />
              : <Text style={styles.joinBtnText}>Join Game</Text>}
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

export default function DiscoverScreen() {
  const { token, user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');

  const fetchGames = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/games`);
      const data = await res.json();
      if (data.success) setGames(data.games);
    } catch (err) {
      console.error('Discover fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGames();
    }, [fetchGames])
  );

  const handleJoined = (id: number, newCount: number) => {
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, participant_count: newCount } : g));
  };

  const isPastGame = (t: string | null) => { const d = new Date(t ?? ''); return !isNaN(d.getTime()) && d < new Date(); };

  const filtered = games.filter((g) => {
    if (isPastGame(g.scheduled_time)) return false;
    const matchSport = sportFilter === 'all' || g.sport_type === sportFilter;
    const matchSearch = !search.trim() ||
      g.sport_type.includes(search.toLowerCase()) ||
      (g.location_desc ?? '').toLowerCase().includes(search.toLowerCase());
    return matchSport && matchSearch;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find Games</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by sport or location..."
          placeholderTextColor="#636366"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#636366" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {SPORT_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, sportFilter === s && styles.filterChipActive]}
            onPress={() => setSportFilter(s)}
          >
            <Text style={[styles.filterText, sportFilter === s && styles.filterTextActive]}>
              {SPORT_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="compass-outline" size={70} color="#2C2C2E" />
          <Text style={styles.emptyText}>No games found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <GameCard game={item} userId={user?.id} token={token} onJoined={handleJoined} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchGames(true)}
              tintColor="#0FEA95"
              colors={['#0FEA95']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 60, marginBottom: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 30 },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 14, gap: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C' },
  filterChipActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  filterText: { color: '#8E8E93', fontSize: 14, fontWeight: '700' },
  filterTextActive: { color: '#1C1C1E' },

  card: { backgroundColor: '#2C2C2E', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', marginBottom: 14 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardInfo: { flex: 1 },
  sportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  sportLabel: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  urgencyBadge: { backgroundColor: '#FF9F0A22', borderRadius: 8, borderWidth: 1, borderColor: '#FF9F0A66', paddingHorizontal: 7, paddingVertical: 2 },
  urgencyText: { color: '#FF9F0A', fontSize: 11, fontWeight: '800' },
  locationText: { fontSize: 13, color: '#AEAEB2', marginBottom: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8E8E93' },

  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12, paddingHorizontal: 2 },
  equipText: { color: '#636366', fontSize: 12, flex: 1 },

  joinBtn: { backgroundColor: '#0FEA95', height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  joinBtnMuted: { backgroundColor: '#3A3A3C' },
  joinBtnText: { color: '#1C1C1E', fontWeight: '800', fontSize: 15 },

  emptyText: { color: '#636366', fontSize: 16, marginTop: 12 },
});
