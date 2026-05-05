import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../constants/api';

type Stats = { username: string; games_hosted: number; games_joined: number };

export default function ProfileScreen() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) setStats(data.user);
        } catch (err) {
          console.error('Stats fetch error:', err);
        }
      };
      fetchStats();
    }, [token])
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const totalGames = (stats?.games_hosted ?? 0) + (stats?.games_joined ?? 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={100} color="#0FEA95" />
        </View>
        <Text style={styles.name}>{stats?.username ?? user?.username ?? '—'}</Text>
        <Text style={styles.bio}>Living and breathing sports 🏀</Text>
      </View>

      {stats ? (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalGames}</Text>
            <Text style={styles.statLabel}>Total Games</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxBorder]}>
            <Text style={[styles.statNumber, { color: '#0FEA95' }]}>{stats.games_hosted}</Text>
            <Text style={styles.statLabel}>Hosted</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.games_joined}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.statsContainer, { justifyContent: 'center' }]}>
          <ActivityIndicator color="#0FEA95" />
        </View>
      )}

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
            <Text style={styles.menuText}>Account Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="whistle" size={24} color="#FFFFFF" />
            <Text style={styles.menuText}>Sport Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
            <Text style={styles.menuText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { marginTop: 20 }]} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out-outline" size={24} color="#FF453A" />
            <Text style={[styles.menuText, { color: '#FF453A' }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { alignItems: 'center', marginTop: 60, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  avatarContainer: { backgroundColor: '#2C2C2E', borderRadius: 50, marginBottom: 15 },
  name: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  bio: { fontSize: 16, color: '#8E8E93', marginTop: 5 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, backgroundColor: '#2C2C2E', marginHorizontal: 20, borderRadius: 20, marginTop: 20, minHeight: 80 },
  statBox: { alignItems: 'center', flex: 1 },
  statBoxBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#3A3A3C' },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 5 },
  statLabel: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold' },
  menuContainer: { marginTop: 30, paddingHorizontal: 20, paddingBottom: 40 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2C2C2E', padding: 18, borderRadius: 15, marginBottom: 12 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: { color: '#FFFFFF', fontSize: 16, marginLeft: 15, fontWeight: '600' },
});
