import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, ScrollView, Modal,
  TouchableOpacity, ActivityIndicator, Alert, Animated, RefreshControl, Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { isPastGame } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS } from '../../constants/sports';

const RADIUS_OPTIONS = [
  { label: 'Any', km: null },
  { label: '1 km', km: 1 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: '20 km', km: 20 },
];

type Game = {
  id: number;
  place_id: string;
  sport_type: string;
  level: number;
  title: string | null;
  scheduled_time: string | null;
  location_desc: string | null;
  equipment_notes: string | null;
  max_players: number | null;
  participant_count: number;
  host_id: number;
  photo: string | null;
  is_joined?: boolean;
};

function GameCard({
  game, userId, token, onJoined, onViewParticipants,
}: {
  game: Game;
  userId?: number;
  token: string | null;
  onJoined: (id: number, newCount: number) => void;
  onViewParticipants: () => void;
}) {
  const [joining, setJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(!!game.is_joined);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const color = SPORT_COLORS[game.sport_type] ?? '#0FEA95';
  const icon  = SPORT_ICONS[game.sport_type]  ?? 'map-marker';
  const isOwn = game.host_id === userId;
  // Host takes one slot; remaining spots = max_players - 1 - participant_count
  const spotsLeft = game.max_players != null
    ? (game.max_players - 1) - game.participant_count
    : null;
  const isFull = spotsLeft != null && spotsLeft <= 0;
  const isUrgent = spotsLeft != null && spotsLeft <= 2 && spotsLeft > 0;
  // Display: (participants + host) / max_players
  const displayCount = game.participant_count + 1;
  const playersLabel = game.max_players
    ? `${displayCount} / ${game.max_players}`
    : `${displayCount}`;

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    // Optimistic update
    onJoined(game.id, game.participant_count + 1);
    setJoining(true);
    try {
      const res = await apiFetch(`/api/games/${game.id}/join`, { method: 'POST', token });
      const data = await res.json();
      if (!data.success) {
        // Rollback optimistic update
        onJoined(game.id, game.participant_count);
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsJoined(true);
      onJoined(game.id, data.participant_count);
      springBack();
      Alert.alert("You're in! 🎉", 'Game added to My Schedule.');
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      onJoined(game.id, game.participant_count);
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
          {game.title ? (
            <Text style={styles.gameTitle} numberOfLines={1}>{game.title}</Text>
          ) : null}
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
            <TouchableOpacity style={styles.metaItem} onPress={onViewParticipants} activeOpacity={0.7}>
              <Ionicons name="people-outline" size={13} color="#4F9EFF" />
              <Text style={[styles.metaText, { color: '#4F9EFF' }, isUrgent && { color: '#FF9F0A' }]}>{playersLabel} players</Text>
            </TouchableOpacity>
            <View style={styles.metaItem}>
              <Ionicons name="flash-outline" size={13} color="#8E8E93" />
              <Text style={styles.metaText}>Lv.{game.level}</Text>
            </View>
          </View>
        </View>
      </View>

      {game.photo ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${game.photo}` }}
          style={styles.cardPhoto}
          resizeMode="cover"
        />
      ) : null}

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
      ) : isJoined ? (
        <View style={[styles.joinBtn, styles.joinBtnMuted]}>
          <Text style={[styles.joinBtnText, { color: '#0FEA95' }]}>✓ Joined</Text>
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
  const router = useRouter();
  const { token, user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [showSportModal, setShowSportModal] = useState(false);
  const [showRadiusModal, setShowRadiusModal] = useState(false);
  const userLocation = useRef<{ lat: number; lng: number } | null>(null);

  const fetchGames = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      let url = '/api/games';
      if (radiusKm !== null) {
        if (!userLocation.current) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            userLocation.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
        }
        if (userLocation.current) {
          url += `?lat=${userLocation.current.lat}&lng=${userLocation.current.lng}&radius_km=${radiusKm}`;
        }
      }
      const res = await apiFetch(url, { token });
      const data = await res.json();
      if (data.success) setGames(data.games);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      console.error('Discover fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, radiusKm]);

  useFocusEffect(
    useCallback(() => { fetchGames(); }, [fetchGames])
  );

  const handleJoined = (id: number, newCount: number) => {
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, participant_count: newCount, is_joined: true } : g));
  };

  const filtered = games.filter((g) => {
    if (isPastGame(g.scheduled_time)) return false;
    const matchSport = sportFilter === 'all' || g.sport_type === sportFilter;
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      g.sport_type.includes(q) ||
      (g.location_desc ?? '').toLowerCase().includes(q) ||
      (g.title ?? '').toLowerCase().includes(q);
    return matchSport && matchSearch;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find Games</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by sport, location or title..."
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
        <TouchableOpacity
          style={[styles.selectorBtn, sportFilter !== 'all' && styles.selectorBtnSportActive]}
          onPress={() => setShowSportModal(true)}
        >
          <MaterialCommunityIcons
            name={(sportFilter === 'all' ? 'filter-variant' : SPORT_ICONS[sportFilter]) as any}
            size={16}
            color={sportFilter === 'all' ? '#8E8E93' : '#0FEA95'}
          />
          <Text style={[styles.selectorText, sportFilter !== 'all' && styles.selectorTextSportActive]} numberOfLines={1}>
            {sportFilter === 'all'
              ? 'All Sports'
              : sportFilter.charAt(0).toUpperCase() + sportFilter.slice(1)}
          </Text>
          <Ionicons name="chevron-down" size={14} color={sportFilter === 'all' ? '#8E8E93' : '#0FEA95'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectorBtn, radiusKm !== null && styles.selectorBtnRadiusActive]}
          onPress={() => setShowRadiusModal(true)}
        >
          <Ionicons name="location-outline" size={16} color={radiusKm === null ? '#8E8E93' : '#4F9EFF'} />
          <Text style={[styles.selectorText, radiusKm !== null && styles.selectorTextRadiusActive]} numberOfLines={1}>
            {radiusKm === null ? 'Any Distance' : `${radiusKm} km`}
          </Text>
          <Ionicons name="chevron-down" size={14} color={radiusKm === null ? '#8E8E93' : '#4F9EFF'} />
        </TouchableOpacity>
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
            <GameCard
              game={item}
              userId={user?.id}
              token={token}
              onJoined={handleJoined}
              onViewParticipants={() =>
                router.push({
                  pathname: '/game-participants',
                  params: {
                    gameId: String(item.id),
                    title: item.title ?? `${item.sport_type.charAt(0).toUpperCase() + item.sport_type.slice(1)} Game`,
                  },
                } as any)
              }
            />
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
      <Modal visible={showSportModal} transparent animationType="fade" onRequestClose={() => setShowSportModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSportModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Sport</Text>
            {SPORT_FILTER_ITEMS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={styles.modalOption}
                onPress={() => { setSportFilter(key); setShowSportModal(false); }}
              >
                {key === 'all'
                  ? <Ionicons name="apps-outline" size={20} color="#8E8E93" />
                  : <MaterialCommunityIcons name={SPORT_ICONS[key] as any} size={20} color={SPORT_COLORS[key] ?? '#0FEA95'} />}
                <Text style={[styles.modalOptionText, sportFilter === key && styles.modalOptionSelected]}>
                  {label}
                </Text>
                {sportFilter === key && <Ionicons name="checkmark" size={18} color="#0FEA95" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showRadiusModal} transparent animationType="fade" onRequestClose={() => setShowRadiusModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRadiusModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Distance</Text>
            {RADIUS_OPTIONS.map(({ label, km }) => (
              <TouchableOpacity
                key={label}
                style={styles.modalOption}
                onPress={() => { userLocation.current = null; setRadiusKm(km); setShowRadiusModal(false); }}
              >
                <Ionicons name="location-outline" size={20} color="#4F9EFF" />
                <Text style={[styles.modalOptionText, radiusKm === km && styles.modalOptionSelectedRadius]}>
                  {label}
                </Text>
                {radiusKm === km && <Ionicons name="checkmark" size={18} color="#4F9EFF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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

  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  selectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2C2C2E', borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: '#3A3A3C' },
  selectorBtnSportActive: { borderColor: '#0FEA95', backgroundColor: '#0FEA9515' },
  selectorBtnRadiusActive: { borderColor: '#4F9EFF', backgroundColor: '#4F9EFF15' },
  selectorText: { flex: 1, color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  selectorTextSportActive: { color: '#0FEA95' },
  selectorTextRadiusActive: { color: '#4F9EFF' },

  modalOverlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#2C2C2E', borderRadius: 20, padding: 16, width: '100%', maxWidth: 340 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  modalOptionText: { flex: 1, color: '#AEAEB2', fontSize: 16, fontWeight: '600' },
  modalOptionSelected: { color: '#0FEA95', fontWeight: '700' },
  modalOptionSelectedRadius: { color: '#4F9EFF', fontWeight: '700' },

  card: { backgroundColor: '#2C2C2E', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', marginBottom: 14 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardInfo: { flex: 1 },
  sportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  sportLabel: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  urgencyBadge: { backgroundColor: '#FF9F0A22', borderRadius: 8, borderWidth: 1, borderColor: '#FF9F0A66', paddingHorizontal: 7, paddingVertical: 2 },
  urgencyText: { color: '#FF9F0A', fontSize: 11, fontWeight: '800' },
  gameTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  locationText: { fontSize: 13, color: '#AEAEB2', marginBottom: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8E8E93' },

  cardPhoto: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12 },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12, paddingHorizontal: 2 },
  equipText: { color: '#636366', fontSize: 12, flex: 1 },

  joinBtn: { backgroundColor: '#0FEA95', height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  joinBtnMuted: { backgroundColor: '#3A3A3C' },
  joinBtnText: { color: '#1C1C1E', fontWeight: '800', fontSize: 15 },

  emptyText: { color: '#636366', fontSize: 16, marginTop: 12 },
});
