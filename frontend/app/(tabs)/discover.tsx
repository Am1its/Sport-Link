import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Modal,
  TouchableOpacity, RefreshControl, ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { isPastGame, getTodayRange, getThisWeekendRange, getThisWeekRange, DateRange } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS, sportLabel } from '../../constants/sports';
import { Colors, Spacing, Radius, Type } from '../../constants/theme';
import { DiscoverSkeleton } from '../../components/SkeletonLoader';
import { GameCard } from '../../components/GameCard';
import type { Game } from '../../types';

const RADIUS_OPTIONS = [
  { label: 'Any Distance', km: null },
  { label: '1 km', km: 1 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: '20 km', km: 20 },
];

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

  const tabOpacity = useSharedValue(0);
  const tabFadeStyle = useAnimatedStyle(() => ({ opacity: tabOpacity.value }));

  useFocusEffect(
    useCallback(() => {
      tabOpacity.value = 0;
      tabOpacity.value = withTiming(1, { duration: 180 });
    }, [])
  );

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
      console.warn('Discover fetch error:', err);
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
    <Animated.View style={[styles.container, tabFadeStyle]}>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateChipsRow}
        style={{ marginBottom: Spacing.sm, flexGrow: 0, flexShrink: 0 }}
      >
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
      </ScrollView>

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
      <View style={{ flex: 1 }}>
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
      </View>

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
    </Animated.View>
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
  dateChipsRow:      { flexDirection: 'row', gap: 6, paddingBottom: 2 },
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

  // Empty state
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyTitle:    { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub:      { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
