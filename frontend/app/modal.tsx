import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function CreateGameModal() {
  const router = useRouter();
  const { lat, lng } = useGlobalSearchParams(); // קולט את הקואורדינטות מהלחיצה על המפה!
  
  const [sport, setSport] = useState('basketball');
  const [level, setLevel] = useState(3);
  const [locationDesc, setLocationDesc] = useState(''); 
  const [time, setTime] = useState('');
  const [equipment, setEquipment] = useState('');

  const handleCreateGame = () => {
    const newGame = {
      place_id: Math.random().toString(), 
      name: `משחק ${sport} קהילתי!`,
      sport_type: sport,
      rating: level.toString(),
      vicinity: `${locationDesc ? locationDesc + '\n' : ''}🕒 ${time || 'היום'} | ${equipment ? '🎒 ' + equipment : ''}`,
      geometry: {
        location: {
          // שימוש בקואורדינטות האמיתיות שהמשתמש בחר במפה!
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        }
      },
      isLocalGame: true,
    };

    console.log("Creating Game locally:", newGame);

    router.back();
    
    setTimeout(() => {
      router.navigate({ 
        pathname: '/(tabs)', 
        params: { newGameObj: JSON.stringify(newGame) } 
      });
    }, 100);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>יצירת משחק חדש</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={32} color="#3A3A3C" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>איזה ספורט משחקים?</Text>
        <View style={styles.sportsRow}>
          <TouchableOpacity style={[styles.sportBtn, sport === 'basketball' && styles.sportBtnActive]} onPress={() => setSport('basketball')}>
            <MaterialCommunityIcons name="basketball" size={30} color={sport === 'basketball' ? '#1C1C1E' : '#8E8E93'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sportBtn, sport === 'tennis' && styles.sportBtnActive]} onPress={() => setSport('tennis')}>
            <MaterialCommunityIcons name="tennis" size={30} color={sport === 'tennis' ? '#1C1C1E' : '#8E8E93'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sportBtn, sport === 'volleyball' && styles.sportBtnActive]} onPress={() => setSport('volleyball')}>
            <MaterialCommunityIcons name="volleyball" size={30} color={sport === 'volleyball' ? '#1C1C1E' : '#8E8E93'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sportBtn, sport === 'football' && styles.sportBtnActive]} onPress={() => setSport('football')}>
            <MaterialCommunityIcons name="soccer" size={30} color={sport === 'football' ? '#1C1C1E' : '#8E8E93'} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>רמת משחק נדרשת (1-5)</Text>
        <View style={styles.levelContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity key={num} style={[styles.levelBtn, level === num && styles.levelBtnActive]} onPress={() => setLevel(num)}>
              <Text style={[styles.levelText, level === num && styles.levelTextActive]}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>הערות מיקום (למשל: מגרש צפוני)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="הוסף תיאור קצר" placeholderTextColor="#8E8E93" value={locationDesc} onChangeText={setLocationDesc} />
        </View>

        <Text style={styles.label}>מתי מתחילים? (למשל: 19:00)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="time-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="שעה ותאריך" placeholderTextColor="#8E8E93" value={time} onChangeText={setTime} />
        </View>

        <Text style={styles.label}>הערות ציוד (אופציונלי)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="bag-add-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="למשל: חסר כדור, מי מביא?" placeholderTextColor="#8E8E93" value={equipment} onChangeText={setEquipment} />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleCreateGame}>
          <Text style={styles.submitButtonText}>פתח משחק על המפה</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 10 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'right' },
  sportsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  sportBtn: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  sportBtnActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  levelContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  levelBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  levelBtnActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  levelText: { color: '#8E8E93', fontSize: 16, fontWeight: 'bold' },
  levelTextActive: { color: '#1C1C1E' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 15, marginBottom: 25, paddingHorizontal: 15, height: 55 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, textAlign: 'right' },
  submitButton: { backgroundColor: '#0FEA95', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  submitButtonText: { color: '#1C1C1E', fontSize: 18, fontWeight: 'bold' }
});