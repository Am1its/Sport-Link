import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState(3); // רמת ברירת מחדל: בינוני

  const handleRegister = () => {
    // כאן בעתיד נשלח את הנתונים ל-Backend
    console.log("Registering:", { name, email, password, level });
    // אחרי הרשמה, מעבירים ישירות לאפליקציה (למפה)
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* כפתור חזור */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>יצירת כרטיס שחקן</Text>
          <Text style={styles.subtitle}>הצטרף לקהילת הספורט של תל אביב</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="שם מלא" placeholderTextColor="#8E8E93" value={name} onChangeText={setName} />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="אימייל" placeholderTextColor="#8E8E93" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="סיסמה" placeholderTextColor="#8E8E93" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          {/* בחירת רמת משחק */}
          <Text style={styles.levelLabel}>הערך את רמת המשחק שלך (1-5):</Text>
          <View style={styles.levelContainer}>
            {[1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity 
                key={num} 
                style={[styles.levelButton, level === num && styles.levelButtonActive]}
                onPress={() => setLevel(num)}
              >
                <Text style={[styles.levelText, level === num && styles.levelTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
            <Text style={styles.registerButtonText}>הירשם וצא לשחק</Text>
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
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, textAlign: 'right' },
  levelLabel: { color: '#FFFFFF', fontSize: 16, marginBottom: 15, textAlign: 'right', fontWeight: 'bold' },
  levelContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  levelButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  levelButtonActive: { backgroundColor: '#0FEA95', borderColor: '#0FEA95' },
  levelText: { color: '#8E8E93', fontSize: 18, fontWeight: 'bold' },
  levelTextActive: { color: '#1C1C1E' },
  registerButton: { backgroundColor: '#0FEA95', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  registerButtonText: { color: '#1C1C1E', fontSize: 18, fontWeight: 'bold' }
});