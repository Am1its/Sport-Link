import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { getAvatarColor } from '../../utils/avatar';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../../constants/sports';
import { Colors, Spacing, Radius, Type, Shadow } from '../../constants/theme';
import { ProfileStatsSkeleton } from '../../components/SkeletonLoader';
import { API } from '../../constants/endpoints';
import { ROUTES } from '../../constants/routes';
import { useFloatingOrb, useCountUp, useStaggerEntrance } from '../../hooks/useAnimations';
import type { SportPref } from '../../types';
type Badge = { badge_key: string; earned_at: string };

const BADGE_LABELS: Record<string, string> = {
  first_game:       '🏅 First Game',
  game_5:           '⭐ 5 Games',
  game_25:          '🔥 25 Games',
  game_50:          '💎 50 Games',
  host_5:           '🎯 5 Hosted',
  host_25:          '🏆 25 Hosted',
  streak_3:         '🔥 3 Streak',
  streak_7:         '⚡ 7 Streak',
  streak_30:        '🌟 30 Streak',
  social_butterfly: '🦋 Social',
};

type Stats = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  games_hosted: number;
  games_joined: number;
  karma: number;
  top_sport: string | null;
  current_streak: number;
  longest_streak: number;
  sport_preferences: SportPref[];
  badges: Badge[];
};

const SKILL_LABELS = ['', 'Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro'];

function FloatingBlob({ style, color, phase }: { style: any; color: string; phase: number }) {
  const floatStyle = useFloatingOrb(phase);
  return <Animated.View style={[style, { backgroundColor: color }, floatStyle]} />;
}

function SportChip({ pref, index }: { pref: SportPref; index: number }) {
  const animStyle = useStaggerEntrance(index, 100);
  const c   = SPORT_COLORS[pref.sport_type] ?? Colors.textMuted;
  const ic  = SPORT_ICONS[pref.sport_type]  ?? 'help-circle';
  const lvl = SKILL_LABELS[pref.skill_level] ?? '';
  return (
    <Animated.View style={animStyle}>
      <View style={[styles.sportChip, { borderColor: c + '55', backgroundColor: c + '14' }]}>
        <MaterialCommunityIcons name={ic as any} size={17} color={c} />
        <View>
          <View style={styles.chipNameRow}>
            <Text style={[styles.chipName, { color: c }]}>
              {sportLabel(pref.sport_type)}
            </Text>
            {!!pref.is_favorite && <Ionicons name="heart" size={10} color={Colors.error} />}
          </View>
          <Text style={[styles.chipLevel, { color: c + 'AA' }]}>{lvl}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { token, logout } = useAuth();

  const [stats, setStats]               = useState<Stats | null>(null);
  const [isEditing, setIsEditing]       = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio]           = useState('');
  const [editAvatar, setEditAvatar]     = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const tabOpacity = useSharedValue(0);
  const tabFadeStyle = useAnimatedStyle(() => ({ opacity: tabOpacity.value }));

  useFocusEffect(
    useCallback(() => {
      tabOpacity.value = 0;
      tabOpacity.value = withTiming(1, { duration: 180 });
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const res  = await apiFetch(API.ME, { token });
          const data = await res.json();
          if (data.success) setStats(data.user);
        } catch (err: any) {
          if (err?.name !== 'UnauthorizedError') console.error('Stats fetch error:', err);
        }
      };
      const fetchUnread = async () => {
        try {
          const res  = await apiFetch(API.NOTIFICATIONS, { token });
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
      mediaTypes: ['images'],
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
        bio:      editBio.trim() || null,
      };
      if (editAvatar) body.avatar = editAvatar;
      const res  = await apiFetch(API.ME, { method: 'PUT', token, body: JSON.stringify(body) });
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
    router.replace(ROUTES.LOGIN);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, hosted games, messages, ratings, and all other data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Your account and all associated data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Permanently',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      const res  = await apiFetch(API.ME, { method: 'DELETE', token });
                      const data = await res.json();
                      if (!data.success) {
                        setDeletingAccount(false);
                        return Alert.alert('Error', data.message || 'Could not delete account');
                      }
                      await logout();
                      router.replace(ROUTES.LOGIN);
                    } catch {
                      setDeletingAccount(false);
                      Alert.alert('Error', 'Could not connect to server');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const username    = stats?.username ?? '—';
  const initial     = username.charAt(0).toUpperCase();
  const avatarColor = (stats?.top_sport ? SPORT_COLORS[stats.top_sport] : null) ?? getAvatarColor(username);
  const avatarUri   = editAvatar
    ? `data:image/jpeg;base64,${editAvatar}`
    : stats?.avatar
      ? `data:image/jpeg;base64,${stats.avatar}`
      : null;

  const totalGames    = (stats?.games_hosted ?? 0) + (stats?.games_joined ?? 0);
  const karma         = stats?.karma ?? 0;
  const karmaColor    = karma > 0 ? Colors.accent : karma < 0 ? Colors.error : Colors.textMuted;
  const prefs         = stats?.sport_preferences ?? [];
  const badges        = stats?.badges ?? [];
  const currentStreak = stats?.current_streak ?? 0;

  const hostedCount = useCountUp(stats?.games_hosted ?? 0);
  const joinedCount = useCountUp(stats?.games_joined ?? 0);
  const karmaCount  = useCountUp(Math.abs(stats?.karma ?? 0));
  const gamesCount  = useCountUp(totalGames);

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.bg }, tabFadeStyle]}>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* ── Hero band — layered for depth ── */}
      <View style={[styles.heroBand, { backgroundColor: avatarColor + '22' }]}>
        <FloatingBlob style={styles.heroBlob1} color={avatarColor + '40'} phase={0}    />
        <FloatingBlob style={styles.heroBlob2} color={avatarColor + '28'} phase={0.43} />
        <FloatingBlob style={styles.heroBlob3} color={avatarColor + '18'} phase={0.87} />
        {/* Grid lines for sporty feel */}
        <View style={styles.heroGrid} />
      </View>

      {/* ── Avatar — overlaps hero ── */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={[styles.avatarRing, {
            borderColor: isEditing ? Colors.accent : avatarColor,
            ...Shadow.medium,
          }]}
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
                <Ionicons name="camera" size={22} color={Colors.text} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Name / Bio / Edit */}
        {isEditing ? (
          <>
            <TextInput
              style={styles.editNameInput}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              maxLength={30}
            />
            <TextInput
              style={styles.editBioInput}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Add a short bio..."
              placeholderTextColor={Colors.textMuted}
              maxLength={120}
              multiline
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.name}>{username}</Text>
            {stats?.bio
              ? <Text style={styles.bio}>{stats.bio}</Text>
              : <Text style={[styles.bio, { color: Colors.textHint, fontStyle: 'italic' }]}>No bio yet</Text>}
            <TouchableOpacity style={styles.editProfileBtn} onPress={enterEditMode}>
              <Ionicons name="pencil-outline" size={13} color={Colors.accent} />
              <Text style={styles.editProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Stats bar ── */}
      {!stats ? (
        <ProfileStatsSkeleton />
      ) : (
        <View style={[styles.statsBar, Shadow.card]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.text }]}>{gamesCount}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>{hostedCount}</Text>
            <Text style={styles.statLabel}>Hosted</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.blue }]}>{joinedCount}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: karmaColor }]}>{karma < 0 ? '-' : karma > 0 ? '+' : ''}{karmaCount}</Text>
            <Text style={styles.statLabel}>Karma</Text>
          </View>
        </View>
      )}

      {/* ── Streak pill ── */}
      {currentStreak > 0 && (
        <View style={styles.streakRow}>
          <View style={styles.streakPill}>
            <Text style={styles.streakText}>🔥 {currentStreak} game streak</Text>
          </View>
        </View>
      )}

      {/* ── Badges ── */}
      {badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={styles.badgesSectionTitle}>Badges</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
            {badges.map(b => (
              <View key={b.badge_key} style={styles.badgeChip}>
                <Text style={styles.badgeText}>{BADGE_LABELS[b.badge_key] ?? b.badge_key}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Sport chips ── */}
      {prefs.length > 0 && (
        <View style={styles.sportsSection}>
          <View style={styles.sportsSectionHeader}>
            <Text style={styles.sportsSectionTitle}>Sports</Text>
            <TouchableOpacity onPress={() => router.push(ROUTES.SPORT_PREFERENCES as any)}>
              <Text style={styles.sportsSectionEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportsScroll}>
            {prefs.map((pref, i) => (
              <SportChip key={pref.sport_type} pref={pref} index={i} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Menu ── */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuSection}>Community</Text>
        {[
          { icon: 'trophy-outline',    iconColor: Colors.yellow,  bg: Colors.yellow + '20', label: 'Leaderboard',       route: ROUTES.LEADERBOARD },
          { icon: 'people-outline',    iconColor: Colors.blue,    bg: Colors.blueFaint,     label: 'Friends',           route: ROUTES.FRIENDS },
          { icon: 'pulse-outline',     iconColor: Colors.orange,  bg: Colors.orange + '20', label: 'Friend Activity',   route: ROUTES.ACTIVITY },
          { icon: 'magnet-outline',    iconColor: Colors.accent,  bg: Colors.accentFaint,   label: 'Discover Players',  route: ROUTES.PLAYER_MATCHING },
        ].map(item => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={() => router.push(item.route as any)} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
              </View>
              <Text style={styles.menuText}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={Colors.textHint} />
          </TouchableOpacity>
        ))}

        <Text style={[styles.menuSection, { marginTop: Spacing.xxl }]}>Account</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push(ROUTES.SPORT_PREFERENCES as any)} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: Colors.orange + '20' }]}>
              <MaterialCommunityIcons name="whistle" size={20} color={Colors.orange} />
            </View>
            <Text style={styles.menuText}>Sport Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.textHint} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push(ROUTES.NOTIFICATION_INBOX as any)} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: Colors.blueFaint }]}>
              <Ionicons name="notifications-outline" size={20} color={Colors.blue} />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            {unreadNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.textHint} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push(ROUTES.NOTIFICATIONS_SETTINGS as any)} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: Colors.blueFaint }]}>
              <Ionicons name="settings-outline" size={20} color={Colors.blue} />
            </View>
            <Text style={styles.menuText}>Notification Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.textHint} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push(ROUTES.BLOCKED_USERS as any)} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: Colors.errorFaint }]}>
              <Ionicons name="ban-outline" size={20} color={Colors.error} />
            </View>
            <Text style={styles.menuText}>Blocked Users</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.textHint} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: Colors.errorFaint }]}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            </View>
            <Text style={[styles.menuText, { color: Colors.error }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          disabled={deletingAccount}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconWrap, { backgroundColor: Colors.errorFaint }]}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
            </View>
            <Text style={[styles.menuText, { color: Colors.error }]}>Delete Account</Text>
          </View>
          {deletingAccount && <ActivityIndicator size="small" color={Colors.error} />}
        </TouchableOpacity>
      </View>

    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Hero band — layered orbs for depth
  heroBand:  { height: 140, width: '100%', overflow: 'hidden' },
  heroBlob1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -90, right: -50 },
  heroBlob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  top: -50, left:  -60 },
  heroBlob3: { position: 'absolute', width: 140, height: 140, borderRadius: 70,  bottom: -60, right: 60 },
  heroGrid:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04,
               // Subtle diagonal lines via border trick
               borderStyle: 'solid', borderWidth: 0 },

  // Avatar
  avatarSection: { alignItems: 'center', marginTop: -54, paddingBottom: 20, paddingHorizontal: Spacing.xl },
  avatarRing:    { width: 104, height: 104, borderRadius: 52, borderWidth: 3.5, padding: 3, backgroundColor: Colors.bg, marginBottom: 14 },
  avatarInner:   { flex: 1, borderRadius: 46, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  avatarImage:   { width: '100%', height: '100%' },
  avatarLetter:  { fontSize: 40, fontWeight: '900' },
  avatarEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },

  name: { ...Type.name, color: Colors.text },
  bio:  { fontSize: 14, color: Colors.textMuted, marginTop: 5, textAlign: 'center', lineHeight: 20 },

  editProfileBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  editProfileBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },

  editNameInput: { width: '100%', fontSize: 20, fontWeight: '800', color: Colors.text, borderBottomWidth: 1.5, borderBottomColor: Colors.accent, paddingVertical: 6, textAlign: 'center', marginBottom: 10 },
  editBioInput:  { width: '100%', fontSize: 14, color: Colors.textSub, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 6, marginBottom: 16, minHeight: 40 },
  editActions:   { flexDirection: 'row', gap: 12, marginTop: 4, width: '100%' },
  cancelBtn:     { flex: 1, height: 42, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface2 },
  cancelBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  saveBtn:       { flex: 1, height: 42, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.accent },
  saveBtnText:   { color: Colors.bg, fontWeight: '900', fontSize: 14 },

  // Stats bar
  statsBar:    { flexDirection: 'row', marginHorizontal: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: 6 },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue:   { ...Type.stat, marginBottom: 3 },
  statLabel:   { ...Type.statLabel, color: Colors.textMuted },

  // Streak
  streakRow:  { alignItems: 'center', marginTop: Spacing.md, marginBottom: 2 },
  streakPill: { paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.orange + '22', borderWidth: 1, borderColor: Colors.orange + '55' },
  streakText: { color: Colors.orange, fontSize: 13, fontWeight: '700' },

  // Badges
  badgesSection:      { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, marginBottom: 4 },
  badgesSectionTitle: { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: 10 },
  badgesScroll:       { gap: 8, paddingRight: 4 },
  badgeChip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  badgeText:          { color: Colors.text, fontSize: 13, fontWeight: '600' },

  // Sports
  sportsSection:       { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, marginBottom: 6 },
  sportsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sportsSectionTitle:  { ...Type.sectionLabel, color: Colors.textMuted },
  sportsSectionEdit:   { fontSize: 13, color: Colors.accent, fontWeight: '700' },
  sportsScroll:        { gap: 8, paddingRight: 4 },
  sportChip:           { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.lg, borderWidth: 1 },
  chipNameRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipName:            { fontSize: 13, fontWeight: '700' },
  chipLevel:           { fontSize: 11, fontWeight: '600', marginTop: 1 },

  // Menu
  menuContainer: { marginTop: Spacing.xxl, paddingHorizontal: Spacing.xl, paddingBottom: 50 },
  menuSection:   { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: 10 },
  menuItem:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.lg, marginBottom: 10 },
  logoutItem:    { marginTop: 10 },
  menuItemLeft:  { flexDirection: 'row', alignItems: 'center' },
  menuIconWrap:  { width: 36, height: 36, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText:      { color: Colors.text, fontSize: 15, fontWeight: '600' },

  notifBadge:     { backgroundColor: Colors.error, borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  notifBadgeText: { color: Colors.text, fontSize: 11, fontWeight: '800' },
});
