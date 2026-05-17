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
import { SPORT_COLORS, SPORT_ICONS } from '../constants/sports';
import { Colors, Spacing, Radius, Type } from '../constants/theme';

const SPORTS = [
  { key: 'basketball', label: 'Basketball' },
  { key: 'football',   label: 'Football'   },
  { key: 'tennis',     label: 'Tennis'     },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'swimming',   label: 'Swimming'   },
  { key: 'gym',        label: 'Gym'        },
  { key: 'yoga',       label: 'Yoga'       },
  { key: 'studio',     label: 'Studio'     },
  { key: 'footvolley', label: 'Footvolley' },
];

const LEVEL_NAMES = ['Beginner', 'Casual', 'Intermediate', 'Advanced', 'Elite'];

const STEPS = ['avatar', 'bio', 'sports', 'levels'] as const;
type Step = typeof STEPS[number];

type SportPref = { level: number; favorite: boolean };

export default function OnboardingScreen() {
  const router = useRouter();
  const { token, setOnboardingComplete } = useAuth();

  const [step, setStep]           = useState<Step>('avatar');
  const [avatar, setAvatar]       = useState<string | null>(null);
  const [bio, setBio]             = useState('');
  const [bioFocused, setBioFocused] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sportPrefs, setSportPrefs]         = useState<Record<string, SportPref>>({});
  const [saving, setSaving]       = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    if (selectedSports.includes(key)) {
      setSelectedSports(prev => prev.filter(s => s !== key));
    } else {
      setSelectedSports(prev => [...prev, key]);
      setSportPrefs(prev => prev[key] ? prev : { ...prev, [key]: { level: 3, favorite: false } });
    }
  };

  const setLevel = (sport: string, level: number) => {
    setSportPrefs(prev => ({ ...prev, [sport]: { ...prev[sport], level } }));
  };

  const toggleFavorite = (sport: string) => {
    setSportPrefs(prev => ({ ...prev, [sport]: { ...prev[sport], favorite: !prev[sport]?.favorite } }));
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

      if (selectedSports.length > 0) {
        await apiFetch('/api/users/sport-preferences', {
          method: 'PUT',
          token,
          body: JSON.stringify({
            preferences: selectedSports.map(sport => ({
              sport_type:  sport,
              skill_level: sportPrefs[sport]?.level ?? 3,
              is_favorite: sportPrefs[sport]?.favorite ?? false,
            })),
          }),
        });
      }

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
      <View style={styles.header}>
        <Text style={styles.brand}>SportLink</Text>
        <Text style={styles.subtitle}>Let's set up your profile</Text>

        {/* Segmented progress bar */}
        <View style={styles.progressBar}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressSegment,
                i <= stepIndex ? styles.progressSegmentActive : styles.progressSegmentInactive,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Photo ── */}
        {step === 'avatar' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Add a profile photo</Text>
            <Text style={styles.stepHint}>You can always change this later</Text>

            <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
              {avatar ? (
                <Image source={{ uri: `data:image/jpeg;base64,${avatar}` }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={40} color={Colors.textMuted} />
                  <Text style={styles.avatarPlaceholderText}>Tap to upload</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={14} color={Colors.bg} />
              </View>
            </TouchableOpacity>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('bio')}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('bio')}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.bg} />
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
              style={[styles.bioInput, bioFocused && styles.bioInputFocused]}
              placeholder="e.g. Basketball fanatic, always up for a game 🏀"
              placeholderTextColor={Colors.textHint}
              value={bio}
              onChangeText={setBio}
              onFocus={() => setBioFocused(true)}
              onBlur={() => setBioFocused(false)}
              multiline
              maxLength={120}
              autoFocus
            />
            <Text style={styles.charCount}>{bio.length}/120</Text>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('avatar')}>
                <Ionicons name="arrow-back" size={18} color={Colors.text} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('sports')}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.bg} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 3: Sports ── */}
        {step === 'sports' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What do you play?</Text>
            <Text style={styles.stepHint}>Select all sports you're into</Text>

            <View style={styles.sportsGrid}>
              {SPORTS.map(({ key, label }) => {
                const color    = SPORT_COLORS[key as keyof typeof SPORT_COLORS] ?? Colors.accent;
                const icon     = SPORT_ICONS[key  as keyof typeof SPORT_ICONS]  ?? 'trophy';
                const selected = selectedSports.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.sportTile,
                      selected ? { borderColor: color, backgroundColor: color + '22' } : { borderColor: Colors.border },
                    ]}
                    onPress={() => toggleSport(key)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name={icon as any} size={28} color={selected ? color : Colors.textMuted} />
                    <Text style={[styles.sportTileLabel, selected && { color }]}>{label}</Text>
                    {selected && (
                      <View style={[styles.sportCheck, { backgroundColor: color }]}>
                        <Ionicons name="checkmark" size={10} color={Colors.bg} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('bio')}>
                <Ionicons name="arrow-back" size={18} color={Colors.text} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => {
                  if (selectedSports.length === 0) return Alert.alert('Pick at least one', 'Select the sports you play.');
                  setStep('levels');
                }}
              >
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.bg} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 4: Levels ── */}
        {step === 'levels' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your skill levels</Text>
            <Text style={styles.stepHint}>Tap dots to set level · ♥ to mark favorites</Text>

            <View style={styles.levelsContainer}>
              {selectedSports.map(key => {
                const sportDef = SPORTS.find(s => s.key === key)!;
                const color    = SPORT_COLORS[key as keyof typeof SPORT_COLORS] ?? Colors.accent;
                const icon     = SPORT_ICONS[key  as keyof typeof SPORT_ICONS]  ?? 'trophy';
                const pref     = sportPrefs[key] ?? { level: 3, favorite: false };
                return (
                  <View key={key} style={styles.levelRow}>
                    <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                    <Text style={styles.levelSportLabel}>{sportDef.label}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={styles.levelControl}>
                      <View style={styles.levelDots}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <TouchableOpacity
                            key={n}
                            onPress={() => setLevel(key, n)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                          >
                            <View style={[styles.levelDot, n <= pref.level && { backgroundColor: color }]} />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.levelName}>{LEVEL_NAMES[(pref.level || 1) - 1]}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleFavorite(key)} style={styles.favoriteBtn}>
                      <Ionicons
                        name={pref.favorite ? 'heart' : 'heart-outline'}
                        size={20}
                        color={pref.favorite ? '#FF6B6B' : Colors.textHint}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('sports')}>
                <Ionicons name="arrow-back" size={18} color={Colors.text} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <>
                      <Text style={styles.finishBtnText}>Let's Play!</Text>
                      <Ionicons name="rocket" size={18} color={Colors.bg} />
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
  container: { flex: 1, backgroundColor: Colors.bg },

  header:   { alignItems: 'center', paddingTop: 70, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: Colors.surface },
  brand:    { fontSize: 28, fontWeight: '900', color: Colors.accent, letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.textMuted, marginBottom: 20 },

  // Segmented progress bar
  progressBar: { flexDirection: 'row', gap: 5, width: '60%' },
  progressSegment: { flex: 1, height: 4, borderRadius: 3 },
  progressSegmentActive:   { backgroundColor: Colors.accent },
  progressSegmentInactive: { backgroundColor: Colors.surface2 },

  body:          { padding: Spacing.xxl, paddingBottom: 48 },
  stepContainer: { gap: 0 },

  stepTitle: { fontSize: 24, fontWeight: '900', color: Colors.text, marginBottom: 6, marginTop: 8 },
  stepHint:  { fontSize: 14, color: Colors.textMuted, marginBottom: 28 },

  avatarWrap:            { alignSelf: 'center', width: 130, height: 130, borderRadius: 65, marginBottom: 32, position: 'relative' },
  avatarImage:           { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: Colors.accent },
  avatarPlaceholder:     { width: 130, height: 130, borderRadius: 65, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6 },
  avatarPlaceholderText: { color: Colors.textMuted, fontSize: 12 },
  avatarEditBadge:       { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },

  bioInput:        { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, color: Colors.text, fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  bioInputFocused: { borderColor: Colors.accent },
  charCount:       { color: Colors.textHint, fontSize: 12, textAlign: 'right', marginBottom: 28 },

  sportsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  sportTile:      { width: '30%', aspectRatio: 1.1, backgroundColor: Colors.surface, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1.5 },
  sportTileLabel: { ...Type.label, color: Colors.textMuted, textAlign: 'center' },
  sportCheck:     { position: 'absolute', top: 7, right: 7, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  levelsContainer: { gap: 10, marginBottom: 32 },
  levelRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, gap: 10 },
  levelSportLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  levelControl:    { alignItems: 'center', gap: 4 },
  levelDots:       { flexDirection: 'row', gap: 8 },
  levelDot:        { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.surface2 },
  levelName:       { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  favoriteBtn:     { padding: 4 },

  navRow:      { flexDirection: 'row', gap: 12, marginTop: 8 },
  skipBtn:     { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center' },
  skipText:    { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingHorizontal: 18, backgroundColor: Colors.surface, borderRadius: Radius.pill },
  backBtnText: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  nextBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: Colors.accent, borderRadius: Radius.pill },
  nextBtnText: { color: Colors.bg, fontWeight: '900', fontSize: 16 },
  finishBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: Colors.accent, borderRadius: Radius.pill },
  finishBtnText: { color: Colors.bg, fontWeight: '900', fontSize: 16 },
});
