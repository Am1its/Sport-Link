import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function App() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        // שים לב! תחליף את הכתובת הבאה ב-IP של המחשב שלך
        const response = await fetch('http://192.168.2.102:3000/api/courts/nearby');
        const data = await response.json();
        
        if (data.success) {
          setCourts(data.courts);
        }
      } catch (error) {
        console.error("Fetch error:", error);
        Alert.alert("שגיאת חיבור", "לא הצלחנו להתחבר לשרת. בדוק את ה-IP!");
      } finally {
        setLoading(false);
      }
    };

    fetchCourts();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{marginTop: 10}}>טוען מגרשים בתל אביב...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* המפה מתרכזת אוטומטית על תל אביב */}
      <MapView 
        style={styles.map}
        initialRegion={{
          latitude: 32.0853,
          longitude: 34.7818,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {/* עוברים על כל המגרשים שקיבלנו מהשרת ומציירים סיכה לכל אחד */}
        {courts.map((court) => (
          <Marker
            key={court.place_id}
            coordinate={{
              latitude: court.geometry.location.lat,
              longitude: court.geometry.location.lng,
            }}
            title={court.name}
            description={court.vicinity}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});