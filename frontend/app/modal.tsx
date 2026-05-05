import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../constants/api';

export default function GameFormModal() {
  const router = useRouter();
  const params = useGlobalSearchParams();
  const { token } = useAuth();

  const isEdit = !!params.gameId;
  const gameId = params.gameId ? parseInt(params.gameId as string) : null;

  const [sport, setSport] = useState((params.existingSport as string) || 'basketball');
  const [level, setLevel] = useState(params.existingLevel ? parseInt(params.existingLevel as string) : 3);
  const [locationDesc, setLocationDesc] = useState((params.existingLocationDesc as string) || '');
  const [equipment, setEquipment] = useState((params.existingEquipment as string) || '');
  const [maxPlayers, setMaxPlayers] = useState((params.existingMaxPlayers as string) || '');
  const [loading, setLoading] = useState(false);

  const parseInitialDate = (): Date | null => {
    if (!params.existingTime) return null;
    const d = new Date(params.existingTime as string);
    return isNaN(d.getTime()) ? null : d;
  };
  const [scheduledDate, setScheduledDate] = useState<Date | null>(parseInitialDate);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateLabel = scheduledDate
    ? scheduledDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'בחר תאריך';
  const timeLabel = scheduledDate
    ? `${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}`
    : 'בחר שעה';
  // Use local time components (Israel timezone) — NOT toISOString() which returns UTC
  const scheduledTimeStr = scheduledDate
    ? `${scheduledDate.getFullYear()}-${pad(scheduledDate.getMonth() + 1)}-${pad(scheduledDate.getDate())} ${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}`
    : null;

  const handleSubmit = async () => {
    if (!token) return Alert.alert('Error', 'You must be logged in');

    if (scheduledDate && scheduledDate <= new Date())
      return Alert.alert('Invalid Time', 'Scheduled time must be in the future');

    if (maxPlayers && parseInt(maxPlayers) < 2)
      return Alert.alert('Invalid Players', 'Max players must be at least 2');

    setLoading(true);
    try {
      const url    = isEdit ? `${API_BASE}/api/games/${gameId}` : `${API_BASE}/api/games`;
      const method = isEdit ? 'PUT' : 'POST';
      const body: Record<string, any> = {
        sport_type:      sport,
        level,
        location_desc:   locationDesc  || null,
        scheduled_time:  scheduledTimeStr,
        equipment_notes: equipment     || null,
        max_players:     maxPlayers    ? parseInt(maxPlayers) : null,
      };
      if (!isEdit) {
        body.latitude  = parseFloat(params.lat as string);
        body.longitude = parseFloat(params.lng as string);
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.title}>{isEdit ? 'Edit Game' : 'Create New Game'}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={32} color="#3A3A3C" />
          </TouchableOpacity>
        </View>

        {/* Sport */}
        <Text style={styles.label}>What sport?</Text>
        <View style={styles.sportsRow}>
          {(['basketball', 'tennis', 'volleyball', 'football'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sportBtn, sport === s && styles.sportBtnActive]}
              onPress={() => setSport(s)}
            >
              <MaterialCommunityIcons
                name={s === 'football' ? 'soccer' : s}
                size={30}
                color={sport === s ? '#1C1C1E' : '#8E8E93'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Level */}
        <Text style={styles.label}>Skill Level (1–5)</Text>
        <View style={styles.levelContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.levelBtn, level === num && styles.levelBtnActive]}
              onPress={() => setLevel(num)}
            >
              <Text style={[styles.levelText, level === num && styles.levelTextActive]}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location */}
        <Text style={styles.label}>Location Notes (e.g. North court)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Add a short description"
            placeholderTextColor="#8E8E93"
            value={locationDesc}
            onChangeText={setLocationDesc}
          />
        </View>

        {/* Date / Time */}
        <Text style={styles.label}>When does it start?</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerMode('date')}>
            <Ionicons name="calendar-outline" size={18} color="#8E8E93" />
            <Text style={[styles.pickerBtnText, scheduledDate != null && styles.pickerBtnTextSet]}>
              {dateLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerMode('time')}>
            <Ionicons name="time-outline" size={18} color="#8E8E93" />
            <Text style={[styles.pickerBtnText, scheduledDate != null && styles.pickerBtnTextSet]}>
              {timeLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {pickerMode != null && (
          <DateTimePicker
            value={scheduledDate ?? new Date(Date.now() + 3_600_000)}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
            themeVariant="dark"
            onChange={(_, selected) => {
              if (Platform.OS === 'android') setPickerMode(null);
              if (!selected) return;
              setScheduledDate((prev) => {
                const base = new Date(prev ?? Date.now() + 3_600_000);
                if (pickerMode === 'date') {
                  base.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                } else {
                  base.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                }
                return base;
              });
            }}
          />
        )}
        {pickerMode != null && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setPickerMode(null)}>
            <Text style={styles.pickerDoneBtnText}>Done</Text>
          </TouchableOpacity>
        )}

        {/* Max Players */}
        <Text style={styles.label}>Max Players</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="people-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 10"
            placeholderTextColor="#8E8E93"
            value={maxPlayers}
            onChangeText={setMaxPlayers}
            keyboardType="number-pad"
          />
        </View>

        {/* Equipment */}
        <Text style={styles.label}>Equipment Notes (optional)</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="bag-add-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. No ball — who's bringing one?"
            placeholderTextColor="#8E8E93"
            value={equipment}
            onChangeText={setEquipment}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#1C1C1E" />
            : <Text style={styles.submitButtonText}>{isEdit ? 'Save Changes' : 'Post Game on Map'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1C1C1E' },
  scrollContent:{ padding: 20, paddingBottom: 40 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 10 },
  title:        { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  label:        { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

  sportsRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  sportBtn:     { width: 60, height: 60, borderRadius: 20, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  sportBtnActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },

  levelContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  levelBtn:     { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  levelBtnActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  levelText:    { color: '#8E8E93', fontSize: 16, fontWeight: 'bold' },
  levelTextActive: { color: '#1C1C1E' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 15, marginBottom: 25, paddingHorizontal: 15, height: 55 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, color: '#FFFFFF', fontSize: 16 },

  dateTimeRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pickerBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2C2C2E', borderRadius: 15, paddingHorizontal: 14, height: 55 },
  pickerBtnText:    { color: '#636366', fontSize: 13, flex: 1 },
  pickerBtnTextSet: { color: '#FFFFFF', fontWeight: '600' },
  pickerDoneBtn:    { alignSelf: 'flex-end', marginBottom: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#0FEA95', borderRadius: 10 },
  pickerDoneBtnText:{ color: '#1C1C1E', fontWeight: '800', fontSize: 14 },

  submitButton: { backgroundColor: '#0FEA95', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  submitButtonText: { color: '#1C1C1E', fontSize: 18, fontWeight: 'bold' },
});
