import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator, TouchableOpacity,
  ScrollView, Image, TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

// appOwnership === 'expo' in Expo Go; null in dev builds and production.
// Only load react-native-maps when we know the native module is available.
const isExpoGo = Constants.appOwnership === 'expo';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS } from '../../constants/sports';
import { Colors } from '../../constants/theme';
import { getAvatarColor } from '../../utils/avatar';
import LeafletMap, { LeafletMarker } from '../../components/LeafletMap';
import type { MapItem } from '../../types';

import { useMapData } from './map/useMapData';
import { isPastGame } from '../../utils/time';
import { ROUTES } from '../../constants/routes';
import { useMapSearch } from './map/useMapSearch';
import { MapSearchDropdown } from './map/MapSearchDropdown';
import { CourtPickerSheet } from './map/CourtPickerSheet';
import { AddFab } from './map/AddFab';
import { SearchAreaChip } from './map/SearchAreaChip';
import { clusterGames, SEARCH_AREA_THRESHOLD_KM } from './map/clusterGames';
import { haversineKm } from '../../utils/geo';
import { BottomCard } from './map/BottomCard';

// ─── Expo Go map (Leaflet WebView) ───────────────────────────────────────────

function ExpoGoMapScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  const {
    courts, games, loading, myAvatar, myUsername,
    userLocation, setUserLocation, initialRegion,
    pendingPan, clearPendingPan, setGames,
    fetchCourts, lastCourtsFetchCenter,
  } = useMapData(token);

  const {
    searchExpanded, setSearchExpanded,
    searchQuery, searchResults, searchLoading, recentSearches,
    handleSearchChange, collapseSearch, saveRecentSearch,
  } = useMapSearch();

  const [sportFilter, setSportFilter] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'games' | 'courts'>('all');
  const [selectedCourt, setSelectedCourt] = useState<MapItem | null>(null);
  const [region, setRegion] = useState(initialRegion);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [panTarget, setPanTarget] = useState<{ latitude: number; longitude: number } | null>(null);
  const [latDelta, setLatDelta] = useState(0.1);
  const [currentCenter, setCurrentCenter] = useState({ lat: initialRegion.latitude, lng: initialRegion.longitude });
  const [searchingArea, setSearchingArea] = useState(false);
  const [clusterZoomTarget, setClusterZoomTarget] = useState<{ latitude: number; longitude: number } | null>(null);

  // Keep region in sync when location arrives
  React.useEffect(() => {
    setRegion(initialRegion);
    setCurrentCenter({ lat: initialRegion.latitude, lng: initialRegion.longitude });
  }, [initialRegion.latitude, initialRegion.longitude]);

  const distFromLastCourtsFetch = lastCourtsFetchCenter
    ? haversineKm(currentCenter.lat, currentCenter.lng, lastCourtsFetchCenter.lat, lastCourtsFetchCenter.lng)
    : 0;
  const showSearchArea = distFromLastCourtsFetch > SEARCH_AREA_THRESHOLD_KM;

  const handleSearchThisArea = async () => {
    setSearchingArea(true);
    await fetchCourts(currentCenter.lat, currentCenter.lng);
    setSearchingArea(false);
  };

  // Pan to newly created game (parity fix: was missing on Expo Go)
  React.useEffect(() => {
    if (!pendingPan) return;
    setPanTarget({ latitude: pendingPan.lat, longitude: pendingPan.lng });
    clearPendingPan();
  }, [pendingPan]);

  const handleSelectPlace = (place: { lat?: number; lng?: number; name: string }) => {
    collapseSearch();
    if (place.lat && place.lng && !isNaN(place.lat) && !isNaN(place.lng)) {
      setPanTarget({ latitude: place.lat, longitude: place.lng });
    }
    saveRecentSearch(place as any);
  };

  const handleRecenter = async () => {
    Haptics.selectionAsync();
    if (!userLocation) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    }
    setRecenterTrigger(v => v + 1);
  };

  const activeGames = games.filter(g => !isPastGame(g.scheduled_time));
  const filteredGames = sportFilter === 'all' ? activeGames : activeGames.filter(g => g.sport_type === sportFilter);
  const filteredCourts = sportFilter === 'all' ? courts : courts.filter(c => c.sport_type === sportFilter);

  const clusteredGames = filterType !== 'courts' ? clusterGames(filteredGames, latDelta) : [];
  // Mirror native: hide courts when zoomed out past 0.035 (unless courts-only filter)
  const visibleCourts = filterType !== 'games' && (filterType === 'courts' || latDelta <= 0.035)
    ? filteredCourts
    : [];

  const markers: LeafletMarker[] = [
    ...clusteredGames.map(g => ({
      placeId: g.place_id,
      lat: g.geometry.location.lat,
      lng: g.geometry.location.lng,
      color: SPORT_COLORS[g.sport_type] ?? Colors.accent,
      icon: g._isCluster ? 'layers' : (SPORT_ICONS[g.sport_type] ?? 'map-marker'),
      isGame: true,
      isJoined: !g._isCluster && !!g.is_joined,
      clusterCount: g._clusterCount > 1 ? g._clusterCount : undefined,
    })),
    ...visibleCourts.map(c => ({
      placeId: c.place_id,
      lat: c.geometry.location.lat,
      lng: c.geometry.location.lng,
      color: SPORT_COLORS[c.sport_type] ?? Colors.accent,
      icon: SPORT_ICONS[c.sport_type] ?? 'map-marker',
      isGame: false,
      isJoined: false,
    })),
  ];

  const handleMarkerPress = (placeId: string) => {
    if (placeId.startsWith('cluster_')) {
      const cluster = clusteredGames.find(g => g.place_id === placeId);
      if (cluster) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setClusterZoomTarget({ latitude: cluster.geometry.location.lat, longitude: cluster.geometry.location.lng });
      }
      return;
    }
    const item = [...games, ...courts].find(i => i.place_id === placeId);
    if (item) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCourt(item); }
  };

  const handleMapPress = (lat: number, lng: number) => {
    if (isSelectingLocation) {
      setIsSelectingLocation(false);
      setShowAddMenu(false);
      router.push({ pathname: ROUTES.MODAL, params: { lat: String(lat), lng: String(lng) } });
    } else {
      setSelectedCourt(null);
    }
  };

  return (
    <SafeAreaView style={emStyles.safe} edges={['top']}>
      <View style={emStyles.header}>
        {searchExpanded ? (
          <>
            <TextInput
              style={emStyles.searchInput}
              placeholder="Search location..."
              placeholderTextColor={Colors.textHint}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus
              returnKeyType="search"
            />
            <TouchableOpacity onPress={collapseSearch} style={{ paddingLeft: 10 }}>
              <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={emStyles.title}>SportLink</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {filteredGames.length > 0 && filterType !== 'courts' && (
                <View style={emStyles.badge}>
                  <Text style={emStyles.badgeText}>{filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setSearchExpanded(true)}>
                <Ionicons name="search-outline" size={22} color={Colors.textSub} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(ROUTES.PROFILE_TAB as any)}>
                {myAvatar ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${myAvatar}` }} style={emStyles.avatar} />
                ) : (
                  <View style={[emStyles.avatar, { backgroundColor: getAvatarColor(myUsername || (user?.username ?? '')), justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>{(myUsername || user?.username || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {searchExpanded && (searchQuery.length >= 2 || recentSearches.length > 0) && (
        <MapSearchDropdown
          searchQuery={searchQuery}
          searchLoading={searchLoading}
          searchResults={searchResults}
          recentSearches={recentSearches}
          onSelectPlace={handleSelectPlace}
        />
      )}

      {isSelectingLocation && (
        <View style={emStyles.pinBanner}>
          <Text style={emStyles.pinBannerText}>📍 Tap on the map to place a pin</Text>
        </View>
      )}

      {!searchExpanded && (
        <View style={emStyles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
            {(['all', 'games', 'courts'] as const).map(key => {
              const label = key === 'all' ? 'All' : key === 'games' ? 'Community Games' : 'Courts';
              const active = filterType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[emStyles.typeChip, active && emStyles.typeChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFilterType(key); }}
                  activeOpacity={0.7}
                >
                  <Text style={[emStyles.typeChipText, active && emStyles.typeChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {SPORT_FILTER_ITEMS.map(f => {
              const active = sportFilter === f.key;
              const color = f.key === 'all' ? Colors.accent : (SPORT_COLORS[f.key] ?? Colors.accent);
              const iconName = f.key === 'all' ? undefined : (SPORT_ICONS[f.key] ?? 'help-circle');
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[emStyles.chip, active && { backgroundColor: color + '22', borderColor: color }]}
                  onPress={() => { Haptics.selectionAsync(); setSportFilter(f.key); }}
                  activeOpacity={0.7}
                >
                  {iconName && <MaterialCommunityIcons name={iconName as any} size={13} color={active ? color : Colors.textMuted} />}
                  <Text style={[emStyles.chipText, active && { color }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!searchExpanded && showSearchArea && filterType !== 'games' && (
        <View style={emStyles.searchAreaWrap}>
          <SearchAreaChip loading={searchingArea} onPress={handleSearchThisArea} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={emStyles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
        ) : (
          <LeafletMap
            region={region}
            markers={markers}
            userLocation={userLocation}
            recenterTrigger={recenterTrigger}
            panTarget={panTarget}
            clusterZoomTarget={clusterZoomTarget}
            onMarkerPress={handleMarkerPress}
            onMapPress={handleMapPress}
            onZoom={(delta, center) => { setLatDelta(delta); setCurrentCenter(center); }}
          />
        )}

        {!selectedCourt && !isSelectingLocation && (
          <TouchableOpacity style={emStyles.recenterBtn} onPress={handleRecenter} activeOpacity={0.8}>
            <Ionicons name="locate" size={22} color={Colors.bg} />
          </TouchableOpacity>
        )}

        {!selectedCourt && (
          isSelectingLocation ? (
            <TouchableOpacity
              style={[emStyles.fab, { backgroundColor: Colors.error, width: 'auto', paddingHorizontal: 20, borderRadius: 20 }]}
              onPress={() => { setIsSelectingLocation(false); setShowAddMenu(false); }}
            >
              <Text style={{ color: Colors.text, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <AddFab
              isOpen={showAddMenu}
              onToggle={() => setShowAddMenu(v => !v)}
              onDropPin={() => { setShowAddMenu(false); setIsSelectingLocation(true); }}
              onChooseCourt={() => { setShowCourtPicker(true); setShowAddMenu(false); }}
            />
          )
        )}

        {showCourtPicker && (
          <CourtPickerSheet
            courts={courts}
            onClose={() => setShowCourtPicker(false)}
          />
        )}

        {selectedCourt && (
          <View style={emStyles.cardWrap}>
            <BottomCard
              court={selectedCourt}
              userId={user?.id}
              token={token}
              onJoined={(newCount) => {
                setGames(prev => prev.map(g => g.id === selectedCourt.id ? { ...g, participant_count: newCount, is_joined: true } : g));
                setSelectedCourt(prev => prev ? { ...prev, participant_count: newCount, is_joined: true } : prev);
              }}
            />
            <TouchableOpacity style={emStyles.cardClose} onPress={() => setSelectedCourt(null)}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const emStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '900', color: Colors.text },
  badge: { backgroundColor: Colors.accentFaint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accentBorder },
  badgeText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: 4 },
  pinBanner: { backgroundColor: Colors.accent, paddingVertical: 10, alignItems: 'center' },
  pinBannerText: { color: Colors.bg, fontWeight: '800', fontSize: 15 },
  searchAreaWrap: { alignItems: 'center', paddingBottom: 10 },
  filterRow: { paddingBottom: 10 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  typeChipActive: { backgroundColor: Colors.accentFaint, borderColor: Colors.accent },
  typeChipText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  typeChipTextActive: { color: Colors.accent },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: Colors.bg, width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  recenterBtn: { position: 'absolute', bottom: 105, right: 30, backgroundColor: Colors.lightOverlayBg, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  cardWrap: { position: 'absolute', bottom: 30, alignSelf: 'center', width: '90%' },
  cardClose: { position: 'absolute', top: -10, right: -6, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
});

export default isExpoGo ? ExpoGoMapScreen : require('./map/HomeScreen').default;
