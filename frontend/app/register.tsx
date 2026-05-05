import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../constants/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState(3);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) return Alert.alert('Error', 'Please fill in all fields');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      await login(data.token, data.user);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>Create Your Profile</Text>
          <Text style={styles.subtitle}>Join the SportLink community</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#8E8E93" value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8E8E93" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8E8E93" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <Text style={styles.levelLabel}>Rate your skill level (1–5):</Text>
          <View style={styles.levelContainer}>
            {[1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity key={num} style={[styles.levelButton, level === num && styles.levelButtonActive]} onPress={() => setLevel(num)}>
                <Text style={[styles.levelText, level === num && styles.levelTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#1C1C1E" /> : <Text style={styles.registerButtonText}>Join & Play</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  backButton: { marginTop: 60, marginLeft: 20, alignSelf: 'flex-start' },
  headerContainer: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#0FEA95', marginTop: 5 },
  formContainer: { paddingHorizontal: 30 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 15, marginBottom: 20, paddingHorizontal: 15, height: 60 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  levelLabel: { color: '#FFFFFF', fontSize: 16, marginBottom: 15, fontWeight: 'bold' },
  levelContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  levelButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  levelButtonActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  levelText: { color: '#8E8E93', fontSize: 18, fontWeight: 'bold' },
  levelTextActive: { color: '#1C1C1E' },
  registerButton: { backgroundColor: '#0FEA95', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  registerButtonText: { color: '#1C1C1E', fontSize: 18, fontWeight: 'bold' },
});
