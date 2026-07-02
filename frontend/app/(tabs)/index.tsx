import React, { useState, useCallback, ComponentProps, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity,
  Dimensions, ScrollView, Animated, Image, TextInput, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import ReAnimated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withDelay, runOnJS,
} from 'react-native-reanimated';
import { Springs } from '../../constants/motion';
import { usePressAnimation } from '../../hooks/useAnimations';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

// appOwnership === 'expo' in Expo Go; null in dev builds and production.
// Only load react-native-maps when we know the native module is available.
const isExpoGo = Constants.appOwnership === 'expo';
let MapViewComponent: React.ComponentType<any> = View as any;
let MarkerComponent: React.ComponentType<any> = View as any;
if (!isExpoGo) {
  const maps = require('react-native-maps');
  MapViewComponent = maps.default;
  MarkerComponent = maps.Marker;
}
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS } from '../../constants/sports';
import { Colors } from '../../constants/theme';
import { getAvatarColor } from '../../utils/avatar';
import AvatarCircle from '../../components/AvatarCircle';
import LeafletMap, { LeafletMarker } from '../../components/LeafletMap';
import type { MapItem, Participant, Region } from '../../types';

import { useMapData, PENDING_MAP_PAN_KEY } from './map/useMapData';
import { isPastGame } from '../../utils/time';
import { API } from '../../constants/endpoints';
import { ROUTES } from '../../constants/routes';
import { useMapSearch } from './map/useMapSearch';
import { MapSearchDropdown } from './map/MapSearchDropdown';
import { CourtPickerSheet } from './map/CourtPickerSheet';
import { AddFab } from './map/AddFab';
import { SearchAreaChip } from './map/SearchAreaChip';
import { haversineKm } from '../../utils/geo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_AREA_THRESHOLD_KM = 2;

const { width } = Dimensions.get('window');

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const getSportStyle = (type: string): { icon: IconName; color: string } => ({
  icon: (SPORT_ICONS[type] ?? 'map-marker') as IconName,
  color: SPORT_COLORS[type] ?? Colors.accent,
});

type ClusterItem = MapItem & {
  _isCluster: boolean;
  _clusterCount: number;
  _clusterItems: MapItem[];
};

function clusterGames(items: MapItem[], latDelta: number): ClusterItem[] {
  const valid = items.filter(i => {
    const { lat, lng } = i.geometry.location;
    return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
  });

  if (latDelta < 0.015) {
    return valid.map(i => ({ ...i, _isCluster: false, _clusterCount: 1, _clusterItems: [i] }));
  }

  const gridSize = latDelta / 2.5;
  const grid = new Map<string, MapItem[]>();
  for (const item of valid) {
    const key = `${Math.floor(item.geometry.location.lat / gridSize)},${Math.floor(item.geometry.location.lng / gridSize)}`;
    const cell = grid.get(key);
    if (cell) cell.push(item);
    else grid.set(key, [item]);
  }
  return Array.from(grid.values()).map(cell => {
    const avgLat = cell.reduce((s, i) => s + i.geometry.location.lat, 0) / cell.length;
    const avgLng = cell.reduce((s, i) => s + i.geometry.location.lng, 0) / cell.length;
    const sportCounts: Record<string, number> = {};
    cell.forEach(i => { sportCounts[i.sport_type] = (sportCounts[i.sport_type] ?? 0) + 1; });
    const dominantSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0][0];
    return {
      ...cell[0],
      sport_type: dominantSport,
      place_id: `cluster_${cell.map(c => c.place_id).join('_')}`,
      geometry: { location: { lat: avgLat, lng: avgLng } },
      _isCluster: cell.length > 1,
      _clusterCount: cell.length,
      _clusterItems: cell,
    };
  });
}

function BottomCard({ court, userId, token, onJoined }: {
  court: MapItem;
  userId?: number;
  token: string | null;
  onJoined: (newCount: number) => void;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isOwnGame  = court.isLocalGame && court.host_id === userId;
  const [isJoined, setIsJoined] = useState(!!court.is_joined);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const participantCount = court.participant_count ?? 0;
  const isFull = court.max_players != null && participantCount >= court.max_players - 1;
  const displayCount = participantCount + 1;
  const playersLabel = court.max_players
    ? `${displayCount} / ${court.max_players} players`
    : `${displayCount} player${displayCount !== 1 ? 's' : ''}`;

  React.useEffect(() => {
    if (!court.isLocalGame || !court.id || !token) return;
    apiFetch(API.gameParticipants(court.id), { token })
      .then(r => r.json())
      .then(d => { if (d.success) setParticipants(d.participants); })
      .catch(() => {});
  }, [court.id]);

  React.useEffect(() => () => { scaleAnim.stopAnimation(); }, []);

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    if (!court.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    setJoining(true);
    try {
      const res = await apiFetch(API.gameJoin(court.id), { method: 'POST', token });
      const data = await res.json();
      if (!data.success) {
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      springBack();
      if (data.waitlisted) {
        setIsWaitlisted(true);
        Alert.alert("You're on the waitlist!", `You're #${data.waitlist_position} in line.`);
      } else {
        setIsJoined(true);
        onJoined(data.participant_count);
        Alert.alert("You're in! 🎉", 'Game added to My Schedule.');
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      springBack();
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setJoining(false);
    }
  };

  const spotsLeft = court.max_players != null
    ? (court.max_players - 1) - participantCount
    : null;

  return (
    <View style={styles.bottomCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{court.name}</Text>
          <View style={styles.cardBadgeRow}>
            <Text style={styles.sportBadgeText}>{court.sport_type?.toUpperCase()}</Text>
            {spotsLeft !== null && spotsLeft <= 2 && spotsLeft > 0 && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>Only {spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left!</Text>
              </View>
            )}
          </View>
        </View>
        {court.isLocalGame ? (
          <View style={styles.levelBadge}>
            <Ionicons name="flash" size={13} color={Colors.blue} />
            <Text style={styles.levelBadgeText}>Lv.{court.rating}</Text>
          </View>
        ) : (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color={Colors.yellow} />
            <Text style={styles.ratingText}>{court.rating}</Text>
          </View>
        )}
      </View>

      {court.vicinity ? <Text style={styles.cardAddress}>{court.vicinity}</Text> : null}

      {court.isLocalGame && (
        <View style={styles.playersRow}>
          <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.playersText}>{playersLabel}</Text>
        </View>
      )}

      {court.isLocalGame && participants.length > 0 && (
        <View style={styles.participantsRow}>
          <View style={styles.participantAvatars}>
            {participants.slice(0, 5).map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.avatarMiniWrap, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
                onPress={() => router.push({ pathname: ROUTES.PLAYER_PROFILE as any, params: { userId: String(p.id) } })}
              >
                <AvatarCircle username={p.username} avatar={p.avatar} size={30} />
              </TouchableOpacity>
            ))}
            {participants.length > 5 && (
              <View style={[styles.avatarMiniWrap, styles.avatarMiniMore, { marginLeft: -10 }]}>
                <Text style={styles.avatarMiniMoreText}>+{participants.length - 5}</Text>
              </View>
            )}
          </View>
          {participants[0] && (
            <Text style={styles.participantLabel} numberOfLines={1}>
              {participants[0].role === 'host' ? `${participants[0].username} (host)` : participants[0].username}
              {participants.length > 1 ? ` & ${participants.length - 1} more` : ''}
            </Text>
          )}
        </View>
      )}

      {court.isLocalGame ? (
        isOwnGame ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.surface, flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
            <Text style={[styles.joinButtonText, { color: Colors.accent }]}>Your Game</Text>
          </View>
        ) : isWaitlisted ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.warning + '22', borderWidth: 1.5, borderColor: Colors.warningBorder, flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={[styles.joinButtonText, { color: Colors.warning }]}>On Waitlist</Text>
          </View>
        ) : isJoined ? (
          <View style={[styles.joinButton, { backgroundColor: Colors.accentFaint, borderWidth: 1.5, borderColor: Colors.accentBorder, flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
            <Text style={[styles.joinButtonText, { color: Colors.accent }]}>Joined</Text>
          </View>
        ) : isFull ? (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: Colors.warning + '22', borderWidth: 1.5, borderColor: Colors.warningBorder, flexDirection: 'row', gap: 6 }]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color={Colors.warning} />
                : <>
                    <Ionicons name="time-outline" size={18} color={Colors.warning} />
                    <Text style={[styles.joinButtonText, { color: Colors.warning }]}>Join Waitlist</Text>
                  </>}
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={joining}>
              {joining
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={styles.joinButtonText}>Join Game</Text>}
            </TouchableOpacity>
          </Animated.View>
        )
      ) : (
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: Colors.surface, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
          onPress={() => router.push({
            pathname: ROUTES.COURT_DETAIL as any,
            params: {
              placeId: court.place_id,
              name: court.name,
              sport: court.sport_type ?? '',
              vicinity: court.vicinity ?? '',
            },
          })}
        >
          <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
          <Text style={[styles.joinButtonText, { color: Colors.accent }]}>View Details</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FilterChip({
  label, isActive, onPress, chipStyle, textStyle, activeChipStyle, activeTextStyle, index,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  chipStyle: any;
  textStyle: any;
  activeChipStyle: any;
  activeTextStyle: any;
  index: number;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.94, scaleUp: 1.0, stiffness: 400, damping: 18,
  });
  const translateX = useSharedValue(-30);
  const chipOpacity = useSharedValue(0);

  React.useEffect(() => {
    const delay = Math.min(index * 60, 300);
    translateX.value = withDelay(delay, withSpring(0, Springs.bouncy));
    chipOpacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staggerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: chipOpacity.value,
  }));

  return (
    <ReAnimated.View style={[staggerStyle, animatedStyle]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        style={[chipStyle, isActive && activeChipStyle]}
      >
        <Text style={[textStyle, isActive && activeTextStyle]}>{label}</Text>
      </Pressable>
    </ReAnimated.View>
  );
}

// ─── Native map screen (react-native-maps) ───────────────────────────────────

function HomeScreen() {
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
        if (finished) runOnJS(setIsCardVisible)(false);
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
                    placeholderTextColor="#999"
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
  container: { flex: 1, backgroundColor: '#f0f0f0' },
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.95)', marginHorizontal: 20, marginTop: 15, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
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

  filterChip: { backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#E5E5EA' },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.surface2, fontSize: 14, fontWeight: 'bold' },
  filterTextActive: { color: Colors.bg },

  sportChip: { width: 38, height: 38, borderRadius: 19, marginRight: 8, borderWidth: 1.5, borderColor: Colors.textSub + '66', backgroundColor: Colors.text + 'E0', justifyContent: 'center', alignItems: 'center' },
  sportChipActiveAll: { backgroundColor: Colors.bg, borderColor: Colors.bg },
  sportActiveLabel: { color: Colors.text + 'B3', fontSize: 11, fontWeight: '700', paddingHorizontal: 15, marginBottom: 4, letterSpacing: 0.3 },

  bottomCardAnimWrapper: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.9 },
  bottomCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.bg },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  sportBadgeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  urgentBadge: { backgroundColor: Colors.errorFaint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.errorBorder },
  urgentBadgeText: { color: Colors.error, fontSize: 11, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9C4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, height: 25 },
  ratingText: { fontSize: 14, fontWeight: '700', marginLeft: 4, color: '#FBC02D' },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.blueFaint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, height: 25 },
  levelBadgeText: { fontSize: 14, fontWeight: '700', color: Colors.blue },
  cardAddress: { fontSize: 14, color: Colors.textMuted, marginBottom: 10, lineHeight: 22 },
  playersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  playersText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  participantAvatars: { flexDirection: 'row', alignItems: 'center' },
  avatarMiniWrap: {},
  avatarMiniMore: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface2, borderColor: Colors.textMuted },
  avatarMiniMoreText: { color: Colors.textSub, fontSize: 10, fontWeight: '800' },
  participantLabel: { flex: 1, fontSize: 12, color: Colors.textMuted },

  joinButton: { backgroundColor: Colors.accent, paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  joinButtonText: { fontSize: 16, fontWeight: 'bold', color: Colors.bg },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: Colors.bg, width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },

  recenterBtn: { position: 'absolute', bottom: 105, right: 30, backgroundColor: 'rgba(255,255,255,0.95)', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
});

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
  recenterBtn: { position: 'absolute', bottom: 105, right: 30, backgroundColor: 'rgba(255,255,255,0.95)', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  cardWrap: { position: 'absolute', bottom: 30, alignSelf: 'center', width: '90%' },
  cardClose: { position: 'absolute', top: -10, right: -6, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
});

export default isExpoGo ? ExpoGoMapScreen : HomeScreen;
