import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator, TouchableOpacity,
  Dimensions, ScrollView, Image, TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import ReAnimated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Springs } from '../../../constants/motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../../context/AuthContext';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS } from '../../../constants/sports';
import { Colors } from '../../../constants/theme';
import { getAvatarColor } from '../../../utils/avatar';
import type { MapItem, Region } from '../../../types';
import { useMapData } from './useMapData';
import { isPastGame } from '../../../utils/time';
import { ROUTES } from '../../../constants/routes';
import { useMapSearch } from './useMapSearch';
import { MapSearchDropdown } from './MapSearchDropdown';
import { CourtPickerSheet } from './CourtPickerSheet';
import { AddFab } from './AddFab';
import { SearchAreaChip } from './SearchAreaChip';
import { haversineKm } from '../../../utils/geo';
import type { ComponentProps } from 'react';
import { BottomCard } from './BottomCard';
import { FilterChip } from './FilterChip';
import { clusterGames, SEARCH_AREA_THRESHOLD_KM } from './clusterGames';

// Expo Router evaluates every file under app/(tabs)/ as a potential route candidate —
// including this one — independent of index.tsx's own conditional require() for the
// screen switch. That means this module's top-level code always runs, even in Expo Go,
// so the react-native-maps require must guard itself here (matching the original
// pre-split file's pattern) rather than relying on index.tsx to prevent it from loading.
const isExpoGo = Constants.appOwnership === 'expo';
let MapViewComponent: React.ComponentType<any> = View as any;
let MarkerComponent: React.ComponentType<any> = View as any;
if (!isExpoGo) {
  const maps = require('react-native-maps');
  MapViewComponent = maps.default;
  MarkerComponent = maps.Marker;
}

const { width } = Dimensions.get('window');

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const getSportStyle = (type: string): { icon: IconName; color: string } => ({
  icon: (SPORT_ICONS[type] ?? 'map-marker') as IconName,
  color: SPORT_COLORS[type] ?? Colors.accent,
});

// Named export, not default: a default export here would make Expo Router register this
// file as its own tab, since it lives under app/(tabs)/ (see rule 30 — any file under
// app/ with a default export becomes a routable screen, tab-registered if nested inside
// a Tabs group). Every other file in this directory already avoids this the same way.
export function HomeScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const mapRef = useRef<any>(null);

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

  const [selectedCourt, setSelectedCourt] = useState<MapItem | null>(null);
  const lastCourtRef = useRef<MapItem | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [currentDelta, setCurrentDelta] = useState(0.05);
  const [currentCenter, setCurrentCenter] = useState({ latitude: initialRegion.latitude, longitude: initialRegion.longitude });
  const [searchingArea, setSearchingArea] = useState(false);
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Keep mapRegion in sync when location arrives
  React.useEffect(() => {
    setMapRegion(r => ({
      ...r,
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
    }));
    setCurrentCenter({ latitude: initialRegion.latitude, longitude: initialRegion.longitude });
  }, [initialRegion.latitude, initialRegion.longitude]);

  const distFromLastCourtsFetch = lastCourtsFetchCenter
    ? haversineKm(currentCenter.latitude, currentCenter.longitude, lastCourtsFetchCenter.lat, lastCourtsFetchCenter.lng)
    : 0;
  const showSearchArea = distFromLastCourtsFetch > SEARCH_AREA_THRESHOLD_KM;

  const handleSearchThisArea = async () => {
    setSearchingArea(true);
    await fetchCourts(currentCenter.latitude, currentCenter.longitude);
    setSearchingArea(false);
  };

  // Pan to newly created game
  React.useEffect(() => {
    if (!pendingPan) return;
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: pendingPan.lat,
        longitude: pendingPan.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    }, 400);
    clearPendingPan();
  }, [pendingPan]);

  // Tab entrance fade
  const tabOpacity = useSharedValue(0);
  const tabFadeStyle = useAnimatedStyle(() => ({ opacity: tabOpacity.value }));

  // FAB rotation
  const fabRotate = useSharedValue(0);
  const fabRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotate.value * 45}deg` }],
  }));

  useFocusEffect(
    useCallback(() => {
      tabOpacity.value = 0;
      tabOpacity.value = withTiming(1, { duration: 180 });
    }, [])
  );

  // Bottom card entrance/exit animation
  const cardY = useSharedValue(30);
  const cardOpacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));

  React.useEffect(() => {
    if (selectedCourt) {
      lastCourtRef.current = selectedCourt;
      setIsCardVisible(true);
      cardY.value = 200;
      cardOpacity.value = 0;
      cardY.value = withSpring(0, Springs.bouncy);
      cardOpacity.value = withTiming(1, { duration: 200 });
    } else if (isCardVisible) {
      cardY.value = withSpring(200, Springs.snappy);
      cardOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) scheduleOnRN(setIsCardVisible, false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourt]);

  const handleSelectPlace = async (place: { lat?: number; lng?: number; name: string }) => {
    collapseSearch();
    if (place.lat && place.lng && !isNaN(place.lat) && !isNaN(place.lng)) {
      mapRef.current?.animateToRegion({
        latitude: place.lat,
        longitude: place.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
    saveRecentSearch(place as any);
  };

  const handleRecenter = async () => {
    Haptics.selectionAsync();
    let loc = userLocation;
    if (!loc) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLocation(loc);
    }
    mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={{ marginTop: 15, color: Colors.textMuted, fontSize: 16 }}>Finding courts near you...</Text>
      </View>
    );
  }

  const activeGames = games.filter(g => !isPastGame(g.scheduled_time ?? null));
  const filteredGames = sportFilter === 'all'
    ? activeGames
    : activeGames.filter(g => g.sport_type === sportFilter);

  const displayedCourts = (() => {
    if (activeFilter === 'games') return [];
    if (activeFilter === 'all' && currentDelta > 0.035) return [];
    if (sportFilter !== 'all') return courts.filter(c => c.sport_type === sportFilter);
    return courts;
  })();

  const clusteredGames = activeFilter === 'courts' ? [] : clusterGames(filteredGames, currentDelta);
  const showSportFilter = activeFilter !== 'courts';
  const visibleGameCount = filteredGames.length;

  return (
    <ReAnimated.View style={[styles.container, tabFadeStyle]}>
      <MapViewComponent
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={(r: Region) => {
          setCurrentDelta(r.latitudeDelta);
          setCurrentCenter({ latitude: r.latitude, longitude: r.longitude });
        }}
        onPress={(e: any) => {
          if (isSelectingLocation) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setIsSelectingLocation(false);
            router.push({ pathname: ROUTES.MODAL, params: { lat: latitude, lng: longitude } });
          } else {
            setSelectedCourt(null);
          }
        }}
      >
        {displayedCourts.map((item) => {
          const { lat, lng } = item.geometry.location;
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
          const sportStyle = getSportStyle(item.sport_type);
          const vt = item.venue_type ?? 'court';
          const isIndoor = vt === 'gym' || vt === 'studio';
          return (
            <MarkerComponent
              key={item.place_id}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
              onPress={(e: any) => { e.stopPropagation(); if (!isSelectingLocation) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCourt(item); } }}
            >
              <View style={styles.markerWrapper}>
                <View style={[
                  styles.markerIconBg,
                  { borderColor: sportStyle.color },
                  isIndoor
                    ? { backgroundColor: sportStyle.color + '33', borderStyle: 'solid' }
                    : { borderStyle: 'dashed' },
                ]}>
                  <MaterialCommunityIcons name={sportStyle.icon} size={16} color={sportStyle.color} />
                </View>
              </View>
            </MarkerComponent>
          );
        })}

        {clusteredGames.map((item) => {
          const { lat, lng } = item.geometry.location;
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
          const sportStyle = getSportStyle(item.sport_type);
          if (item._isCluster) {
            const clusterColor = SPORT_COLORS[item.sport_type] ?? Colors.accent;
            return (
              <MarkerComponent
                key={item.place_id}
                coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
                onPress={(e: any) => {
                  e.stopPropagation();
                  if (!isSelectingLocation) {
                    mapRef.current?.animateToRegion({
                      latitude: lat,
                      longitude: lng,
                      latitudeDelta: currentDelta / 3,
                      longitudeDelta: currentDelta / 3,
                    }, 350);
                  }
                }}
              >
                <View style={[styles.clusterMarker, { borderColor: clusterColor, shadowColor: clusterColor }]}>
                  <View style={[styles.clusterInner, { backgroundColor: clusterColor }]}>
                    <Text style={styles.clusterText}>{item._clusterCount}</Text>
                  </View>
                </View>
              </MarkerComponent>
            );
          }
          const joined = !!item.is_joined;
          return (
            <MarkerComponent
              key={item.place_id}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
              onPress={(e: any) => { e.stopPropagation(); if (!isSelectingLocation) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCourt(item); } }}
            >
              <View style={styles.markerWrapper}>
                <View style={[
                  styles.markerIconBgGame,
                  { borderColor: joined ? Colors.accent : sportStyle.color },
                  joined && { backgroundColor: Colors.accentFaint },
                ]}>
                  <MaterialCommunityIcons name={sportStyle.icon} size={22} color={joined ? Colors.accent : sportStyle.color} />
                  {joined ? (
                    <View style={styles.markerJoinedBadge}>
                      <Ionicons name="checkmark" size={7} color={Colors.bg} />
                    </View>
                  ) : (
                    <View style={[styles.markerGameDot, { backgroundColor: sportStyle.color }]} />
                  )}
                </View>
                <View style={[styles.markerPointer, { backgroundColor: joined ? Colors.accent : sportStyle.color }]} />
              </View>
            </MarkerComponent>
          );
        })}
      </MapViewComponent>

      <SafeAreaView style={styles.headerContainer} pointerEvents="box-none">
        {isSelectingLocation ? (
          <View style={[styles.header, { backgroundColor: Colors.accent }]}>
            <Text style={[styles.headerTitle, { color: Colors.bg, fontSize: 18, textAlign: 'center', flex: 1 }]}>
              📍 Tap on the map to place a pin
            </Text>
          </View>
        ) : (
          <View>
            <View style={styles.header}>
              {searchExpanded ? (
                <>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search location..."
                    placeholderTextColor={Colors.lightPlaceholder}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    autoFocus
                    returnKeyType="search"
                  />
                  <TouchableOpacity onPress={collapseSearch} style={{ paddingLeft: 8 }}>
                    <Text style={{ color: Colors.bg, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.headerTitle}>SportLink</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {visibleGameCount > 0 && activeFilter !== 'courts' && (
                      <View style={styles.gameCountBadge}>
                        <Text style={styles.gameCountText}>{visibleGameCount} game{visibleGameCount !== 1 ? 's' : ''}</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => setSearchExpanded(true)}>
                      <Ionicons name="search-outline" size={22} color={Colors.surface2} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileButton} onPress={() => router.push(ROUTES.PROFILE_TAB as any)}>
                      {myAvatar ? (
                        <Image source={{ uri: `data:image/jpeg;base64,${myAvatar}` }} style={styles.profileAvatar} />
                      ) : (
                        <View style={[styles.profileAvatar, styles.profileAvatarFallback, { backgroundColor: getAvatarColor(myUsername || (user?.username ?? '')) }]}>
                          <Text style={styles.profileAvatarLetter}>
                            {(myUsername || user?.username || '?').charAt(0).toUpperCase()}
                          </Text>
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

            <View style={styles.filtersWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'games', label: 'Community Games' },
                  { key: 'courts', label: 'Courts' },
                ].map((f, i) => (
                  <FilterChip
                    key={f.key}
                    label={f.label}
                    isActive={activeFilter === f.key}
                    onPress={() => { setActiveFilter(f.key); setSportFilter('all'); }}
                    chipStyle={styles.filterChip}
                    textStyle={styles.filterText}
                    activeChipStyle={styles.filterChipActive}
                    activeTextStyle={styles.filterTextActive}
                    index={i}
                  />
                ))}
              </ScrollView>
            </View>

            {showSportFilter && (
              <View style={styles.sportFiltersWrapper}>
                {sportFilter !== 'all' && (
                  <Text style={styles.sportActiveLabel}>
                    {SPORT_FILTER_ITEMS.find(f => f.key === sportFilter)?.label}
                  </Text>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                  {SPORT_FILTER_ITEMS.map(f => {
                    const isActive = sportFilter === f.key;
                    const sportColor = SPORT_COLORS[f.key] ?? Colors.accent;
                    const iconName = f.key === 'all' ? 'view-grid' : (SPORT_ICONS[f.key] ?? 'help-circle');
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[
                          styles.sportChip,
                          isActive && (f.key === 'all'
                            ? styles.sportChipActiveAll
                            : { backgroundColor: sportColor + '22', borderColor: sportColor }),
                        ]}
                        onPress={() => { Haptics.selectionAsync(); setSportFilter(f.key); }}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={iconName as any}
                          size={18}
                          color={isActive
                            ? (f.key === 'all' ? Colors.accent : sportColor)
                            : 'rgba(100,100,100,0.7)'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {showSearchArea && activeFilter !== 'games' && (
              <View style={styles.searchAreaWrap}>
                <SearchAreaChip loading={searchingArea} onPress={handleSearchThisArea} />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {isCardVisible && !isSelectingLocation && (
        <ReAnimated.View style={[styles.bottomCardAnimWrapper, cardStyle]}>
          <BottomCard
            court={(selectedCourt ?? lastCourtRef.current)!}
            userId={user?.id}
            token={token}
            onJoined={(newCount) => {
              setGames(prev => prev.map(g => g.id === selectedCourt!.id ? { ...g, participant_count: newCount, is_joined: true } : g));
              setSelectedCourt(prev => prev ? { ...prev, participant_count: newCount, is_joined: true } : prev);
            }}
          />
        </ReAnimated.View>
      )}

      {!isSelectingLocation && !showAddMenu && !selectedCourt && (
        <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.8}>
          <Ionicons name="locate" size={22} color={Colors.bg} />
        </TouchableOpacity>
      )}

      {!selectedCourt && (
        isSelectingLocation ? (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: Colors.error, width: 'auto', paddingHorizontal: 20, borderRadius: 20 }]}
            onPress={() => setIsSelectingLocation(false)}
          >
            <Text style={{ color: Colors.text, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <AddFab
            isOpen={showAddMenu}
            onToggle={() => {
              const opening = !showAddMenu;
              setShowAddMenu(v => !v);
              setShowCourtPicker(false);
              fabRotate.value = withSpring(opening ? 1 : 0, Springs.snappy);
            }}
            onDropPin={() => {
              setShowAddMenu(false);
              setIsSelectingLocation(true);
              fabRotate.value = withSpring(0, Springs.snappy);
            }}
            onChooseCourt={() => setShowCourtPicker(true)}
            fabRotateStyle={fabRotateStyle}
          />
        )
      )}

      {showCourtPicker && (
        <CourtPickerSheet
          courts={courts}
          onClose={() => {
            setShowCourtPicker(false);
            setShowAddMenu(false);
            fabRotate.value = withSpring(0, Springs.snappy);
          }}
        />
      )}
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  markerWrapper: { alignItems: 'center', justifyContent: 'center' },
  markerIconBg: { backgroundColor: 'rgba(255,255,255,0.92)', padding: 4, borderRadius: 14, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 4 },
  markerIconBgGame: { backgroundColor: Colors.bg, padding: 6, borderRadius: 20, borderWidth: 2.5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 5, elevation: 7 },
  markerGameDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.bg },
  markerJoinedBadge: { position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  markerPointer: { width: 3, height: 6, marginTop: -1 },
  clusterMarker: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bg + 'EB', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 10 },
  clusterInner: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  clusterText: { color: Colors.bg, fontWeight: '900', fontSize: 14 },

  headerContainer: { position: 'absolute', top: 0, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.lightOverlayBg, marginHorizontal: 20, marginTop: 15, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.bg, paddingVertical: 4 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.bg },
  gameCountBadge: { backgroundColor: Colors.accentFaint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accentBorder },
  gameCountText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  profileButton: { marginLeft: 8 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  profileAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  profileAvatarLetter: { color: Colors.text, fontSize: 16, fontWeight: '900' },

  filtersWrapper: { marginTop: 10, paddingHorizontal: 5 },
  sportFiltersWrapper: { marginTop: 6, paddingHorizontal: 5 },
  searchAreaWrap: { alignItems: 'center', marginTop: 10 },
  filtersScroll: { paddingHorizontal: 15, paddingBottom: 5 },

  filterChip: { backgroundColor: Colors.lightChipBg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: Colors.lightChipBorder },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.surface2, fontSize: 14, fontWeight: 'bold' },
  filterTextActive: { color: Colors.bg },

  sportChip: { width: 38, height: 38, borderRadius: 19, marginRight: 8, borderWidth: 1.5, borderColor: Colors.textSub + '66', backgroundColor: Colors.text + 'E0', justifyContent: 'center', alignItems: 'center' },
  sportChipActiveAll: { backgroundColor: Colors.bg, borderColor: Colors.bg },
  sportActiveLabel: { color: Colors.text + 'B3', fontSize: 11, fontWeight: '700', paddingHorizontal: 15, marginBottom: 4, letterSpacing: 0.3 },

  bottomCardAnimWrapper: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.9 },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: Colors.bg, width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },

  recenterBtn: { position: 'absolute', bottom: 105, right: 30, backgroundColor: Colors.lightOverlayBg, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
});
