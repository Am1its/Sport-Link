import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { Colors, Spacing, Radius } from '../constants/theme';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

const SPORT_ICONS = [
  'basketball', 'soccer', 'tennis', 'volleyball',
  'swim', 'dumbbell', 'yoga', 'handball', 'dance-ballroom',
];

// Deterministic positions for the background sport icon grid
const ICON_LAYOUT = [
  { top: 14,  left: 20,  size: 22, opacity: 0.07, rotate: '-8deg' },
  { top: 10,  left: 90,  size: 18, opacity: 0.05, rotate: '12deg' },
  { top: 18,  left: 160, size: 24, opacity: 0.08, rotate: '-4deg' },
  { top: 12,  left: 230, size: 20, opacity: 0.06, rotate: '16deg' },
  { top: 8,   left: 300, size: 22, opacity: 0.05, rotate: '-12deg' },
  { top: 56,  left: 50,  size: 20, opacity: 0.05, rotate: '8deg' },
  { top: 60,  left: 125, size: 26, opacity: 0.07, rotate: '-6deg' },
  { top: 52,  left: 200, size: 18, opacity: 0.06, rotate: '20deg' },
  { top: 58,  left: 270, size: 24, opacity: 0.05, rotate: '-10deg' },
  { top: 100, left: 30,  size: 24, opacity: 0.06, rotate: '10deg' },
  { top: 95,  left: 110, size: 20, opacity: 0.05, rotate: '-14deg' },
  { top: 105, left: 185, size: 22, opacity: 0.07, rotate: '6deg' },
  { top: 98,  left: 255, size: 18, opacity: 0.05, rotate: '-18deg' },
  { top: 140, left: 70,  size: 22, opacity: 0.06, rotate: '4deg' },
  { top: 135, left: 150, size: 26, opacity: 0.05, rotate: '-8deg' },
  { top: 145, left: 220, size: 20, opacity: 0.07, rotate: '14deg' },
];

function SportsBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ICON_LAYOUT.map((item, i) => (
        <MaterialCommunityIcons
          key={i}
          name={SPORT_ICONS[i % SPORT_ICONS.length] as any}
          size={item.size}
          color="#FFFFFF"
          style={{
            position: 'absolute',
            top: item.top,
            left: item.left,
            opacity: item.opacity,
            transform: [{ rotate: item.rotate }],
          }}
        />
      ))}
    </View>
  );
}

function FocusInput({
  icon, placeholder, value, onChangeText, keyboardType,
  autoCapitalize, secureTextEntry, rightElement, returnKeyType, onSubmitEditing, inputRef,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.accent],
  });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <Ionicons
        name={icon as any}
        size={18}
        color={focused ? Colors.accent : Colors.textMuted}
        style={styles.inputIcon}
      />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textHint}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {rightElement}
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { login } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const { promptAsync, loading: googleLoading, disabled: googleDisabled } = useGoogleAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return Alert.alert('Missing fields', 'Please enter your email and password.');
    }
    setLoading(true);
    try {
      const res  = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Sign in failed', data.message);
      await login(data.token, data.user);
      router.replace((redirect ?? '/(tabs)') as any);
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* ── Hero section ── */}
      <View style={styles.hero}>
        <SportsBg />

        {/* Glow orbs */}
        <View style={styles.glowOrb1} />
        <View style={styles.glowOrb2} />

        {/* Logo + branding */}
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Image source={require('../assets/Logo4.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>SportLink</Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineDot} />
            <Text style={styles.tagline}>Find Your Match. Play Your Game.</Text>
            <View style={styles.taglineDot} />
          </View>
        </View>
      </View>

      {/* ── Form card ── */}
      <View style={styles.card}>
        {/* Google */}
        <TouchableOpacity
          style={[styles.googleBtn, googleDisabled && { opacity: 0.6 }]}
          onPress={() => promptAsync()}
          activeOpacity={0.85}
          disabled={googleDisabled}
        >
          {googleLoading
            ? <ActivityIndicator size="small" color="#DB4437" />
            : <>
                <Ionicons name="logo-google" size={19} color="#DB4437" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign in with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <FocusInput
          icon="mail-outline"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        {/* Password */}
        <FocusInput
          icon="lock-closed-outline"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          inputRef={passwordRef}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          rightElement={
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          }
        />

        <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in */}
        <TouchableOpacity
          style={[styles.signInBtn, loading && { opacity: 0.75 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.bg} size="small" />
            : <>
                <Text style={styles.signInText}>Sign In</Text>
                <Ionicons name="arrow-forward-circle" size={20} color={Colors.bg} />
              </>}
        </TouchableOpacity>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>New player? </Text>
        <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
          <Text style={styles.footerLink}>Create account →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero: {
    height: 240,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingBottom: 28,
  },
  glowOrb1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: Colors.accent + '12', top: -120, right: -80,
  },
  glowOrb2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.accent + '08', bottom: -60, left: -60,
  },

  brand:      { alignItems: 'center', zIndex: 1 },
  logoRing:   {
    width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.accent + '40',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  logo:       { width: 48, height: 48 },
  appName:    { fontSize: 34, fontWeight: '900', color: Colors.text, letterSpacing: 0.5 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  taglineDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  tagline:    { fontSize: 13, color: Colors.accent, fontWeight: '600', letterSpacing: 0.3 },

  // Form card — flush at bottom of hero, no rounded corners on top
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 14,
    flex: 1,
  },

  // Google
  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: Radius.lg, height: 52, gap: 10, paddingHorizontal: 16 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },

  // Divider
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // Inputs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg, height: 52,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, color: Colors.text, fontSize: 15 },
  eyeBtn:    { padding: 4 },

  forgotBtn:  { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },

  // Sign in
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, height: 54, borderRadius: Radius.pill,
    marginTop: 2,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  signInText: { color: Colors.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  // Footer
  footer:     { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, backgroundColor: Colors.surface },
  footerText: { color: Colors.textMuted, fontSize: 15 },
  footerLink: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
});
