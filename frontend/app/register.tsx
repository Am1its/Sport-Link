import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleGooglePress = () => {
    Alert.alert('Coming Soon', 'Google sign-in will be available in a future update. Please use email & password for now.');
  };

  const handleRegister = async () => {
    if (!username.trim())        return Alert.alert('Required', 'Please enter a username.');
    if (!email.trim())           return Alert.alert('Required', 'Please enter your email.');
    if (!password)               return Alert.alert('Required', 'Please enter a password.');
    if (password.length < 6)    return Alert.alert('Too short', 'Password must be at least 6 characters.');

    setLoading(true);
    try {
      const res  = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Registration failed', data.message);

      await login(data.token, data.user);
      router.replace('/onboarding');
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={24} color="#AEAEB2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join SportLink</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardSub}>Join thousands of players near you</Text>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGooglePress}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>Soon</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color="#636366" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#48484A"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

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

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#636366" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 chars)"
              placeholderTextColor="#48484A"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#636366" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#1C1C1E" size="small" />
              : <>
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color="#1C1C1E" />
                </>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.footerLink}>Sign in →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  scroll:    { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 50 },

  bgCircle1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#0FEA9510', top: -60, right: -60 },
  bgCircle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  backgroundColor: '#0FEA9508', bottom: 60, left: -50 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, marginBottom: 28 },
  headerBack:  { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },

  card:      { backgroundColor: '#2C2C2E', borderRadius: 24, padding: 24, gap: 14 },
  cardTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  cardSub:   { fontSize: 14, color: '#636366', marginTop: -6 },

  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, height: 52, gap: 10 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  soonBadge:     { backgroundColor: '#FF8C00', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  soonText:      { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#3A3A3C' },
  dividerText: { fontSize: 12, color: '#48484A', fontWeight: '600' },

  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3A3A3C', borderRadius: 12, height: 50, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, color: '#FFFFFF', fontSize: 15 },
  eyeBtn:    { padding: 4 },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0FEA95', height: 52, borderRadius: 14, gap: 8, marginTop: 4, shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  primaryBtnText: { color: '#1C1C1E', fontSize: 16, fontWeight: '900' },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: '#636366', fontSize: 15 },
  footerLink: { color: '#0FEA95', fontSize: 15, fontWeight: '700' },
});
