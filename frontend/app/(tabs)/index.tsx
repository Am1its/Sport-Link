import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// פונקציית עזר לבחירת אייקון וצבע לפי סוג ספורט
const getSportStyle = (type) => {
  switch (type) {
    case 'basketball': 
      return { icon: 'basketball', color: '#FF8C00' }; // כתום כדורסל
    case 'tennis': 
      return { icon: 'tennis', color: '#CCFF00' }; // ירוק טניס זוהר
    case 'volleyball': 
      return { icon: 'volleyball', color: '#FFD700' }; // זהב
    case 'football': 
      return { icon: 'soccer', color: '#FFFFFF' }; // לבן כדורגל
    default: 
      return { icon: 'map-marker', color: '#0FEA95' }; // ירוק SportLink דיפולטיבי
  }
  
};

export default function HomeScreen() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState(null);

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        // ודא שה-IP הזה מעודכן ל-IP של המחשב שלך ברשת הביתית
        const response = await fetch('http://10.0.0.11:3000/api/courts/nearby');
        const data = await response.json();
        
        if (data.success) {
          setCourts(data.courts);
        }
      } catch (error) {
        console.error("Fetch error:", error);
        Alert.alert("שגיאת חיבור", "לא הצלחנו להתחבר לשרת ה-Backend.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourts();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
        <Text style={{marginTop: 15, color: '#A0A0A0', fontSize: 16}}>מחפש מגרשים באזור...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* המפה */}
      <MapView 
        style={styles.map}
        initialRegion={{
          latitude: 32.0853,
          longitude: 34.7818,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={() => setSelectedCourt(null)}
      >
        {courts.map((court) => {
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
                setSelectedCourt(court);
              }}
            >
              {/* סיכה מותאמת אישית עם אייקון ספורט */}
              <View style={styles.markerWrapper}>
                <View style={[styles.markerIconBg, { borderColor: sportStyle.color }]}>
                  <MaterialCommunityIcons 
                    name={sportStyle.icon} 
                    size={22} 
                    color={sportStyle.color} 
                  />
                </View>
                <View style={[styles.markerPointer, { backgroundColor: sportStyle.color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Header עליון צף */}
      <SafeAreaView style={styles.headerContainer} pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SportLink</Text>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle" size={36} color="#333" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* כרטיסיית מידע תחתונה (מופיעה רק בבחירת מגרש) */}
      {selectedCourt && (
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
          
          <Text style={styles.cardAddress}>
            <Ionicons name="location-outline" size={14} /> {selectedCourt.vicinity}
          </Text>
          
          <TouchableOpacity 
            style={styles.joinButton}
            onPress={() => Alert.alert("Join Game", `Joining the next game at ${selectedCourt.name}...`)}
          >
            <Text style={styles.joinButtonText}>הצטרף למשחק הקרוב</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* כפתור פלוס צף ליצירת משחק */}
      {!selectedCourt && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => Alert.alert("New Game", "Opening game creation form...")}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' },
  
  // Marker Styles
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIconBg: {
    backgroundColor: '#1C1C1E',
    padding: 6,
    borderRadius: 22,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  markerPointer: {
    width: 3,
    height: 6,
    marginTop: -1,
  },

  // Header Styles
  headerContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C1C1E',
  },

  // Card Styles
  bottomCard: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: width * 0.9,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  sportBadgeText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    height: 25,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
    color: '#FBC02D',
  },
  cardAddress: {
    fontSize: 14,
    color: '#636366',
    marginBottom: 20,
  },
  joinButton: {
    backgroundColor: '#0FEA95',
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },

  // FAB Style
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    backgroundColor: '#1C1C1E',
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0FEA95',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});