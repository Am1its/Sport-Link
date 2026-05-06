import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { SPORT_COLORS, SPORT_ICONS } from '../constants/sports';

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
  const color = (profile.top_sport ? SPORT_COLORS[profile.top_sport] : null) ?? getAvatarColor(profile.username);
  const karmaStr = profile.karma > 0 ? `+${profile.karma}` : `${profile.karma}`;
  const karmaColor = profile.karma > 0 ? '#0FEA95' : profile.karma < 0 ? '#FF453A' : '#8E8E93';
  const totalGames = profile.games_hosted + profile.games_joined;
  const prefs = profile.sport_preferences ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Hero band ── */}
      <View style={[styles.heroBand, { backgroundColor: color + '28' }]}>
        <View style={[styles.heroCircle1, { backgroundColor: color + '35' }]} />
        <View style={[styles.heroCircle2, { backgroundColor: color + '20' }]} />
        {/* Back button inside hero */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
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
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalGames}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#0FEA95' }]}>{profile.games_hosted}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#4F9EFF' }]}>{profile.games_joined}</Text>
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
              const c = SPORT_COLORS[pref.sport_type] ?? '#636366';
              const ic = SPORT_ICONS[pref.sport_type] ?? 'help-circle';
              const lvl = SKILL_LABELS[pref.skill_level] ?? '';
              return (
                <View key={pref.sport_type} style={[styles.sportChip, { borderColor: c + '66', backgroundColor: c + '18' }]}>
                  <MaterialCommunityIcons name={ic as any} size={18} color={c} />
                  <View>
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

      {/* ── Friend + Message buttons ── */}
      {!isMe && (() => {
        const s = profile.friendship_status;
        const btnColor =
          s === 'friends'          ? '#2C2C2E' :
          s === 'pending_sent'     ? '#2C2C2E' :
          s === 'pending_received' ? '#4F9EFF' :
                                     '#0FEA95';
        const textColor =
          s === 'friends'          ? '#FF453A' :
          s === 'pending_sent'     ? '#8E8E93' :
          s === 'pending_received' ? '#FFFFFF' :
                                     '#1C1C1E';
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
              style={[styles.friendBtn, { backgroundColor: btnColor }]}
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
              <Ionicons name="chatbubble-outline" size={22} color="#0FEA95" />
            </TouchableOpacity>
          </View>
        );
      })()}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center:    { flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', padding: 30 },

  // Hero
  heroBand:    { height: 130, width: '100%', overflow: 'hidden', justifyContent: 'flex-end', paddingBottom: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end' },
  heroCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, right: -40 },
  heroCircle2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -40, left: -50 },
  backBtn:     { position: 'absolute', top: 60, left: 20, width: 40 },
  youTag:      { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  youTagText:  { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  // Avatar
  avatarSection: { alignItems: 'center', marginTop: -52, paddingBottom: 20 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarRing:    { width: 100, height: 100, borderRadius: 50, borderWidth: 3, padding: 3, backgroundColor: '#1C1C1E' },
  sportBadge:    { position: 'absolute', bottom: 2, right: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  avatarInner:   { flex: 1, borderRadius: 46, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C2C2E' },
  avatarImage:   { width: '100%', height: '100%' },
  avatarLetter:  { fontSize: 42, fontWeight: '900' },
  username:  { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  bio:       { fontSize: 14, color: '#8E8E93', textAlign: 'center', paddingHorizontal: 40 },
  bioEmpty:  { fontSize: 14, color: '#48484A', textAlign: 'center' },

  // Stats bar
  statsBar:    { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#2C2C2E', borderRadius: 18, padding: 16, marginBottom: 6 },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#3A3A3C' },
  statValue:   { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  statLabel:   { fontSize: 11, color: '#636366', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Sports
  sportsSection:      { marginHorizontal: 20, marginTop: 16, marginBottom: 6 },
  sportsSectionTitle: { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  sportsScroll:  { gap: 8 },
  sportChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  chipNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipName:      { fontSize: 13, fontWeight: '700' },
  chipLevel:     { fontSize: 11, fontWeight: '600', marginTop: 1 },

  // Action row (friend + message buttons)
  actionRow:     { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, gap: 10 },
  friendBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  friendBtnText: { fontSize: 15, fontWeight: '700' },
  msgBtn:        { width: 52, height: 52, borderRadius: 16, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' },

  errorText:        { color: '#636366', fontSize: 16, marginTop: 14 },
  backBtnCenter:    { marginTop: 20, backgroundColor: '#2C2C2E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnCenterText: { color: '#FFFFFF', fontWeight: '700' },
});
