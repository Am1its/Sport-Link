import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Modal,
  TouchableOpacity, ActivityIndicator, Alert, Animated, RefreshControl, Image, Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { API_BASE } from '../../constants/api';
import { isPastGame, getTodayRange, getThisWeekendRange, getThisWeekRange, DateRange } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS, sportLabel } from '../../constants/sports';
import { Colors, Spacing, Radius, Type, Shadow } from '../../constants/theme';
import { DiscoverSkeleton } from '../../components/SkeletonLoader';
import type { Game } from '../../types';

const RADIUS_OPTIONS = [
  { label: 'Any Distance', km: null },
  { label: '1 km', km: 1 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: '20 km', km: 20 },
];


function GameCard({
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
  const scaleAnim = useRef(new Animated.Value(1)).current;
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

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    if (!isFull) onJoined(game.id, game.participant_count + 1);
    setJoining(true);
    try {
      const res  = await apiFetch(`/api/games/${game.id}/join`, { method: 'POST', token });
      const data = await res.json();
      if (!data.success) {
        if (!isFull) onJoined(game.id, game.participant_count);
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsJoined(true);
      if (data.waitlisted) {
        setIsWaitlisted(true);
        Alert.alert("You're on the waitlist!", `You're #${data.waitlist_position} in line. You'll be notified if a spot opens.`);
      } else {
        onJoined(game.id, data.participant_count);
        Alert.alert("You're in!", 'Game added to My Schedule.');
      }
      springBack();
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      if (!isFull) onJoined(game.id, game.participant_count);
      springBack();
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
            <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, { flex: 1 }]}>
              <TouchableOpacity style={[styles.joinBtn, styles.joinBtnWaitlist]} onPress={handleJoin} disabled={joining} activeOpacity={0.85}>
                {joining
                  ? <ActivityIndicator color={Colors.warning} size="small" />
                  : <>
                      <Ionicons name="time-outline" size={16} color={Colors.warning} />
                      <Text style={[styles.joinBtnText, { color: Colors.warning }]}>Join Waitlist</Text>
                    </>}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, { flex: 1 }]}>
              <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={joining} activeOpacity={0.85}>
                {joining
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <>
                      <Text style={styles.joinBtnText}>Join Game</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.bg} />
                    </>}
              </TouchableOpacity>
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

export default function DiscoverScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [games, setGames]               = useState<Game[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [sportFilter, setSportFilter]   = useState<string>('all');
  const [radiusKm, setRadiusKm]         = useState<number | null>(null);
  const [dateFilter, setDateFilter]     = useState<'any' | 'today' | 'weekend' | 'week'>('any');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string | null>(null);
  const [showSportModal, setShowSportModal]   = useState(false);
  const [showRadiusModal, setShowRadiusModal] = useState(false);
  const userLocation = useRef<{ lat: number; lng: number } | null>(null);
  const searchRef    = useRef('');
  searchRef.current  = search;

  const fetchGames = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const q = searchRef.current.trim();
      const parts: string[] = [];

      if (radiusKm !== null) {
        if (!userLocation.current) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            userLocation.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
        }
        if (userLocation.current) {
          parts.push(
            `lat=${userLocation.current.lat}`,
            `lng=${userLocation.current.lng}`,
            `radius_km=${radiusKm}`,
          );
        }
      }
      if (q.length >= 2) parts.push(`q=${encodeURIComponent(q)}`);

      if (dateFilter !== 'any') {
        let range: DateRange;
        if (dateFilter === 'today')   range = getTodayRange();
        else if (dateFilter === 'weekend') range = getThisWeekendRange();
        else range = getThisWeekRange();
        parts.push(`date_from=${range.date_from}`, `date_to=${range.date_to}`);
      }
      if (neighborhoodFilter) parts.push(`neighborhood=${encodeURIComponent(neighborhoodFilter)}`);

      const url = `/api/games${parts.length ? `?${parts.join('&')}` : ''}`;
      const res  = await apiFetch(url, { token });
      const data = await res.json();
      if (data.success) setGames(data.games);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      console.error('Discover fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, radiusKm, dateFilter, neighborhoodFilter]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search: re-fetch 400ms after the user stops typing
  useEffect(() => {
    debounceRef.current = setTimeout(() => fetchGames(), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, fetchGames]);

  useFocusEffect(
    useCallback(() => {
      fetchGames();
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [fetchGames])
  );

  const handleJoined = (id: number, newCount: number) => {
    setGames(prev => prev.map(g => g.id === id ? { ...g, participant_count: newCount, is_joined: true } : g));
  };

  const handleNeighborhoodPress = (neighborhood: string) => {
    setNeighborhoodFilter(prev => prev === neighborhood ? null : neighborhood);
  };

  const filtered = games.filter(g => {
    if (isPastGame(g.scheduled_time)) return false;
    return sportFilter === 'all' || g.sport_type === sportFilter;
  });

  const sportFilterLabel = sportFilter === 'all' ? 'All Sports' : sportLabel(sportFilter);

  const radiusLabel = radiusKm === null ? 'Any Distance' : `${radiusKm} km`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find Games</Text>

      {/* Search bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sport, location or title..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={Colors.textHint} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date filter chips */}
      <View style={styles.dateChipsRow}>
        {([
          { key: 'any',     label: 'Any time' },
          { key: 'today',   label: 'Today' },
          { key: 'weekend', label: 'This Weekend' },
          { key: 'week',    label: 'This Week' },
        ] as const).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.dateChip, dateFilter === key && styles.dateChipActive]}
            onPress={() => setDateFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateChipText, dateFilter === key && styles.dateChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Neighborhood filter banner (when active) */}
      {neighborhoodFilter && (
        <TouchableOpacity
          style={styles.neighborhoodBanner}
          onPress={() => setNeighborhoodFilter(null)}
          activeOpacity={0.7}
        >
          <Ionicons name="location" size={13} color={Colors.purple} />
          <Text style={styles.neighborhoodBannerText}>{neighborhoodFilter}</Text>
          <Ionicons name="close-circle" size={15} color={Colors.purple} />
        </TouchableOpacity>
      )}

      {/* Filter row */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.selectorBtn, sportFilter !== 'all' && styles.selectorActive]}
          onPress={() => setShowSportModal(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={(sportFilter === 'all' ? 'filter-variant' : SPORT_ICONS[sportFilter]) as any}
            size={15}
            color={sportFilter === 'all' ? Colors.textMuted : Colors.accent}
          />
          <Text
            style={[styles.selectorText, sportFilter !== 'all' && { color: Colors.accent }]}
            numberOfLines={1}
          >
            {sportFilterLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={sportFilter === 'all' ? Colors.textMuted : Colors.accent}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectorBtn, radiusKm !== null && styles.selectorActiveBlue]}
          onPress={() => setShowRadiusModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="location-outline"
            size={15}
            color={radiusKm === null ? Colors.textMuted : Colors.blue}
          />
          <Text
            style={[styles.selectorText, radiusKm !== null && { color: Colors.blue }]}
            numberOfLines={1}
          >
            {radiusLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={radiusKm === null ? Colors.textMuted : Colors.blue}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={<DiscoverSkeleton />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="compass-outline" size={42} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No games found</Text>
          <Text style={styles.emptySub}>
            {search || sportFilter !== 'all' || radiusKm !== null
              ? 'Try adjusting your filters'
              : 'Create one on the map!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <GameCard
              game={item}
              userId={user?.id}
              token={token}
              onJoined={handleJoined}
              onNeighborhoodPress={handleNeighborhoodPress}
              onViewParticipants={() =>
                router.push({
                  pathname: '/game-participants',
                  params: {
                    gameId: String(item.id),
                    title: item.title ?? `${sportLabel(item.sport_type)} Game`,
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
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        />
      )}

      {/* Sport picker modal */}
      <Modal visible={showSportModal} transparent animationType="fade" onRequestClose={() => setShowSportModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSportModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Sport</Text>
            {SPORT_FILTER_ITEMS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.modalOption, sportFilter === key && styles.modalOptionHighlight]}
                onPress={() => { setSportFilter(key); setShowSportModal(false); }}
                activeOpacity={0.7}
              >
                {key === 'all'
                  ? <Ionicons name="apps-outline" size={20} color={Colors.textMuted} />
                  : <MaterialCommunityIcons
                      name={SPORT_ICONS[key] as any}
                      size={20}
                      color={SPORT_COLORS[key] ?? Colors.accent}
                    />}
                <Text style={[styles.modalOptionText, sportFilter === key && { color: Colors.accent, fontWeight: '700' }]}>
                  {label}
                </Text>
                {sportFilter === key && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Distance picker modal */}
      <Modal visible={showRadiusModal} transparent animationType="fade" onRequestClose={() => setShowRadiusModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRadiusModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Distance</Text>
            {RADIUS_OPTIONS.map(({ label, km }) => (
              <TouchableOpacity
                key={label}
                style={[styles.modalOption, radiusKm === km && styles.modalOptionHighlightBlue]}
                onPress={() => { userLocation.current = null; setRadiusKm(km); setShowRadiusModal(false); }}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={20} color={Colors.blue} />
                <Text style={[styles.modalOptionText, radiusKm === km && { color: Colors.blue, fontWeight: '700' }]}>
                  {label}
                </Text>
                {radiusKm === km && <Ionicons name="checkmark" size={18} color={Colors.blue} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.xl },
  title:     { ...Type.screenTitle, color: Colors.text, marginTop: 60, marginBottom: Spacing.lg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { paddingBottom: 30 },

  // Search
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, height: 48, marginBottom: 12, gap: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },

  // Date chips
  dateChipsRow:      { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  dateChip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dateChipActive:    { backgroundColor: Colors.purple + '22', borderColor: Colors.purple + '66' },
  dateChipText:      { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  dateChipTextActive:{ color: Colors.purple },

  // Neighborhood
  neighborhoodTag:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4, alignSelf: 'flex-start' },
  neighborhoodText:   { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  neighborhoodBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.purple + '15', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.purple + '44', paddingHorizontal: 12, paddingVertical: 8, marginBottom: Spacing.sm },
  neighborhoodBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.purple },

  // Filters
  filterRow:          { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  selectorBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: Colors.border },
  selectorActive:     { borderColor: Colors.accent, backgroundColor: Colors.accentFaint },
  selectorActiveBlue: { borderColor: Colors.blue,   backgroundColor: Colors.blueFaint },
  selectorText:       { flex: 1, color: Colors.textMuted, fontSize: 13, fontWeight: '600' },

  // Modals
  modalOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  modalSheet:            { backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.lg, width: '100%', maxWidth: 340 },
  modalTitle:            { ...Type.screenTitle, fontSize: 18, color: Colors.text, marginBottom: Spacing.sm },
  modalOption:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12, paddingHorizontal: Spacing.sm, borderRadius: Radius.md },
  modalOptionHighlight:  { backgroundColor: Colors.accentFaint },
  modalOptionHighlightBlue: { backgroundColor: Colors.blueFaint },
  modalOptionText:       { flex: 1, color: Colors.textSub, fontSize: 15, fontWeight: '600' },

  // Card
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

  // Join button
  joinBtnWrap: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  joinRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent, height: 44, borderRadius: Radius.pill },
  joinBtnMuted:    { backgroundColor: Colors.surface2 },
  joinBtnWaitlist: { backgroundColor: Colors.warning + '22', borderWidth: 1, borderColor: Colors.warningBorder },
  joinBtnText: { color: Colors.bg, ...Type.btnPrimary },
  shareBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center' },

  // Empty state
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyTitle:    { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub:      { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
