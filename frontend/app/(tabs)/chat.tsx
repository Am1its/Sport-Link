import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>הודעות</Text>
      
      <View style={styles.placeholder}>
        <Ionicons name="chatbubbles-outline" size={80} color="#2C2C2E" />
        <Text style={styles.placeholderText}>אין לך הודעות חדשות</Text>
        <Text style={styles.subText}>כאן יופיעו הקבוצות של המשחקים שלך</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 60 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#FFFFFF', fontSize: 18, marginTop: 15, fontWeight: 'bold' },
  subText: { color: '#8E8E93', fontSize: 14, marginTop: 5 }
});