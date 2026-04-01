import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>חיפוש מגרשים ומשחקים</Text>
      
      {/* שורת חיפוש */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#8E8E93" />
        <TextInput 
          style={styles.input} 
          placeholder="חפש עיר, פארק או סוג ספורט..." 
          placeholderTextColor="#8E8E93" 
        />
      </View>

      <View style={styles.placeholder}>
        <Ionicons name="compass-outline" size={80} color="#2C2C2E" />
        <Text style={styles.placeholderText}>הזן חיפוש כדי לגלות מגרשים</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 60, marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 15, paddingHorizontal: 15, height: 50 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, marginLeft: 10, textAlign: 'right' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#8E8E93', fontSize: 16, marginTop: 15, fontWeight: '600' }
});