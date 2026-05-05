import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const SPORTS = [
  { key: 'basketball', label: 'Basketball', icon: 'basketball',     color: '#FF8C00' },
  { key: 'football',   label: 'Football',   icon: 'soccer',         color: '#FFFFFF' },
  { key: 'tennis',     label: 'Tennis',     icon: 'tennis',         color: '#CCFF00' },
  { key: 'volleyball', label: 'Volleyball', icon: 'volleyball',     color: '#FFD700' },
  { key: 'yoga',       label: 'Yoga',       icon: 'yoga',           color: '#A78BFA' },
  { key: 'gym',        label: 'Gym',        icon: 'dumbbell',       color: '#FB923C' },
  { key: 'studio',     label: 'Studio',     icon: 'dance-ballroom', color: '#F472B6' },
  { key: 'footvolley', label: 'Footvolley', icon: 'volleyball',     color: '#22D3EE' },
] as const;

const STEPS = ['avatar', 'bio', 'sports'] as const;
type Step = typeof STEPS[number];

export default function OnboardingScreen() {
  const router = useRouter();
  const { token, setOnboardingComplete } = useAuth();

  const [step, setStep] = useState<Step>('avatar');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setAvatar(result.assets[0].base64);
    }
  };

  const toggleSport = (key: string) => {
    setSelectedSports(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const body: Record<string, any> = { onboarding_complete: true };
      if (avatar) body.avatar = avatar;
      if (bio.trim()) body.bio = bio.trim();

      const res = await apiFetch('/api/users/me', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);

      await setOnboardingComplete();
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>SportLink</Text>
        <Text style={styles.subtitle}>Let's set up your profile</Text>

        {/* Progress dots */}
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i <= stepIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Avatar ── */}
        {step === 'avatar' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Add a profile photo</Text>
            <Text style={styles.stepHint}>You can always change this later</Text>

            <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
              {avatar ? (
                <Image source={{ uri: `data:image/jpeg;base64,${avatar}` }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={40} color="#636366" />
                  <Text style={styles.avatarPlaceholderText}>Tap to upload</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={14} color="#1C1C1E" />
              </View>
            </TouchableOpacity>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('bio')}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('bio')}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 2: Bio ── */}
        {step === 'bio' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            <Text style={styles.stepHint}>A short bio helps others know who you are</Text>

            <TextInput
              style={styles.bioInput}
              placeholder="e.g. Basketball fanatic, always up for a game 🏀"
              placeholderTextColor="#48484A"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={120}
              autoFocus
            />
            <Text style={styles.charCount}>{bio.length}/120</Text>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('avatar')}>
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('sports')}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 3: Sport Preferences ── */}
        {step === 'sports' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What sports do you play?</Text>
            <Text style={styles.stepHint}>Select all that apply</Text>

            <View style={styles.sportsGrid}>
              {SPORTS.map(s => {
                const active = selectedSports.has(s.key);
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.sportTile, active && { borderColor: s.color, backgroundColor: s.color + '22' }]}
                    onPress={() => toggleSport(s.key)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={s.icon as any}
                      size={32}
                      color={active ? s.color : '#636366'}
                    />
                    <Text style={[styles.sportTileLabel, active && { color: s.color }]}>{s.label}</Text>
                    {active && (
                      <View style={[styles.sportCheck, { backgroundColor: s.color }]}>
                        <Ionicons name="checkmark" size={10} color="#1C1C1E" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('bio')}>
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#1C1C1E" size="small" />
                  : <>
                      <Text style={styles.finishBtnText}>Let's Play!</Text>
                      <Ionicons name="rocket" size={18} color="#1C1C1E" />
                    </>}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },

  header: { alignItems: 'center', paddingTop: 70, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  brand: { fontSize: 28, fontWeight: '900', color: '#0FEA95', letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#8E8E93', marginBottom: 20 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A3A3C' },
  dotActive: { backgroundColor: '#0FEA95', width: 22 },

  body: { padding: 24, paddingBottom: 48 },
  stepContainer: { gap: 0 },

  stepTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 6, marginTop: 8 },
  stepHint: { fontSize: 14, color: '#636366', marginBottom: 28 },

  avatarWrap: { alignSelf: 'center', width: 130, height: 130, borderRadius: 65, marginBottom: 32, position: 'relative' },
  avatarImage: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: '#0FEA95' },
  avatarPlaceholder: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#2C2C2E', borderWidth: 2, borderColor: '#3A3A3C', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6 },
  avatarPlaceholderText: { color: '#636366', fontSize: 12 },
  avatarEditBadge: { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0FEA95', justifyContent: 'center', alignItems: 'center' },

  bioInput: { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16, color: '#FFFFFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3A3A3C', marginBottom: 6 },
  charCount: { color: '#48484A', fontSize: 12, textAlign: 'right', marginBottom: 28 },

  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  sportTile: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#2C2C2E', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#3A3A3C', position: 'relative' },
  sportTileLabel: { fontSize: 14, fontWeight: '700', color: '#8E8E93' },
  sportCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  navRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  skipBtn: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center' },
  skipText: { color: '#636366', fontSize: 15, fontWeight: '600' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingHorizontal: 18, backgroundColor: '#2C2C2E', borderRadius: 14 },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: '#0FEA95', borderRadius: 14 },
  nextBtnText: { color: '#1C1C1E', fontWeight: '900', fontSize: 16 },
  finishBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: '#0FEA95', borderRadius: 14 },
  finishBtnText: { color: '#1C1C1E', fontWeight: '900', fontSize: 16 },
});
