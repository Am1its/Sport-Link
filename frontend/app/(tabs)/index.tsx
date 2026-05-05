import React, { useState, useEffect, useCallback, ComponentProps, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity, Dimensions, ScrollView, Animated, FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../constants/api';

const { width } = Dimensions.get('window');

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type MapItem = {
  id?: number;
  place_id: string;
  name: string;
  sport_type: string;
  rating: number | string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  isLocalGame?: boolean;
  host_id?: number;
  max_players?: number | null;
  participant_count?: number;
};

const getSportStyle = (type: string): { icon: IconName; color: string } => {
  switch (type) {
    case 'basketball': return { icon: 'basketball', color: '#FF8C00' };
    case 'tennis':     return { icon: 'tennis',     color: '#CCFF00' };
    case 'volleyball': return { icon: 'volleyball', color: '#FFD700' };
    case 'football':   return { icon: 'soccer',     color: '#FFFFFF' };
    default:           return { icon: 'map-marker', color: '#0FEA95' };
  }
};

function BottomCard({ court, userId, token, onJoined }: {
  court: MapItem;
  userId?: number;
  token: string | null;
  onJoined: (newCount: number) => void;
}) {
  const [joining, setJoining] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isOwnGame = court.isLocalGame && court.host_id === userId;
  const isFull = court.max_players != null && (court.participant_count ?? 0) >= court.max_players;
  const playersLabel = court.max_players
    ? `${court.participant_count ?? 0} / ${court.max_players} players`
    : null;

  const springBack = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  const handleJoin = async () => {
    if (!court.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/games/${court.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        springBack();
        return Alert.alert('Error', data.message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onJoined(data.participant_count);
      springBack();
      Alert.alert('You\'re in! 🎉', 'Game added to My Schedule.');
    } catch {
      springBack();
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.bottomCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{court.name}</Text>
          <Text style={styles.sportBadgeText}>{court.sport_type?.toUpperCase()}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{court.rating}</Text>
        </View>
      </View>

      {court.vicinity ? <Text style={styles.cardAddress}>{court.vicinity}</Text> : null}

      {court.isLocalGame && playersLabel && (
        <View style={styles.playersRow}>
          <Ionicons name="people-outline" size={16} color="#8E8E93" />
          <Text style={styles.playersText}>{playersLabel}</Text>
        </View>
      )}

      {court.isLocalGame ? (
        isOwnGame ? (
          <View style={[styles.joinButton, { backgroundColor: '#2C2C2E' }]}>
            <Text style={[styles.joinButtonText, { color: '#0FEA95' }]}>Your Game</Text>
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
        <View style={[styles.joinButton, { backgroundColor: '#2C2C2E' }]}>
          <Text style={[styles.joinButtonText, { color: '#8E8E93' }]}>Public Court</Text>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [courts, setCourts] = useState<MapItem[]>([]);
  const [games, setGames] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<MapItem | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const isPastGame = (scheduledTime: string | null) => {
    if (!scheduledTime) return false;
    const d = new Date(scheduledTime);
    return !isNaN(d.getTime()) && d < new Date();
  };
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 32.0853,
    longitude: 34.7818,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

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
        console.error('Location error:', err);
        await fetchCourts(32.0853, 34.7818);
      }
    };
    initLocation();
  }, []);

  const fetchCourts = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/courts/nearby?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.success) setCourts(data.courts);
    } catch (err) {
      console.error('Courts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchGames = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/games`);
          const data = await res.json();
          if (data.success) setGames(data.games);
        } catch (err) {
          console.error('Games fetch error:', err);
        }
      };
      fetchGames();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
        <Text style={{ marginTop: 15, color: '#A0A0A0', fontSize: 16 }}>Finding courts near you...</Text>
      </View>
    );
  }

  const activeGames = games.filter(g => !isPastGame(g.scheduled_time));

  const getFilteredCourts = () => {
    switch (activeFilter) {
      case 'courts': return courts;
      case 'games':  return activeGames;
      case 'all':
      default:       return [...courts, ...activeGames];
    }
  };

  const displayedCourts = getFilteredCourts();

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
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
        {displayedCourts.map((court) => {
          const sportStyle = getSportStyle(court.sport_type);
          return (
            <Marker
              key={court.place_id}
              coordinate={{ latitude: court.geometry.location.lat, longitude: court.geometry.location.lng }}
              onPress={(e) => { e.stopPropagation(); if (!isSelectingLocation) setSelectedCourt(court); }}
            >
              <View style={styles.markerWrapper}>
                <View style={[styles.markerIconBg, { borderColor: sportStyle.color }]}>
                  <MaterialCommunityIcons name={sportStyle.icon} size={22} color={sportStyle.color} />
                </View>
                <View style={[styles.markerPointer, { backgroundColor: sportStyle.color }]} />
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
              <Text style={styles.headerTitle}>SportLink</Text>
              <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
                <Ionicons name="person-circle" size={36} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.filtersWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                <TouchableOpacity style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]} onPress={() => setActiveFilter('all')}>
                  <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, activeFilter === 'games' && styles.filterChipActive]} onPress={() => setActiveFilter('games')}>
                  <Text style={[styles.filterText, activeFilter === 'games' && styles.filterTextActive]}>Community Games</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, activeFilter === 'courts' && styles.filterChipActive]} onPress={() => setActiveFilter('courts')}>
                  <Text style={[styles.filterText, activeFilter === 'courts' && styles.filterTextActive]}>Courts</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
      </SafeAreaView>

      {selectedCourt && !isSelectingLocation && (
        <BottomCard
          court={selectedCourt}
          userId={user?.id}
          token={token}
          onJoined={(newCount) => {
            setGames((prev) =>
              prev.map((g) => g.id === selectedCourt.id ? { ...g, participant_count: newCount } : g)
            );
            setSelectedCourt((prev) => prev ? { ...prev, participant_count: newCount } : prev);
          }}
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' },
  markerWrapper: { alignItems: 'center', justifyContent: 'center' },
  markerIconBg: { backgroundColor: '#1C1C1E', padding: 6, borderRadius: 22, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  markerPointer: { width: 3, height: 6, marginTop: -1 },
  headerContainer: { position: 'absolute', top: 0, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.95)', marginHorizontal: 20, marginTop: 15, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1C1C1E' },
  profileButton: {},
  filtersWrapper: { marginTop: 15, paddingHorizontal: 5 },
  filtersScroll: { paddingHorizontal: 15, paddingBottom: 5 },
  filterChip: { backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#E5E5EA' },
  filterChipActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  filterText: { color: '#3A3A3C', fontSize: 14, fontWeight: 'bold' },
  filterTextActive: { color: '#1C1C1E' },
  bottomCard: { position: 'absolute', bottom: 30, alignSelf: 'center', width: width * 0.9, backgroundColor: 'white', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  sportBadgeText: { fontSize: 12, color: '#8E8E93', fontWeight: '600', marginTop: 2 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9C4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, height: 25 },
  ratingText: { fontSize: 14, fontWeight: '700', marginLeft: 4, color: '#FBC02D' },
  cardAddress: { fontSize: 14, color: '#636366', marginBottom: 12, lineHeight: 22 },
  playersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  playersText: { fontSize: 13, color: '#8E8E93', fontWeight: '600' },
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
