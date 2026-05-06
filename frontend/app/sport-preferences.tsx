import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { SPORT_COLORS, SPORT_ICONS } from '../constants/sports';

const SPORTS = [
  { key: 'basketball', label: 'Basketball' },
  { key: 'tennis',     label: 'Tennis' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'football',   label: 'Football' },
  { key: 'yoga',       label: 'Yoga' },
  { key: 'gym',        label: 'Gym' },
  { key: 'studio',     label: 'Studio' },
  { key: 'footvolley', label: 'Footvolley' },
  { key: 'swimming',   label: 'Swimming' },
];

const SKILL_LABELS = ['', 'Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro'];

type SportState = {
  sport_type: string;
  enabled: boolean;
  skill_level: number;
  is_favorite: boolean;
};

const makeDefault = (): SportState[] =>
  SPORTS.map(s => ({ sport_type: s.key, enabled: false, skill_level: 3, is_favorite: false }));

export default function SportPreferencesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [sports, setSports] = useState<SportState[]>(makeDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/users/sport-preferences', { token });
        const data = await res.json();
        if (data.success) {
          setSports(SPORTS.map(s => {
            const found = data.sport_preferences.find((p: any) => p.sport_type === s.key);
            if (found) return { sport_type: s.key, enabled: true, skill_level: found.skill_level, is_favorite: !!found.is_favorite };
            return { sport_type: s.key, enabled: false, skill_level: 3, is_favorite: false };
          }));
        }
      } catch (err) {
        if (!(err instanceof UnauthorizedError)) console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]));

  const toggleEnabled = (key: string) =>
    setSports(prev => prev.map(s => s.sport_type === key ? { ...s, enabled: !s.enabled } : s));

  const setLevel = (key: string, n: number) =>
    setSports(prev => prev.map(s => s.sport_type === key ? { ...s, skill_level: n, enabled: true } : s));

  const toggleFav = (key: string) =>
    setSports(prev => prev.map(s =>
      s.sport_type === key ? { ...s, is_favorite: !s.is_favorite, enabled: true } : s
    ));

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = sports
        .filter(s => s.enabled)
        .map(({ sport_type, skill_level, is_favorite }) => ({ sport_type, skill_level, is_favorite }));
      const res = await apiFetch('/api/users/sport-preferences', {
        method: 'PUT', token,
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', 'Failed to save preferences');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Sport Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>Toggle sports, set your skill level, and mark favorites.</Text>

        {SPORTS.map(sport => {
          const s = sports.find(x => x.sport_type === sport.key)!;
          const color = SPORT_COLORS[sport.key] ?? '#636366';
          const icon = SPORT_ICONS[sport.key] ?? 'help-circle';
          return (
            <View key={sport.key} style={[styles.card, !s.enabled && styles.cardDim]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: color + (s.enabled ? '30' : '15') }]}>
                  <MaterialCommunityIcons name={icon as any} size={22} color={s.enabled ? color : '#48484A'} />
                </View>
                <Text style={[styles.sportName, !s.enabled && styles.sportNameDim]}>{sport.label}</Text>
                <View style={styles.cardTopRight}>
                  <TouchableOpacity onPress={() => toggleFav(sport.key)} style={styles.heartBtn}>
                    <Ionicons
                      name={s.is_favorite && s.enabled ? 'heart' : 'heart-outline'}
                      size={22}
                      color={s.is_favorite && s.enabled ? '#FF453A' : '#48484A'}
                    />
                  </TouchableOpacity>
                  <Switch
                    value={s.enabled}
                    onValueChange={() => toggleEnabled(sport.key)}
                    trackColor={{ false: '#3A3A3C', true: color + '80' }}
                    thumbColor={s.enabled ? color : '#636366'}
                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                  />
                </View>
              </View>

              {s.enabled && (
                <View style={styles.skillRow}>
                  <View style={styles.dotsWrap}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setLevel(sport.key, n)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <View style={[styles.dot, n <= s.skill_level && { backgroundColor: color, borderColor: color }]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.levelLabel, { color }]}>{SKILL_LABELS[s.skill_level]}</Text>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#1C1C1E" size="small" />
            : <Text style={styles.saveBtnText}>Save Preferences</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center:    { flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#1C1C1E' },

  header:  { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { width: 40 },
  title:   { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#FFFFFF' },

  hint:   { fontSize: 13, color: '#636366', marginBottom: 20, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 50 },

  card:        { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 14, marginBottom: 10 },
  cardDim:     { opacity: 0.5 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:    { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sportName:   { flex: 1, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  sportNameDim: { color: '#636366' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heartBtn:    { padding: 4 },

  skillRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#3A3A3C', gap: 12 },
  dotsWrap: { flexDirection: 'row', gap: 8 },
  dot:      { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3A3A3C', borderWidth: 1.5, borderColor: '#3A3A3C' },
  levelLabel: { fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },

  saveBtn:     { marginTop: 24, backgroundColor: '#0FEA95', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#1C1C1E', fontSize: 16, fontWeight: '900' },
});
