import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView, Dimensions, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';

const { width } = Dimensions.get('window');

const getSportStyle = (type) => {
  switch (type) {
    case 'basketball': return { icon: 'basketball', color: '#FF8C00' }; 
    case 'tennis': return { icon: 'tennis', color: '#CCFF00' }; 
    case 'volleyball': return { icon: 'volleyball', color: '#FFD700' }; 
    case 'football': return { icon: 'soccer', color: '#FFFFFF' }; 
    default: return { icon: 'map-marker', color: '#0FEA95' }; 
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams(); 
  
  const [courts, setCourts] = useState([]); 
  const [localCourts, setLocalCourts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState(null);
  
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  
  // הוספנו סטייט חדש לניהול הסינון במפה
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'courts' | 'games'

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const response = await fetch('http://10.0.0.15:3000/api/courts/nearby');
        const data = await response.json();
        if (data.success) {
          setCourts(data.courts);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourts();
  }, []);

  useEffect(() => {
    if (params.newGameObj) {
      try {
        const gameData = JSON.parse(params.newGameObj);
        setLocalCourts((prevCourts) => {
          const isExists = prevCourts.find(c => c.place_id === gameData.place_id);
          if (!isExists) return [...prevCourts, gameData];
          return prevCourts;
        });
      } catch (e) {
        console.error("Error parsing new game:", e);
      }
    }
  }, [params.newGameObj]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
        <Text style={{marginTop: 15, color: '#A0A0A0', fontSize: 16}}>מחפש מגרשים באזור...</Text>
      </View>
    );
  }

  // לוגיקת הסינון: מחליטים מה להציג על המפה לפי כפתור הסינון שנבחר
  const getFilteredCourts = () => {
    switch (activeFilter) {
      case 'courts': return courts;
      case 'games': return localCourts;
      case 'all': 
      default: 
        return [...courts, ...localCourts];
    }
  };

  const displayedCourts = getFilteredCourts();

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        initialRegion={{
          latitude: 32.0853,
          longitude: 34.7818,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={(e) => {
          if (isSelectingLocation) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setIsSelectingLocation(false); 
            router.push({
              pathname: '/modal',
              params: { lat: latitude, lng: longitude }
            });
          } else {
            setSelectedCourt(null);
          }
        }}
      >
        {/* שימוש במערך המסונן במקום בכל המגרשים */}
        {displayedCourts.map((court) => {
          const sportStyle = getSportStyle(court.sport_type);
          return (
            <Marker
              key={court.place_id}
              coordinate={{
                latitude: court.geometry.location.lat,
                longitude: court.geometry.location.lng,
              }}
              onPress={(e) => {
                e.stopPropagation();
                if (!isSelectingLocation) setSelectedCourt(court);
              }}
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
              📍 לחץ על המפה כדי להציב סיכה
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

            {/* שורת הפילטרים החדשה */}
            <View style={styles.filtersWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                <TouchableOpacity 
                  style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
                  onPress={() => setActiveFilter('all')}
                >
                  <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>הכל</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.filterChip, activeFilter === 'games' && styles.filterChipActive]}
                  onPress={() => setActiveFilter('games')}
                >
                  <Text style={[styles.filterText, activeFilter === 'games' && styles.filterTextActive]}>משחקים קהילתיים</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.filterChip, activeFilter === 'courts' && styles.filterChipActive]}
                  onPress={() => setActiveFilter('courts')}
                >
                  <Text style={[styles.filterText, activeFilter === 'courts' && styles.filterTextActive]}>מגרשים פנויים</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
      </SafeAreaView>

      {selectedCourt && !isSelectingLocation && (
        <View style={styles.bottomCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{selectedCourt.name}</Text>
              <Text style={styles.sportBadgeText}>{selectedCourt.sport_type?.toUpperCase()}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{selectedCourt.rating}</Text>
            </View>
          </View>
          <Text style={styles.cardAddress}>{selectedCourt.vicinity}</Text>
          <TouchableOpacity style={styles.joinButton} onPress={() => Alert.alert("Join Game", `Joining game...`)}>
            <Text style={styles.joinButtonText}>הצטרף למשחק הקרוב</Text>
          </TouchableOpacity>
        </View>
      )}

      {!selectedCourt && (
        isSelectingLocation ? (
          <TouchableOpacity style={[styles.fab, { backgroundColor: '#FF453A', width: 'auto', paddingHorizontal: 20, borderRadius: 20 }]} onPress={() => setIsSelectingLocation(false)}>
            <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>ביטול בחירה</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.fab} onPress={() => setIsSelectingLocation(true)}>
            <Ionicons name="add" size={32} color="white" />
          </TouchableOpacity>
        )
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
  
  // סגנונות חדשים לפילטרים
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
  cardAddress: { fontSize: 14, color: '#636366', marginBottom: 20, lineHeight: 22 },
  joinButton: { backgroundColor: '#0FEA95', paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  joinButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1E' },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#1C1C1E', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
});