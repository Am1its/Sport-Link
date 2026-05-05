import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../constants/api';

export default function CreateGameModal() {
  const router = useRouter();
  const { lat, lng } = useGlobalSearchParams();
  const { token } = useAuth();

  const [sport, setSport] = useState('basketball');
  const [level, setLevel] = useState(3);
  const [locationDesc, setLocationDesc] = useState('');
  const [time, setTime] = useState('');
  const [equipment, setEquipment] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateGame = async () => {
    if (!token) return Alert.alert('Error', 'You must be logged in to create a game');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sport_type: sport,
          level,
          latitude: parseFloat(lat as string),
          longitude: parseFloat(lng as string),
          location_desc: locationDesc || null,
          scheduled_time: time || null,
          equipment_notes: equipment || null,
          max_players: maxPlayers ? parseInt(maxPlayers) : null,
        }),
      });

      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.title}>Create New Game</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={32} color="#3A3A3C" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>What sport?</Text>
        <View style={styles.sportsRow}>
          {(['basketball', 'tennis', 'volleyball', 'football'] as const).map((s) => (
            <TouchableOpacity key={s} style={[styles.sportBtn, sport === s && styles.sportBtnActive]} onPress={() => setSport(s)}>
              <MaterialCommunityIcons
                name={s === 'football' ? 'soccer' : s}
                size={30}
                color={sport === s ? '#1C1C1E' : '#8E8E93'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Skill Level (1–5)</Text>
        <View style={styles.levelContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity key={num} style={[styles.levelBtn, level === num && styles.levelBtnActive]} onPress={() => setLevel(num)}>
              <Text style={[styles.levelText, level === num && styles.levelTextActive]}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Location Notes (e.g. North court)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Add a short description" placeholderTextColor="#8E8E93" value={locationDesc} onChangeText={setLocationDesc} />
        </View>

        <Text style={styles.label}>When does it start? (e.g. 19:00)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="time-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Time and date" placeholderTextColor="#8E8E93" value={time} onChangeText={setTime} />
        </View>

        <Text style={styles.label}>Max Players</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="people-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="e.g. 10" placeholderTextColor="#8E8E93" value={maxPlayers} onChangeText={setMaxPlayers} keyboardType="number-pad" />
        </View>

        <Text style={styles.label}>Equipment Notes (optional)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="bag-add-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="e.g. No ball — who's bringing one?" placeholderTextColor="#8E8E93" value={equipment} onChangeText={setEquipment} />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleCreateGame} disabled={loading}>
          {loading ? <ActivityIndicator color="#1C1C1E" /> : <Text style={styles.submitButtonText}>Post Game on Map</Text>}
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
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
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
  input: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  submitButton: { backgroundColor: '#0FEA95', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  submitButtonText: { color: '#1C1C1E', fontSize: 18, fontWeight: 'bold' },
});
