import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Image, useWindowDimensions,
} from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { SPORT_COLORS, SPORT_ICONS } from '../constants/sports';
import { Colors, Spacing, Radius, Type } from '../constants/theme';
import { Springs } from '../constants/motion';
import { usePressAnimation } from '../hooks/useAnimations';
import { useSound } from '../context/SoundContext';
import { AuthBackground } from '../components/AuthBackground';

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

// ── SportTile sub-component ──────────────────────────────────────────────────
function SportTile({
  sportKey,
  label,
  selected,
  onToggle,
}: {
  sportKey: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const color = SPORT_COLORS[sportKey as keyof typeof SPORT_COLORS] ?? Colors.accent;
  const icon  = SPORT_ICONS[sportKey as keyof typeof SPORT_ICONS]   ?? 'trophy';

  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.92,
    scaleUp: 1.08,
    stiffness: Springs.snappy.stiffness,
    damping:   Springs.snappy.damping,
  });

  return (
    <ReAnimated.View style={animatedStyle}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => { Haptics.selectionAsync(); onToggle(); }}
        activeOpacity={1}
        style={[
          styles.sportTile,
          selected
            ? { borderColor: color, backgroundColor: color + '22' }
            : { borderColor: Colors.border },
        ]}
      >
        <MaterialCommunityIcons name={icon as any} size={28} color={selected ? color : Colors.textMuted} />
        <Text style={[styles.sportTileLabel, selected && { color }]}>{label}</Text>
        {selected && (
          <View style={[styles.sportCheck, { backgroundColor: color }]}>
            <Ionicons name="checkmark" size={10} color={Colors.bg} />
          </View>
        )}
      </TouchableOpacity>
    </ReAnimated.View>
  );
}

// ── ProgressBar sub-component ────────────────────────────────────────────────
function ProgressBar({ currentStep }: { currentStep: number }) {
  const sv0 = useSharedValue(0);
  const sv1 = useSharedValue(0);
  const sv2 = useSharedValue(0);
  const sv3 = useSharedValue(0);

  useEffect(() => {
    sv0.value = withSpring(currentStep > 0 ? 1 : 0, Springs.gentle);
    sv1.value = withSpring(currentStep > 1 ? 1 : 0, Springs.gentle);
    sv2.value = withSpring(currentStep > 2 ? 1 : 0, Springs.gentle);
    sv3.value = withSpring(currentStep > 3 ? 1 : 0, Springs.gentle);
  }, [currentStep]);

  const s0 = useAnimatedStyle(() => ({ flex: 1, opacity: sv0.value }));
  const s1 = useAnimatedStyle(() => ({ flex: 1, opacity: sv1.value }));
  const s2 = useAnimatedStyle(() => ({ flex: 1, opacity: sv2.value }));
  const s3 = useAnimatedStyle(() => ({ flex: 1, opacity: sv3.value }));

  return (
    <View style={styles.progressBar}>
      <ReAnimated.View style={[styles.progressSegment, s0]} />
      <ReAnimated.View style={[styles.progressSegment, s1]} />
      <ReAnimated.View style={[styles.progressSegment, s2]} />
      <ReAnimated.View style={[styles.progressSegment, s3]} />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { token, setOnboardingComplete } = useAuth();
  const { play } = useSound();
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const [step, setStep]           = useState<Step>('avatar');
  const [avatar, setAvatar]       = useState<string | null>(null);
  const [bio, setBio]             = useState('');
  const [bioFocused, setBioFocused] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sportPrefs, setSportPrefs]         = useState<Record<string, SportPref>>({});
  const [saving, setSaving]       = useState(false);

  const stepIndex = STEPS.indexOf(step);

  // Screen entrance animation
  const contentY  = useSharedValue(30);
  const contentOp = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateY: contentY.value }],
    opacity: contentOp.value,
  }));

  useEffect(() => {
    contentY.value  = withSpring(0, Springs.gentle);
    contentOp.value = withTiming(1, { duration: 350 });
  }, []);

  // Step slide transition
  const stepTranslateX = useSharedValue(0);
  const stepOpacity    = useSharedValue(1);

  const stepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: stepTranslateX.value }],
    opacity: stepOpacity.value,
  }));

  const goToStep = useCallback((next: Step, direction: 'forward' | 'back' = 'forward') => {
    const outX = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    const inX  = direction === 'forward' ?  SCREEN_WIDTH : -SCREEN_WIDTH;
    stepTranslateX.value = withTiming(outX, { duration: 200 }, () => {
      stepTranslateX.value = inX;
      stepOpacity.value = 0;
      runOnJS(setStep)(next);
    });
  }, [SCREEN_WIDTH, setStep]);

  useEffect(() => {
    stepTranslateX.value = withSpring(0, Springs.bouncy);
    stepOpacity.value = withTiming(1, { duration: 150 });
  }, [step]);

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
    play('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      <AuthBackground showLogo={false} />

      <ReAnimated.View style={contentStyle}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRing}>
            <Image source={require('../assets/Logo4.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.subtitle}>Let's set up your profile</Text>
          <ProgressBar currentStep={stepIndex + 1} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <ReAnimated.View style={stepStyle}>

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
                  <TouchableOpacity style={styles.skipBtn} onPress={() => goToStep('bio', 'forward')}>
                    <Text style={styles.skipText}>Skip for now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => goToStep('bio', 'forward')}>
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
                  <TouchableOpacity style={styles.backBtn} onPress={() => goToStep('avatar', 'back')}>
                    <Ionicons name="arrow-back" size={18} color={Colors.text} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => goToStep('sports', 'forward')}>
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
                  {SPORTS.map(({ key, label }) => (
                    <SportTile
                      key={key}
                      sportKey={key}
                      label={label}
                      selected={selectedSports.includes(key)}
                      onToggle={() => toggleSport(key)}
                    />
                  ))}
                </View>

                <View style={styles.navRow}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => goToStep('bio', 'back')}>
                    <Ionicons name="arrow-back" size={18} color={Colors.text} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.nextBtn}
                    onPress={() => {
                      if (selectedSports.length === 0) return Alert.alert('Pick at least one', 'Select the sports you play.');
                      goToStep('levels', 'forward');
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
                  <TouchableOpacity style={styles.backBtn} onPress={() => goToStep('sports', 'back')}>
                    <Ionicons name="arrow-back" size={18} color={Colors.text} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={handleFinish} disabled={saving}>
                    {saving
                      ? <ActivityIndicator color={Colors.bg} size="small" />
                      : <>
                          <Text style={styles.nextBtnText}>Let's Play!</Text>
                          <Ionicons name="rocket" size={18} color={Colors.bg} />
                        </>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </ReAnimated.View>
        </ScrollView>
      </ReAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 24,
  },
  logoRing: {
    width: 60, height: 60, borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.accent + '40',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  logo:     { width: 40, height: 40 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 18, fontWeight: '600' },

  // Segmented progress bar
  progressBar:     { flexDirection: 'row', gap: 5, width: '60%' },
  progressSegment: { flex: 1, height: 4, borderRadius: 3, backgroundColor: Colors.accent },

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
});
