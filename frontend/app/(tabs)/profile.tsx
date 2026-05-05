import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../constants/api';

type Stats = { username: string; games_hosted: number; games_joined: number; karma: number };

const AVATAR_PALETTE = ['#FF8C00', '#4F9EFF', '#FF453A', '#FFD700', '#A78BFA', '#0FEA95', '#FF6B9D', '#34C759'];
const getAvatarColor = (name: string) =>
  AVATAR_PALETTE[(name.charCodeAt(0) + name.length) % AVATAR_PALETTE.length];

function StatCard({
  iconLib, icon, value, label, valueColor,
}: {
  iconLib: 'ion' | 'mci';
  icon: string;
  value: string | number;
  label: string;
  valueColor: string;
}) {
  return (
    <View style={styles.statCard}>
      {iconLib === 'ion'
        ? <Ionicons name={icon as any} size={22} color={valueColor} style={styles.statIcon} />
        : <MaterialCommunityIcons name={icon as any} size={22} color={valueColor} style={styles.statIcon} />}
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

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

  const username = stats?.username ?? user?.username ?? '—';
  const initial  = username.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(username);

  const totalGames = (stats?.games_hosted ?? 0) + (stats?.games_joined ?? 0);
  const karma      = stats?.karma ?? 0;
  const karmaStr   = karma > 0 ? `+${karma}` : `${karma}`;
  const karmaColor = karma > 0 ? '#0FEA95' : karma < 0 ? '#FF453A' : '#8E8E93';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* decorative accent circles */}
        <View style={[styles.accentCircle, styles.accentCircle1, { backgroundColor: avatarColor + '18' }]} />
        <View style={[styles.accentCircle, styles.accentCircle2, { backgroundColor: avatarColor + '10' }]} />

        <View style={[styles.avatarRing, { borderColor: avatarColor }]}>
          <View style={[styles.avatarInner, { backgroundColor: avatarColor + '25' }]}>
            <Text style={[styles.avatarLetter, { color: avatarColor }]}>{initial}</Text>
          </View>
        </View>

        <Text style={styles.name}>{username}</Text>
        <Text style={styles.bio}>Living and breathing sports</Text>
      </View>

      {/* ── Stats Grid ── */}
      {stats ? (
        <View style={styles.statsGrid}>
          <StatCard iconLib="ion"  icon="trophy-outline"  value={totalGames}  label="Total Games"   valueColor="#FFFFFF" />
          <StatCard iconLib="ion"  icon="shield-outline"  value={stats.games_hosted} label="Hosted" valueColor="#0FEA95" />
          <StatCard iconLib="ion"  icon="people-outline"  value={stats.games_joined} label="Joined" valueColor="#4F9EFF" />
          <StatCard iconLib="ion"  icon="flash"           value={karmaStr}    label="Karma"         valueColor={karmaColor} />
        </View>
      ) : (
        <View style={styles.statsLoading}>
          <ActivityIndicator color="#0FEA95" />
        </View>
      )}

      {/* ── Menu ── */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuSection}>Account</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#3A3A3C' }]}>
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.menuText}>Account Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#FF8C0022' }]}>
              <MaterialCommunityIcons name="whistle" size={20} color="#FF8C00" />
            </View>
            <Text style={styles.menuText}>Sport Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#4F9EFF22' }]}>
              <Ionicons name="notifications-outline" size={20} color="#4F9EFF" />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#FF453A22' }]}>
              <Ionicons name="log-out-outline" size={20} color="#FF453A" />
            </View>
            <Text style={[styles.menuText, { color: '#FF453A' }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 36,
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    overflow: 'hidden',
  },
  accentCircle:  { position: 'absolute', borderRadius: 999 },
  accentCircle1: { width: 200, height: 200, top: -60, right: -60 },
  accentCircle2: { width: 140, height: 140, top: -20, left: -50 },

  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5,
    padding: 4,
    marginBottom: 14,
  },
  avatarInner: {
    flex: 1, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { fontSize: 38, fontWeight: '900' },

  name: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  bio:  { fontSize: 14, color: '#636366', marginTop: 5 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 20, marginTop: 24, gap: 12,
  },
  statsLoading: { height: 140, justifyContent: 'center', alignItems: 'center' },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#2C2C2E',
    borderRadius: 18,
    paddingVertical: 18, paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  statIcon:  { marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#636366', fontWeight: '600' },

  // Menu
  menuContainer: { marginTop: 32, paddingHorizontal: 20, paddingBottom: 50 },
  menuSection: { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#2C2C2E',
    padding: 14, borderRadius: 14, marginBottom: 10,
  },
  logoutItem: { marginTop: 10 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
