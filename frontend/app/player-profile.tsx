import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../constants/sports';
import { Colors, Spacing, Radius, Type, Shadow } from '../constants/theme';

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';
type SportPref = { sport_type: string; skill_level: number; is_favorite: number | boolean };

type PublicUser = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  karma: number;
  games_hosted: number;
  games_joined: number;
  top_sport: string | null;
  sport_preferences: SportPref[];
  friendship_status: FriendshipStatus;
  friendship_id: number | null;
};

const SKILL_LABELS = ['', 'Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro'];

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { token, user: me } = useAuth();

  const [profile, setProfile]       = useState<PublicUser | null>(null);
  const [loading, setLoading]       = useState(true);
  const [friendLoading, setFriendLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiFetch(`/api/users/${userId}`, { token });
        const data = await res.json();
        if (data.success) setProfile(data.user);
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
        console.error('Player profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId) fetchProfile();
  }, [userId]);

  const handleFriendAction = async () => {
    if (!profile || friendLoading) return;
    setFriendLoading(true);
    try {
      if (profile.friendship_status === 'none') {
        const res = await apiFetch('/api/friends', { method: 'POST', token, body: JSON.stringify({ addressee_id: profile.id }) });
        const data = await res.json();
        if (data.success) {
          setProfile(p => p ? { ...p, friendship_status: 'pending_sent' } : p);
        } else {
          Alert.alert('Error', data.message);
        }
      } else if (profile.friendship_status === 'pending_received') {
        const res = await apiFetch(`/api/friends/${profile.friendship_id}/accept`, { method: 'PUT', token });
        const data = await res.json();
        if (data.success) {
          setProfile(p => p ? { ...p, friendship_status: 'friends' } : p);
        } else {
          Alert.alert('Error', data.message);
        }
      } else if (profile.friendship_status === 'friends' || profile.friendship_status === 'pending_sent') {
        Alert.alert(
          profile.friendship_status === 'friends' ? 'Remove Friend' : 'Cancel Request',
          profile.friendship_status === 'friends'
            ? `Remove ${profile.username} from friends?`
            : `Cancel friend request to ${profile.username}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm', style: 'destructive', onPress: async () => {
                const res = await apiFetch(`/api/friends/${profile.friendship_id}`, { method: 'DELETE', token });
                const data = await res.json();
                if (data.success) {
                  setProfile(p => p ? { ...p, friendship_status: 'none', friendship_id: null } : p);
                } else {
                  Alert.alert('Error', data.message);
                }
              },
            },
          ]
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setFriendLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingCircle}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={60} color={Colors.surface2} />
        <Text style={styles.errorText}>Player not found</Text>
        <TouchableOpacity style={styles.backBtnCenter} onPress={() => router.back()}>
          <Text style={styles.backBtnCenterText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMe = me?.id === profile.id;
  const color = (profile.top_sport ? SPORT_COLORS[profile.top_sport] : null) ?? getAvatarColor(profile.username);
  const karmaStr = profile.karma > 0 ? `+${profile.karma}` : `${profile.karma}`;
  const karmaColor = profile.karma > 0 ? Colors.accent : profile.karma < 0 ? Colors.error : Colors.textMuted;
  const totalGames = profile.games_hosted + profile.games_joined;
  const prefs = profile.sport_preferences ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Hero band ── */}
      <View style={[styles.heroBand, { backgroundColor: color + '28' }]}>
        <View style={[styles.heroBlob1, { backgroundColor: color + '40' }]} />
        <View style={[styles.heroBlob2, { backgroundColor: color + '28' }]} />
        <View style={[styles.heroBlob3, { backgroundColor: color + '18' }]} />
        {/* Back button inside hero */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        {isMe && (
          <View style={styles.youTag}>
            <Text style={styles.youTagText}>Your Profile</Text>
          </View>
        )}
      </View>

      {/* ── Avatar section ── */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatarRing, { borderColor: color, ...Shadow.medium }]}>
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
          {profile.top_sport && (
            <View style={[styles.sportBadge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
              <MaterialCommunityIcons name={SPORT_ICONS[profile.top_sport] as any} size={14} color={color} />
            </View>
          )}
        </View>

        <Text style={styles.username}>{profile.username}</Text>
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioEmpty}>No bio yet</Text>
        )}
      </View>

      {/* ── Stats bar ── */}
      <View style={[styles.statsBar, Shadow.card]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.text }]}>{totalGames}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.accent }]}>{profile.games_hosted}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.blue }]}>{profile.games_joined}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: karmaColor }]}>{karmaStr}</Text>
          <Text style={styles.statLabel}>Karma</Text>
        </View>
      </View>

      {/* ── Sport Preferences ── */}
      {prefs.length > 0 && (
        <View style={styles.sportsSection}>
          <Text style={styles.sportsSectionTitle}>Sports</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportsScroll}>
            {prefs.map(pref => {
              const c = SPORT_COLORS[pref.sport_type] ?? Colors.textMuted;
              const ic = SPORT_ICONS[pref.sport_type] ?? 'help-circle';
              const lvl = SKILL_LABELS[pref.skill_level] ?? '';
              return (
                <View key={pref.sport_type} style={[styles.sportChip, { borderColor: c + '66', backgroundColor: c + '18' }]}>
                  <MaterialCommunityIcons name={ic as any} size={18} color={c} />
                  <View>
                    <View style={styles.chipNameRow}>
                      <Text style={[styles.chipName, { color: c }]}>
                        {sportLabel(pref.sport_type)}
                      </Text>
                      {!!pref.is_favorite && <Ionicons name="heart" size={11} color={Colors.error} />}
                    </View>
                    <Text style={[styles.chipLevel, { color: c + 'AA' }]}>{lvl}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Friend + Message buttons ── */}
      {!isMe && (() => {
        const s = profile.friendship_status;
        const btnStyle =
          s === 'friends'
            ? { backgroundColor: Colors.errorFaint, borderWidth: 1, borderColor: Colors.errorBorder }
            : s === 'pending_sent'
            ? { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }
            : s === 'pending_received'
            ? { backgroundColor: Colors.blue }
            : { backgroundColor: Colors.accent };
        const textColor =
          s === 'friends'          ? Colors.error :
          s === 'pending_sent'     ? Colors.textMuted :
          s === 'pending_received' ? Colors.text :
                                     Colors.bg;
        const iconName: any =
          s === 'friends'          ? 'person-remove-outline' :
          s === 'pending_sent'     ? 'time-outline' :
          s === 'pending_received' ? 'checkmark-circle-outline' :
                                     'person-add-outline';
        const label =
          s === 'friends'          ? 'Remove Friend' :
          s === 'pending_sent'     ? 'Request Sent' :
          s === 'pending_received' ? 'Accept Request' :
                                     'Add Friend';
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.friendBtn, btnStyle]}
              onPress={handleFriendAction}
              disabled={friendLoading}
              activeOpacity={0.8}
            >
              {friendLoading
                ? <ActivityIndicator size="small" color={textColor} />
                : <>
                    <Ionicons name={iconName} size={18} color={textColor} />
                    <Text style={[styles.friendBtnText, { color: textColor }]}>{label}</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.msgBtn}
              onPress={() => router.push({ pathname: '/direct-chat' as any, params: { userId: String(profile.id), username: profile.username } })}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={22} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        );
      })()}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 30 },

  loadingCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  loadingText:   { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },

  // Hero — 3-orb design
  heroBand:  { height: 140, width: '100%', overflow: 'hidden' },
  heroBlob1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -90,  right: -50 },
  heroBlob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  top: -50,  left: -60 },
  heroBlob3: { position: 'absolute', width: 140, height: 140, borderRadius: 70,  bottom: -60, right: 60 },
  backBtn:   { position: 'absolute', top: 56, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  youTag:    { position: 'absolute', bottom: 12, right: 20, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  youTagText: { color: Colors.text, fontSize: 12, fontWeight: '800' },

  // Avatar
  avatarSection: { alignItems: 'center', marginTop: -56, paddingBottom: 20 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarRing:    { width: 100, height: 100, borderRadius: 50, borderWidth: 3.5, padding: 3, backgroundColor: Colors.bg },
  sportBadge:    { position: 'absolute', bottom: 2, right: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  avatarInner:   { flex: 1, borderRadius: 46, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  avatarImage:   { width: '100%', height: '100%' },
  avatarLetter:  { fontSize: 42, fontWeight: '900' },
  username:  { ...Type.name, color: Colors.text, marginBottom: 6 },
  bio:       { ...Type.body, color: Colors.textSub, textAlign: 'center', paddingHorizontal: 40 },
  bioEmpty:  { ...Type.body, color: Colors.textHint, textAlign: 'center' },

  // Stats bar
  statsBar:    { flexDirection: 'row', marginHorizontal: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: 6 },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue:   { ...Type.stat, marginBottom: 2 },
  statLabel:   { ...Type.statLabel, color: Colors.textMuted },

  // Sports
  sportsSection:      { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, marginBottom: 6 },
  sportsSectionTitle: { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: 10 },
  sportsScroll:  { gap: 8 },
  sportChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1 },
  chipNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipName:      { fontSize: 13, fontWeight: '700' },
  chipLevel:     { fontSize: 11, fontWeight: '600', marginTop: 1 },

  // Action row
  actionRow:     { flexDirection: 'row', marginHorizontal: Spacing.xl, marginTop: Spacing.xl, gap: 10 },
  friendBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.lg },
  friendBtnText: { fontSize: 15, fontWeight: '700' },
  msgBtn:        { width: 52, height: 52, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint, justifyContent: 'center', alignItems: 'center' },

  errorText:         { color: Colors.textMuted, fontSize: 16, marginTop: 14 },
  backBtnCenter:     { marginTop: 20, backgroundColor: Colors.surface, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md },
  backBtnCenterText: { color: Colors.text, fontWeight: '700' },
});
