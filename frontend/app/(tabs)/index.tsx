import React, { useState, useEffect, useCallback, ComponentProps, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity, Dimensions, ScrollView, Animated, FlatList, Image, TextInput, Keyboard, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import ReAnimated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { usePressAnimation } from '../../hooks/useAnimations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { searchPlaces, GeoResult } from '../../utils/geocode';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS } from '../../constants/sports';
import { Colors } from '../../constants/theme';
import { getAvatarColor } from '../../utils/avatar';
import AvatarCircle from '../../components/AvatarCircle';
import type { MapItem, Participant } from '../../types';

const RECENT_SEARCHES_KEY = 'map_recent_searches';
const PENDING_MAP_PAN_KEY = 'pending_map_pan';

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
  // Drop any items with invalid coordinates to prevent native map crashes
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
    // Use the most common sport's color for the cluster
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
  // Host occupies one slot; participants fill max_players - 1 remaining spots
  const participantCount = court.participant_count ?? 0;
  const isFull = court.max_players != null && participantCount >= court.max_players - 1;
  const displayCount = participantCount + 1; // include host
  const playersLabel = court.max_players
    ? `${displayCount} / ${court.max_players} players`
    : `${displayCount} player${displayCount !== 1 ? 's' : ''}`;

  useEffect(() => {
    if (!court.isLocalGame || !court.id || !token) return;
    apiFetch(`/api/games/${court.id}/participants`, { token })
      .then(r => r.json())
      .then(d => { if (d.success) setParticipants(d.participants); })
      .catch(() => {});
  }, [court.id]);

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    if (!court.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    setJoining(true);
    try {
      const res = await apiFetch(`/api/games/${court.id}/join`, { method: 'POST', token });
      const data = await res.json();
      if (!data.success) {
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsJoined(true);
      onJoined(data.participant_count);
      springBack();
      Alert.alert("You're in! 🎉", 'Game added to My Schedule.');
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
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{court.rating}</Text>
        </View>
      </View>

      {court.vicinity ? <Text style={styles.cardAddress}>{court.vicinity}</Text> : null}

      {court.isLocalGame && (
        <View style={styles.playersRow}>
          <Ionicons name="people-outline" size={16} color="#8E8E93" />
          <Text style={styles.playersText}>{playersLabel}</Text>
        </View>
      )}

      {/* Participants avatars */}
      {court.isLocalGame && participants.length > 0 && (
        <View style={styles.participantsRow}>
          <View style={styles.participantAvatars}>
            {participants.slice(0, 5).map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.avatarMiniWrap, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}
                onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(p.id) } })}
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
          <View style={[styles.joinButton, { backgroundColor: '#2C2C2E', flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color="#0FEA95" />
            <Text style={[styles.joinButtonText, { color: '#0FEA95' }]}>Your Game</Text>
          </View>
        ) : isJoined ? (
          <View style={[styles.joinButton, { backgroundColor: '#0FEA9515', borderWidth: 1.5, borderColor: '#0FEA9555', flexDirection: 'row', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color="#0FEA95" />
            <Text style={[styles.joinButtonText, { color: '#0FEA95' }]}>Joined</Text>
          </View>
        ) : isFull ? (
          <View style={[styles.joinButton, { backgroundColor: '#2C2C2E' }]}>
            <Text style={[styles.joinButtonText, { color: '#FF453A' }]}>Full</Text>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={joining}>
              {joining
                ? <ActivityIndicator color="#1C1C1E" />
                : <Text style={styles.joinButtonText}>Join Game</Text>}
            </TouchableOpacity>
          </Animated.View>
        )
      ) : (
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: '#2C2C2E', flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
          onPress={() => router.push({
            pathname: '/court-detail' as any,
            params: {
              placeId: court.place_id,
              name: court.name,
              sport: court.sport_type ?? '',
              vicinity: court.vicinity ?? '',
            },
          })}
        >
          <Ionicons name="information-circle-outline" size={16} color="#0FEA95" />
          <Text style={[styles.joinButtonText, { color: '#0FEA95' }]}>View Details</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FilterChip({
  label, isActive, onPress, chipStyle, textStyle, activeChipStyle, activeTextStyle,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  chipStyle: any;
  textStyle: any;
  activeChipStyle: any;
  activeTextStyle: any;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.94, scaleUp: 1.0, stiffness: 400, damping: 18,
  });
  return (
    <ReAnimated.View style={animatedStyle}>
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

export default function HomeScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [courts, setCourts] = useState<MapItem[]>([]);
  const [games, setGames] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<MapItem | null>(null);
  const lastCourtRef = useRef<MapItem | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [currentDelta, setCurrentDelta] = useState(0.05);
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string>('');

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<GeoResult[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [recentSearches, setRecentSearches] = useState<GeoResult[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 32.0853,
    longitude: 34.7818,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Tab entrance fade
  const tabOpacity = useSharedValue(0);
  const tabFadeStyle = useAnimatedStyle(() => ({ opacity: tabOpacity.value }));

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

  useEffect(() => {
    if (selectedCourt) {
      lastCourtRef.current = selectedCourt;
      setIsCardVisible(true);
      cardY.value = 30;
      cardOpacity.value = 0;
      cardY.value = withSpring(0, { damping: 16, stiffness: 220 });
      cardOpacity.value = withTiming(1, { duration: 200 });
    } else if (isCardVisible) {
      // Animate out, then unmount. lastCourtRef keeps the data alive during exit.
      cardY.value = withTiming(30, { duration: 200 });
      cardOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setIsCardVisible)(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourt]);

  const isPastGame = (scheduledTime: string | null) => {
    if (!scheduledTime) return false;
    const d = new Date(scheduledTime);
    return !isNaN(d.getTime()) && d < new Date();
  };

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then(raw => { if (raw) setRecentSearches(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);
  };

  const handleSelectPlace = async (place: GeoResult) => {
    Keyboard.dismiss();
    setSearchExpanded(false);
    setSearchQuery('');
    setSearchResults([]);
    if (place.lat && place.lng && !isNaN(place.lat) && !isNaN(place.lng)) {
      mapRef.current?.animateToRegion({
        latitude: place.lat,
        longitude: place.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
    // Save to recent searches (keep last 5, no duplicates)
    setRecentSearches(prev => {
      const next = [place, ...prev.filter(r => r.name !== place.name)].slice(0, 5);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location permission denied', 'Showing courts in Tel Aviv by default');
          await fetchCourts(32.0853, 34.7818);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        setMapRegion({ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        await fetchCourts(latitude, longitude);
      } catch (err) {
        console.warn('Location error:', err);
        await fetchCourts(32.0853, 34.7818);
      }
    };
    initLocation();
  }, []);

  const fetchCourts = async (lat: number, lng: number) => {
    try {
      const res = await apiFetch(`/api/courts/nearby?lat=${lat}&lng=${lng}`, { token });
      const data = await res.json();
      if (data.success) setCourts(data.courts);
    } catch (err) {
      console.warn('Courts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };


  useFocusEffect(
    useCallback(() => {
      const fetchGames = async () => {
        try {
          const res = await apiFetch('/api/games', { token });
          const data = await res.json();
          if (data.success) {
            // Strip base64 photos — not used on the map, keeping them in memory causes crashes
            setGames(data.games.map((g: any) => {
              const { photo: _p, post_game_photo: _pp, ...rest } = g;
              return rest;
            }));
          }
        } catch (err) {
          console.warn('Games fetch error:', err);
        }
      };
      const fetchMe = async () => {
        try {
          const res = await apiFetch('/api/users/me', { token });
          const data = await res.json();
          if (data.success) {
            setMyAvatar(data.user.avatar ?? null);
            setMyUsername(data.user.username ?? '');
          }
        } catch {}
      };
      const panToNewGame = async () => {
        try {
          const raw = await AsyncStorage.getItem(PENDING_MAP_PAN_KEY);
          if (!raw) return;
          await AsyncStorage.removeItem(PENDING_MAP_PAN_KEY);
          const { lat, lng } = JSON.parse(raw);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 600);
          }, 400);
        } catch {}
      };
      fetchGames();
      fetchMe();
      panToNewGame();
    }, [token])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
        <Text style={{ marginTop: 15, color: '#A0A0A0', fontSize: 16 }}>Finding courts near you...</Text>
      </View>
    );
  }

  const activeGames = games.filter(g => !isPastGame(g.scheduled_time ?? null));
  const filteredGames = sportFilter === 'all'
    ? activeGames
    : activeGames.filter(g => g.sport_type === sportFilter);

  const displayedCourts = (() => {
    if (activeFilter === 'games') return [];
    // In "All" mode, hide courts when zoomed out to reduce clutter
    if (activeFilter === 'all' && currentDelta > 0.035) return [];
    // Apply sport sub-filter to courts too
    if (sportFilter !== 'all') return courts.filter(c => c.sport_type === sportFilter);
    return courts;
  })();

  const clusteredGames  = activeFilter === 'courts' ? [] : clusterGames(filteredGames, currentDelta);

  const showSportFilter = activeFilter !== 'courts';
  const visibleGameCount = filteredGames.length;

  return (
    <ReAnimated.View style={[styles.container, tabFadeStyle]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={(r) => setCurrentDelta(r.latitudeDelta)}
        onPress={(e) => {
          if (isSelectingLocation) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setIsSelectingLocation(false);
            router.push({ pathname: '/modal', params: { lat: latitude, lng: longitude } });
          } else {
            setSelectedCourt(null);
          }
        }}
      >
        {/* Court / venue markers */}
        {displayedCourts.map((item) => {
          const { lat, lng } = item.geometry.location;
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
          const sportStyle = getSportStyle(item.sport_type);
          const vt = item.venue_type ?? 'court';
          // Gyms & studios: solid dark background (indoor facility feel)
          // Courts: hollow border-only ring (outdoor, open)
          const isIndoor = vt === 'gym' || vt === 'studio';
          return (
            <Marker
              key={item.place_id}
              coordinate={{ latitude: item.geometry.location.lat, longitude: item.geometry.location.lng }}
              onPress={(e) => { e.stopPropagation(); if (!isSelectingLocation) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCourt(item); } }}
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
            </Marker>
          );
        })}

        {/* Game markers (clustered) */}
        {clusteredGames.map((item) => {
          const { lat, lng } = item.geometry.location;
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
          const sportStyle = getSportStyle(item.sport_type);
          if (item._isCluster) {
            const clusterColor = SPORT_COLORS[item.sport_type] ?? Colors.accent;
            return (
              <Marker
                key={item.place_id}
                coordinate={{ latitude: item.geometry.location.lat, longitude: item.geometry.location.lng }}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!isSelectingLocation) {
                    mapRef.current?.animateToRegion({
                      latitude: item.geometry.location.lat,
                      longitude: item.geometry.location.lng,
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
              </Marker>
            );
          }
          const joined = !!item.is_joined;
          return (
            <Marker
              key={item.place_id}
              coordinate={{ latitude: item.geometry.location.lat, longitude: item.geometry.location.lng }}
              onPress={(e) => { e.stopPropagation(); if (!isSelectingLocation) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedCourt(item); } }}
            >
              <View style={styles.markerWrapper}>
                <View style={[
                  styles.markerIconBgGame,
                  { borderColor: joined ? '#0FEA95' : sportStyle.color },
                  joined && { backgroundColor: '#0FEA9518' },
                ]}>
                  <MaterialCommunityIcons name={sportStyle.icon} size={22} color={joined ? '#0FEA95' : sportStyle.color} />
                  {joined ? (
                    <View style={styles.markerJoinedBadge}>
                      <Ionicons name="checkmark" size={7} color="#1C1C1E" />
                    </View>
                  ) : (
                    <View style={[styles.markerGameDot, { backgroundColor: sportStyle.color }]} />
                  )}
                </View>
                <View style={[styles.markerPointer, { backgroundColor: joined ? '#0FEA95' : sportStyle.color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView style={styles.headerContainer} pointerEvents="box-none">
        {isSelectingLocation ? (
          <View style={[styles.header, { backgroundColor: '#0FEA95' }]}>
            <Text style={[styles.headerTitle, { color: '#1C1C1E', fontSize: 18, textAlign: 'center', flex: 1 }]}>
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
                  <TouchableOpacity
                    onPress={() => { setSearchExpanded(false); setSearchQuery(''); setSearchResults([]); Keyboard.dismiss(); }}
                    style={{ paddingLeft: 8 }}
                  >
                    <Text style={{ color: '#1C1C1E', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
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
                      <Ionicons name="search-outline" size={22} color="#3A3A3C" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile' as any)}>
                      {myAvatar ? (
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${myAvatar}` }}
                          style={styles.profileAvatar}
                        />
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

            {/* Search dropdown */}
            {searchExpanded && (searchQuery.length >= 2 || recentSearches.length > 0) && (
              <View style={styles.searchDropdown}>
                {searchQuery.length < 2 && recentSearches.length > 0 && (
                  <>
                    <Text style={styles.searchDropdownLabel}>Recent</Text>
                    {recentSearches.map(place => (
                      <TouchableOpacity key={place.name} style={styles.searchDropdownItem} onPress={() => handleSelectPlace(place)}>
                        <Ionicons name="time-outline" size={15} color="#8E8E93" />
                        <Text style={styles.searchDropdownText} numberOfLines={1}>{place.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {searchQuery.length >= 2 && searchLoading && (
                  <View style={styles.searchDropdownItem}>
                    <ActivityIndicator size="small" color="#0FEA95" />
                    <Text style={[styles.searchDropdownText, { color: '#8E8E93' }]}>Searching...</Text>
                  </View>
                )}
                {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <View style={styles.searchDropdownItem}>
                    <Ionicons name="search-outline" size={15} color="#8E8E93" />
                    <Text style={[styles.searchDropdownText, { color: '#8E8E93' }]}>No results found</Text>
                  </View>
                )}
                {searchResults.map(place => (
                  <TouchableOpacity key={place.name} style={styles.searchDropdownItem} onPress={() => handleSelectPlace(place)}>
                    <Ionicons name="location-outline" size={15} color="#0FEA95" />
                    <Text style={styles.searchDropdownText} numberOfLines={1}>{place.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}


            {/* Main filter row */}
            <View style={styles.filtersWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'games', label: 'Community Games' },
                  { key: 'courts', label: 'Courts' },
                ].map(f => (
                  <FilterChip
                    key={f.key}
                    label={f.label}
                    isActive={activeFilter === f.key}
                    onPress={() => { setActiveFilter(f.key); setSportFilter('all'); }}
                    chipStyle={styles.filterChip}
                    textStyle={styles.filterText}
                    activeChipStyle={styles.filterChipActive}
                    activeTextStyle={styles.filterTextActive}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Sport sub-filter row */}
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

      {!selectedCourt && (
        isSelectingLocation ? (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: '#FF453A', width: 'auto', paddingHorizontal: 20, borderRadius: 20 }]}
            onPress={() => setIsSelectingLocation(false)}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <>
            {showAddMenu && (
              <View style={styles.addMenu}>
                <TouchableOpacity
                  style={styles.addMenuItem}
                  onPress={() => { setShowAddMenu(false); setIsSelectingLocation(true); }}
                >
                  <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.addMenuText}>Drop Pin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addMenuItem}
                  onPress={() => setShowCourtPicker(true)}
                >
                  <Ionicons name="business-outline" size={20} color="#0FEA95" />
                  <Text style={[styles.addMenuText, { color: '#0FEA95' }]}>Choose Court</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.fab, showAddMenu && { backgroundColor: '#FF453A' }]}
              onPress={() => { setShowAddMenu(v => !v); setShowCourtPicker(false); }}
            >
              <Ionicons name={showAddMenu ? 'close' : 'add'} size={32} color="white" />
            </TouchableOpacity>
          </>
        )
      )}

      {showCourtPicker && (
        <View style={styles.courtPickerSheet}>
          <View style={styles.courtPickerHeader}>
            <Text style={styles.courtPickerTitle}>Choose a Court</Text>
            <TouchableOpacity onPress={() => { setShowCourtPicker(false); setShowAddMenu(false); }}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={courts}
            keyExtractor={(item) => item.place_id}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => {
              const { icon, color } = getSportStyle(item.sport_type);
              return (
                <TouchableOpacity
                  style={styles.courtPickerItem}
                  onPress={() => {
                    setShowCourtPicker(false);
                    setShowAddMenu(false);
                    router.push({
                      pathname: '/modal',
                      params: {
                        lat: item.geometry.location.lat,
                        lng: item.geometry.location.lng,
                        existingLocationDesc: item.name,
                      },
                    });
                  }}
                >
                  <View style={[styles.courtPickerIcon, { backgroundColor: color + '22', borderColor: color }]}>
                    <MaterialCommunityIcons name={icon} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courtPickerName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.courtPickerAddress} numberOfLines={1}>{item.vicinity}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#48484A" />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' },

  markerWrapper: { alignItems: 'center', justifyContent: 'center' },
  // Court markers — smaller and lighter (secondary visual weight)
  markerIconBg: { backgroundColor: 'rgba(255,255,255,0.92)', padding: 4, borderRadius: 14, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 4 },
  // Game markers — more prominent (primary visual weight)
  markerIconBgGame: { backgroundColor: '#1C1C1E', padding: 6, borderRadius: 20, borderWidth: 2.5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 5, elevation: 7 },
  markerGameDot:    { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#1C1C1E' },
  markerJoinedBadge:{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#0FEA95', borderWidth: 1.5, borderColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center' },
  markerPointer: { width: 3, height: 6, marginTop: -1 },
  clusterMarker: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bg + 'EB', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 10 },
  clusterInner:  { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  clusterText:   { color: Colors.bg, fontWeight: '900', fontSize: 14 },

  headerContainer: { position: 'absolute', top: 0, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.95)', marginHorizontal: 20, marginTop: 15, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  searchInput: { flex: 1, fontSize: 15, color: '#1C1C1E', paddingVertical: 4 },
  searchDropdown: { marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 16, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 },
  searchDropdownLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', paddingHorizontal: 16, paddingVertical: 4, textTransform: 'uppercase' },
  searchDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  searchDropdownText: { flex: 1, fontSize: 14, color: '#1C1C1E', fontWeight: '500' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1C1C1E' },
  gameCountBadge: { backgroundColor: '#0FEA9522', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#0FEA9555' },
  gameCountText: { color: '#0FEA95', fontSize: 12, fontWeight: '800' },
  profileButton: { marginLeft: 8 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  profileAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  profileAvatarLetter: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  filtersWrapper: { marginTop: 10, paddingHorizontal: 5 },
  sportFiltersWrapper: { marginTop: 6, paddingHorizontal: 5 },
  filtersScroll: { paddingHorizontal: 15, paddingBottom: 5 },

  filterChip: { backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#E5E5EA' },
  filterChipActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  filterText: { color: '#3A3A3C', fontSize: 14, fontWeight: 'bold' },
  filterTextActive: { color: '#1C1C1E' },

  sportChip: { width: 38, height: 38, borderRadius: 19, marginRight: 8, borderWidth: 1.5, borderColor: Colors.textSub + '66', backgroundColor: Colors.text + 'E0', justifyContent: 'center', alignItems: 'center' },
  sportChipActiveAll: { backgroundColor: Colors.bg, borderColor: Colors.bg },
  sportActiveLabel: { color: Colors.text + 'B3', fontSize: 11, fontWeight: '700', paddingHorizontal: 15, marginBottom: 4, letterSpacing: 0.3 },

  bottomCardAnimWrapper: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.9 },
  bottomCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  sportBadgeText: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  urgentBadge: { backgroundColor: '#FF453A22', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#FF453A66' },
  urgentBadgeText: { color: '#FF453A', fontSize: 11, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9C4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, height: 25 },
  ratingText: { fontSize: 14, fontWeight: '700', marginLeft: 4, color: '#FBC02D' },
  cardAddress: { fontSize: 14, color: '#636366', marginBottom: 10, lineHeight: 22 },
  playersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  playersText: { fontSize: 13, color: '#8E8E93', fontWeight: '600' },

  participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  participantAvatars: { flexDirection: 'row', alignItems: 'center' },
  avatarMiniWrap: {},
  avatarMiniMore: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface2, borderColor: Colors.textMuted },
  avatarMiniMoreText: { color: Colors.textSub, fontSize: 10, fontWeight: '800' },
  participantLabel: { flex: 1, fontSize: 12, color: Colors.textMuted },

  joinButton: { backgroundColor: '#0FEA95', paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  joinButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1E' },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#1C1C1E', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },

  addMenu: { position: 'absolute', bottom: 105, right: 20, gap: 10 },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C1E', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addMenuText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  courtPickerSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 12 },
  courtPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  courtPickerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  courtPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  courtPickerIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  courtPickerName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  courtPickerAddress: { fontSize: 12, color: '#636366', marginTop: 2 },
});
