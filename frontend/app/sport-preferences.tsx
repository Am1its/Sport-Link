import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SPORTS = [
  { key: 'basketball', label: 'Basketball', icon: 'basketball', color: '#FF8C00' },
  { key: 'tennis',     label: 'Tennis',     icon: 'tennis',     color: '#CCFF00' },
  { key: 'volleyball', label: 'Volleyball', icon: 'volleyball', color: '#FFD700' },
  { key: 'football',   label: 'Football',   icon: 'soccer',     color: '#FFFFFF' },
] as const;

const LEVELS = ['Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro'];
const PREFS_KEY = 'sport_preferences';

type Prefs = {
  sports: Record<string, boolean>;
  level: string;
};

const defaultPrefs: Prefs = {
  sports: { basketball: true, tennis: false, volleyball: false, football: false },
  level: 'Casual',
};

export default function SportPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) setPrefs(JSON.parse(raw));
    });
  }, []);

  const toggleSport = (key: string) => {
    setPrefs(prev => ({ ...prev, sports: { ...prev.sports, [key]: !prev.sports[key] } }));
    setSaved(false);
  };

  const setLevel = (level: string) => {
    setPrefs(prev => ({ ...prev, level }));
    setSaved(false);
  };

  const handleSave = async () => {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Sport Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>Your Sports</Text>
        <View style={styles.card}>
          {SPORTS.map((sport, idx) => (
            <View key={sport.key} style={[styles.row, idx < SPORTS.length - 1 && styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: sport.color + '22' }]}>
                  <MaterialCommunityIcons name={sport.icon as any} size={22} color={sport.color} />
                </View>
                <Text style={styles.rowLabel}>{sport.label}</Text>
              </View>
              <Switch
                value={!!prefs.sports[sport.key]}
                onValueChange={() => toggleSport(sport.key)}
                trackColor={{ false: '#3A3A3C', true: '#0FEA9560' }}
                thumbColor={prefs.sports[sport.key] ? '#0FEA95' : '#8E8E93'}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Skill Level</Text>
        <View style={styles.levelGrid}>
          {LEVELS.map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[styles.levelChip, prefs.level === lvl && styles.levelChipActive]}
              onPress={() => setLevel(lvl)}
            >
              <Text style={[styles.levelText, prefs.level === lvl && styles.levelTextActive]}>
                {lvl}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save Preferences'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { width: 40 },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#FFFFFF' },

  content: { paddingHorizontal: 20, paddingBottom: 50 },

  sectionLabel: { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 24 },

  card: { backgroundColor: '#2C2C2E', borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  levelChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C' },
  levelChipActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  levelText: { color: '#8E8E93', fontSize: 14, fontWeight: '700' },
  levelTextActive: { color: '#1C1C1E' },

  saveBtn: { marginTop: 36, backgroundColor: '#0FEA95', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#1C1C1E', fontSize: 16, fontWeight: '900' },
});
