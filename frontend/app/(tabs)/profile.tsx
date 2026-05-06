import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { getAvatarColor } from '../../utils/avatar';
import { SPORT_COLORS, SPORT_ICONS } from '../../constants/sports';

type SportPref = { sport_type: string; skill_level: number; is_favorite: number | boolean };

type Stats = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  games_hosted: number;
  games_joined: number;
  karma: number;
  top_sport: string | null;
  sport_preferences: SportPref[];
};

const SKILL_LABELS = ['', 'Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro'];

export default function ProfileScreen() {
  const router = useRouter();
  const { token, logout } = useAuth();

  const [stats, setStats]           = useState<Stats | null>(null);
  const [isEditing, setIsEditing]   = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio]       = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const res = await apiFetch('/api/users/me', { token });
          const data = await res.json();
          if (data.success) setStats(data.user);
        } catch (err: any) {
          if (err?.name !== 'UnauthorizedError') console.error('Stats fetch error:', err);
        }
      };
      const fetchUnread = async () => {
        try {
          const res = await apiFetch('/api/notifications', { token });
          const data = await res.json();
          if (data.success) setUnreadNotifs(data.unread_count);
        } catch {}
      };
      fetchStats();
      fetchUnread();
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

      const res = await apiFetch('/api/users/me', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      setStats(prev => prev ? { ...prev, ...data.user } : data.user);
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
  const avatarColor = (stats?.top_sport ? SPORT_COLORS[stats.top_sport] : null) ?? getAvatarColor(username);
  const avatarUri   = editAvatar
    ? `data:image/jpeg;base64,${editAvatar}`
    : stats?.avatar
      ? `data:image/jpeg;base64,${stats.avatar}`
      : null;

  const totalGames = (stats?.games_hosted ?? 0) + (stats?.games_joined ?? 0);
  const karma      = stats?.karma ?? 0;
  const karmaStr   = karma > 0 ? `+${karma}` : `${karma}`;
  const karmaColor = karma > 0 ? '#0FEA95' : karma < 0 ? '#FF453A' : '#8E8E93';
  const prefs      = stats?.sport_preferences ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* ── Hero band ── */}
      <View style={[styles.heroBand, { backgroundColor: avatarColor + '28' }]}>
        <View style={[styles.heroCircle1, { backgroundColor: avatarColor + '35' }]} />
        <View style={[styles.heroCircle2, { backgroundColor: avatarColor + '20' }]} />
      </View>

      {/* ── Avatar ── */}
      <View style={styles.avatarSection}>
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
              <TouchableOpacity style={styles.saveEditBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#1C1C1E" size="small" />
                  : <Text style={styles.saveEditBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.name}>{username}</Text>
            {stats?.bio
              ? <Text style={styles.bio}>{stats.bio}</Text>
              : <Text style={[styles.bio, { color: '#48484A', fontStyle: 'italic' }]}>No bio yet</Text>}
            <TouchableOpacity style={styles.editProfileBtn} onPress={enterEditMode}>
              <Ionicons name="pencil-outline" size={14} color="#0FEA95" />
              <Text style={styles.editProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Stats Bar ── */}
      {stats ? (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalGames}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#0FEA95' }]}>{stats.games_hosted}</Text>
            <Text style={styles.statLabel}>Hosted</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4F9EFF' }]}>{stats.games_joined}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: karmaColor }]}>{karmaStr}</Text>
            <Text style={styles.statLabel}>Karma</Text>
          </View>
        </View>
      ) : (
        <View style={styles.statsLoading}>
          <ActivityIndicator color="#0FEA95" />
        </View>
      )}

      {/* ── Sport Preferences ── */}
      {prefs.length > 0 && (
        <View style={styles.sportsSection}>
          <View style={styles.sportsSectionHeader}>
            <Text style={styles.sportsSectionTitle}>Sports</Text>
            <TouchableOpacity onPress={() => router.push('/sport-preferences' as any)}>
              <Text style={styles.sportsSectionEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportsScroll}>
            {prefs.map(pref => {
              const c = SPORT_COLORS[pref.sport_type] ?? '#636366';
              const ic = SPORT_ICONS[pref.sport_type] ?? 'help-circle';
              const lvl = SKILL_LABELS[pref.skill_level] ?? '';
              return (
                <View key={pref.sport_type} style={[styles.sportChip, { borderColor: c + '66', backgroundColor: c + '18' }]}>
                  <MaterialCommunityIcons name={ic as any} size={18} color={c} />
                  <View style={styles.chipText}>
                    <View style={styles.chipNameRow}>
                      <Text style={[styles.chipName, { color: c }]}>
                        {pref.sport_type.charAt(0).toUpperCase() + pref.sport_type.slice(1)}
                      </Text>
                      {!!pref.is_favorite && <Ionicons name="heart" size={11} color="#FF453A" />}
                    </View>
                    <Text style={[styles.chipLevel, { color: c + 'AA' }]}>{lvl}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Menu ── */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuSection}>Community</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/leaderboard' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFD70022' }]}>
              <Ionicons name="trophy-outline" size={20} color="#FFD700" />
            </View>
            <Text style={styles.menuText}>Leaderboard</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/friends' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#4F9EFF22' }]}>
              <Ionicons name="people-outline" size={20} color="#4F9EFF" />
            </View>
            <Text style={styles.menuText}>Friends</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/player-matching' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#0FEA9522' }]}>
              <Ionicons name="magnet-outline" size={20} color="#0FEA95" />
            </View>
            <Text style={styles.menuText}>Discover Players</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <Text style={[styles.menuSection, { marginTop: 24 }]}>Account</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/sport-preferences' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#FF8C0022' }]}>
              <MaterialCommunityIcons name="whistle" size={20} color="#FF8C00" />
            </View>
            <Text style={styles.menuText}>Sport Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notification-inbox' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#4F9EFF22' }]}>
              <Ionicons name="notifications-outline" size={20} color="#4F9EFF" />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            {unreadNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#48484A" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications-settings' as any)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#4F9EFF22' }]}>
              <Ionicons name="settings-outline" size={20} color="#4F9EFF" />
            </View>
            <Text style={styles.menuText}>Notification Settings</Text>
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

  // Hero
  heroBand: { height: 130, width: '100%', overflow: 'hidden' },
  heroCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, right: -40 },
  heroCircle2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -40, left: -50 },

  // Avatar section (overlaps hero band)
  avatarSection: { alignItems: 'center', marginTop: -52, paddingBottom: 20, paddingHorizontal: 20 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, padding: 3, backgroundColor: '#1C1C1E', marginBottom: 14 },
  avatarInner: { flex: 1, borderRadius: 46, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C2C2E' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 38, fontWeight: '900' },
  avatarEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },

  name: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  bio:  { fontSize: 14, color: '#636366', marginTop: 5, textAlign: 'center' },

  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#0FEA9555', backgroundColor: '#0FEA9510' },
  editProfileBtnText: { color: '#0FEA95', fontSize: 13, fontWeight: '700' },

  editNameInput: { width: '100%', fontSize: 20, fontWeight: '800', color: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#0FEA95', paddingVertical: 6, textAlign: 'center', marginBottom: 10 },
  editBioInput:  { width: '100%', fontSize: 14, color: '#AEAEB2', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#3A3A3C', paddingVertical: 6, marginBottom: 16, minHeight: 40 },
  editActions:   { flexDirection: 'row', gap: 12, marginTop: 4, width: '100%' },
  cancelBtn:     { flex: 1, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3A3A3C' },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  saveEditBtn:   { flex: 1, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0FEA95' },
  saveEditBtnText: { color: '#1C1C1E', fontWeight: '900', fontSize: 14 },

  // Stats bar
  statsBar:     { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#2C2C2E', borderRadius: 18, padding: 16, marginBottom: 6 },
  statsLoading: { height: 80, justifyContent: 'center', alignItems: 'center' },
  statItem:  { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#3A3A3C' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#636366', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Sports section
  sportsSection: { marginHorizontal: 20, marginTop: 16, marginBottom: 6 },
  sportsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sportsSectionTitle: { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  sportsSectionEdit:  { fontSize: 13, color: '#0FEA95', fontWeight: '700' },
  sportsScroll: { gap: 8 },
  sportChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  chipText:  { flexDirection: 'column' },
  chipNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipName:  { fontSize: 13, fontWeight: '700' },
  chipLevel: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  // Menu
  menuContainer: { marginTop: 24, paddingHorizontal: 20, paddingBottom: 50 },
  menuSection:   { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  menuItem:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2C2C2E', padding: 14, borderRadius: 14, marginBottom: 10 },
  logoutItem:    { marginTop: 10 },
  menuItemLeft:  { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap:  { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText:      { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  notifBadge:     { backgroundColor: '#FF453A', borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  notifBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
