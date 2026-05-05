import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../constants/api';

const AVATAR_PALETTE = ['#FF8C00', '#4F9EFF', '#FF453A', '#FFD700', '#A78BFA', '#0FEA95', '#FF6B9D', '#34C759'];
const getAvatarColor = (name: string) =>
  AVATAR_PALETTE[(name.charCodeAt(0) + name.length) % AVATAR_PALETTE.length];

type PublicUser = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  karma: number;
  games_hosted: number;
  games_joined: number;
};

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { token, user: me } = useAuth();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setProfile(data.user);
      } catch (err) {
        console.error('Player profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={60} color="#3A3A3C" />
        <Text style={styles.errorText}>Player not found</Text>
        <TouchableOpacity style={styles.backBtnCenter} onPress={() => router.back()}>
          <Text style={styles.backBtnCenterText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMe = me?.id === profile.id;
  const color = getAvatarColor(profile.username);
  const karmaStr = profile.karma > 0 ? `+${profile.karma}` : `${profile.karma}`;
  const karmaColor = profile.karma > 0 ? '#0FEA95' : profile.karma < 0 ? '#FF453A' : '#8E8E93';
  const totalGames = profile.games_hosted + profile.games_joined;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        {isMe && (
          <View style={styles.youTag}>
            <Text style={styles.youTagText}>Your Profile</Text>
          </View>
        )}
        <View style={{ width: 40 }} />
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatarRing, { borderColor: color }]}>
          <View style={styles.avatarInner}>
            {profile.avatar ? (
              <Image source={{ uri: `data:image/jpeg;base64,${profile.avatar}` }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarLetter, { color }]}>
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.username}>{profile.username}</Text>
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioEmpty}>No bio yet</Text>
        )}
      </View>

      {/* Karma */}
      <View style={[styles.karmaCard, { borderColor: karmaColor + '55' }]}>
        <Ionicons name="flash" size={28} color={karmaColor} />
        <Text style={[styles.karmaValue, { color: karmaColor }]}>{karmaStr}</Text>
        <Text style={styles.karmaLabel}>Karma</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalGames}</Text>
          <Text style={styles.statLabel}>Total Games</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={[styles.statValue, { color: '#0FEA95' }]}>{profile.games_hosted}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#4F9EFF' }]}>{profile.games_joined}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center: { flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40 },
  youTag: { backgroundColor: '#0FEA9522', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#0FEA9555' },
  youTagText: { color: '#0FEA95', fontSize: 12, fontWeight: '800' },

  avatarSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 28 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, padding: 3, marginBottom: 16 },
  avatarInner: { flex: 1, borderRadius: 46, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C2C2E' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 42, fontWeight: '900' },
  username: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  bio: { fontSize: 14, color: '#8E8E93', textAlign: 'center', paddingHorizontal: 40 },
  bioEmpty: { fontSize: 14, color: '#48484A', textAlign: 'center' },

  karmaCard: { marginHorizontal: 20, backgroundColor: '#2C2C2E', borderRadius: 18, borderWidth: 1.5, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  karmaValue: { fontSize: 36, fontWeight: '900' },
  karmaLabel: { fontSize: 14, color: '#636366', fontWeight: '600' },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 12, marginBottom: 40 },
  statCard: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16, alignItems: 'center' },
  statCardMiddle: {},
  statValue: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#636366', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  errorText: { color: '#636366', fontSize: 16, marginTop: 14 },
  backBtnCenter: { marginTop: 20, backgroundColor: '#2C2C2E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnCenterText: { color: '#FFFFFF', fontWeight: '700' },
});
