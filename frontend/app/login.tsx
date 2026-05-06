import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGooglePress = () => {
    Alert.alert('Coming Soon', 'Google sign-in will be available in a future update. Please use email & password for now.');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) return Alert.alert('Missing fields', 'Please enter your email and password.');
    setLoading(true);
    try {
      const res  = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Sign in failed', data.message);
      await login(data.token, data.user);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Background accent circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Logo */}
      <View style={styles.logoSection}>
        <Image source={require('../assets/Logo4.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>SportLink</Text>
        <Text style={styles.tagline}>Find Your Match. Play Your Game.</Text>
      </View>

      <View style={styles.card}>
        {/* Google button */}
        <TouchableOpacity style={styles.googleBtn} onPress={handleGooglePress}>
          <Ionicons name="logo-google" size={20} color="#DB4437" />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>Soon</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={18} color="#636366" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#48484A"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password */}
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={18} color="#636366" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#48484A"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
          />
          <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#636366" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.forgotBtn}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign In */}
        <TouchableOpacity style={styles.signInBtn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#1C1C1E" />
            : <Text style={styles.signInText}>Sign In</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Sign up link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>New player? </Text>
        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={styles.footerLink}>Create account →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', paddingHorizontal: 24 },

  bgCircle1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: '#0FEA9514', top: -80, right: -80 },
  bgCircle2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#0FEA950A', bottom: 40, left: -60 },

  logoSection: { alignItems: 'center', marginBottom: 36 },
  logo:        { width: 80, height: 80, marginBottom: 12 },
  appName:     { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  tagline:     { fontSize: 14, color: '#0FEA95', fontWeight: '600', marginTop: 4 },

  card: { backgroundColor: '#2C2C2E', borderRadius: 24, padding: 24, gap: 14 },

  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, height: 52, gap: 10 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  soonBadge: { backgroundColor: '#FF8C00', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  soonText:  { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#3A3A3C' },
  dividerText: { fontSize: 12, color: '#48484A', fontWeight: '600' },

  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3A3A3C', borderRadius: 12, height: 50, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, color: '#FFFFFF', fontSize: 15 },
  eyeBtn:    { padding: 4 },

  forgotBtn:  { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: '#636366', fontSize: 13 },

  signInBtn:  { backgroundColor: '#0FEA95', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4, shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  signInText: { color: '#1C1C1E', fontSize: 16, fontWeight: '900' },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: '#636366', fontSize: 15 },
  footerLink: { color: '#0FEA95', fontSize: 15, fontWeight: '700' },
});
