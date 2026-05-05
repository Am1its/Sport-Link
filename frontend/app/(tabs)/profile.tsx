import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../constants/api';

type Stats = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  games_hosted: number;
  games_joined: number;
  karma: number;
};

const AVATAR_PALETTE = ['#FF8C00', '#4F9EFF', '#FF453A', '#FFD700', '#A78BFA', '#0FEA95', '#FF6B9D', '#34C759'];
const getAvatarColor = (name: string) =>
  AVATAR_PALETTE[(name.charCodeAt(0) + name.length) % AVATAR_PALETTE.length];

function StatCard({ iconLib, icon, value, label, valueColor }: {
  iconLib: 'ion' | 'mci'; icon: string; value: string | number; label: string; valueColor: string;
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
  const { token, logout } = useAuth();

  const [stats, setStats]     = useState<Stats | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio]     = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [saving, setSaving]    = useState(false);

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

  const enterEditMode = () => {
    setEditUsername(stats?.username ?? '');
    setEditBio(stats?.bio ?? '');
    setEditAvatar(null);
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setEditAvatar(result.assets[0].base64);
    }
  };

  const handleSave = async () => {
    if (!editUsername.trim()) return Alert.alert('Error', 'Username cannot be empty');
    setSaving(true);
    try {
      const body: Record<string, any> = {
        username: editUsername.trim(),
        bio: editBio.trim() || null,
      };
      if (editAvatar) body.avatar = editAvatar;

      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      setStats(data.user);
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const username    = stats?.username ?? '—';
  const initial     = username.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(username);
  const avatarUri   = editAvatar
    ? `data:image/jpeg;base64,${editAvatar}`
    : stats?.avatar
      ? `data:image/jpeg;base64,${stats.avatar}`
      : null;

  const totalGames  = (stats?.games_hosted ?? 0) + (stats?.games_joined ?? 0);
  const karma       = stats?.karma ?? 0;
  const karmaStr    = karma > 0 ? `+${karma}` : `${karma}`;
  const karmaColor  = karma > 0 ? '#0FEA95' : karma < 0 ? '#FF453A' : '#8E8E93';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={[styles.accentCircle, styles.accentCircle1, { backgroundColor: avatarColor + '18' }]} />
        <View style={[styles.accentCircle, styles.accentCircle2, { backgroundColor: avatarColor + '10' }]} />

        {/* Avatar */}
        <TouchableOpacity
          style={[styles.avatarRing, { borderColor: isEditing ? '#0FEA95' : avatarColor }]}
          onPress={isEditing ? pickAvatar : undefined}
          activeOpacity={isEditing ? 0.7 : 1}
        >
          <View style={styles.avatarInner}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarLetter, { color: avatarColor }]}>{initial}</Text>
            )}
            {isEditing && (
              <View style={styles.avatarEditOverlay}>
                <Ionicons name="camera" size={22} color="#FFFFFF" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Name / Bio */}
        {isEditing ? (
          <>
            <TextInput
              style={styles.editNameInput}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Username"
              placeholderTextColor="#636366"
              autoCapitalize="none"
              maxLength={30}
            />
            <TextInput
              style={styles.editBioInput}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Add a short bio..."
              placeholderTextColor="#636366"
              maxLength={120}
              multiline
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#1C1C1E" size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.name}>{username}</Text>
            <Text style={styles.bio}>{stats?.bio || 'Living and breathing sports'}</Text>
            <TouchableOpacity style={styles.editProfileBtn} onPress={enterEditMode}>
              <Ionicons name="pencil-outline" size={14} color="#0FEA95" />
              <Text style={styles.editProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Stats Grid ── */}
      {stats ? (
        <View style={styles.statsGrid}>
          <StatCard iconLib="ion" icon="trophy-outline"  value={totalGames}         label="Total Games" valueColor="#FFFFFF" />
          <StatCard iconLib="ion" icon="shield-outline"  value={stats.games_hosted}  label="Hosted"      valueColor="#0FEA95" />
          <StatCard iconLib="ion" icon="people-outline"  value={stats.games_joined}  label="Joined"      valueColor="#4F9EFF" />
          <StatCard iconLib="ion" icon="flash"           value={karmaStr}            label="Karma"       valueColor={karmaColor} />
        </View>
      ) : (
        <View style={styles.statsLoading}>
          <ActivityIndicator color="#0FEA95" />
        </View>
      )}

      {/* ── Menu ── */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuSection}>Account</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/sport-preferences' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#FF8C0022' }]}>
              <MaterialCommunityIcons name="whistle" size={20} color="#FF8C00" />
            </View>
            <Text style={styles.menuText}>Sport Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications-settings' as any)}>
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

  header: { alignItems: 'center', paddingTop: 70, paddingBottom: 36, marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2E', overflow: 'hidden' },
  accentCircle: { position: 'absolute', borderRadius: 999 },
  accentCircle1: { width: 200, height: 200, top: -60, right: -60 },
  accentCircle2: { width: 140, height: 140, top: -20, left: -50 },

  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, padding: 3, marginBottom: 14 },
  avatarInner: { flex: 1, borderRadius: 44, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C2C2E' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 38, fontWeight: '900' },
  avatarEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },

  name: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  bio:  { fontSize: 14, color: '#636366', marginTop: 5, textAlign: 'center' },

  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#0FEA9555', backgroundColor: '#0FEA9510' },
  editProfileBtnText: { color: '#0FEA95', fontSize: 13, fontWeight: '700' },

  editNameInput: { width: '100%', fontSize: 20, fontWeight: '800', color: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#0FEA95', paddingVertical: 6, textAlign: 'center', marginBottom: 10 },
  editBioInput:  { width: '100%', fontSize: 14, color: '#AEAEB2', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#3A3A3C', paddingVertical: 6, marginBottom: 16, minHeight: 40 },
  editActions:   { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn:     { flex: 1, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3A3A3C' },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  saveBtn:       { flex: 1, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0FEA95' },
  saveBtnText:   { color: '#1C1C1E', fontWeight: '900', fontSize: 14 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, marginTop: 24, gap: 12 },
  statsLoading: { height: 140, justifyContent: 'center', alignItems: 'center' },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#2C2C2E', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'flex-start' },
  statIcon:  { marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#636366', fontWeight: '600' },

  menuContainer: { marginTop: 32, paddingHorizontal: 20, paddingBottom: 50 },
  menuSection: { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2C2C2E', padding: 14, borderRadius: 14, marginBottom: 10 },
  logoutItem: { marginTop: 10 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
