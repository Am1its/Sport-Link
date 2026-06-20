import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { getAvatarColor } from '../../utils/avatar';
import { SPORT_LABELS } from '../../constants/sports';
import { Colors, Spacing, Radius, Shadow, Type } from '../../constants/theme';
import { API } from '../../constants/endpoints';
import { ROUTES } from '../../constants/routes';

type InviterProfile = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  top_sport: string | null;
  karma: number;
  friendship_status: string | null;
};

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { token, user } = useAuth();

  const [profile, setProfile] = useState<InviterProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res  = await apiFetch(API.user(id), { token });
        const data = await res.json();
        if (data.success) {
          setProfile(data.user);
          setSent(data.user.friendship_status === 'pending' || data.user.friendship_status === 'accepted');
        }
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const handleAddFriend = async () => {
    if (!token) {
      return router.push({ pathname: ROUTES.LOGIN, params: { redirect: `/invite/${id}` } } as any);
    }
    setSending(true);
    try {
      const res  = await apiFetch(API.FRIENDS, {
        method: 'POST', token,
        body: JSON.stringify({ addressee_id: parseInt(id) }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        Alert.alert('Request sent!', `Friend request sent to ${profile?.username}.`);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setSending(false);
    }
  };

  const isSelf = user?.id === parseInt(id ?? '0');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.notFound}>User not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push(ROUTES.TABS as any)}>
          <Text style={styles.backBtnText}>Go to SportLink</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarColor  = getAvatarColor(profile.username);
  const sportDisplay = profile.top_sport ? (SPORT_LABELS[profile.top_sport] ?? profile.top_sport) : null;
  const karmaColor   = profile.karma > 0 ? Colors.accent : profile.karma < 0 ? Colors.error : Colors.textMuted;
  const karmaStr     = profile.karma > 0 ? `+${profile.karma}` : `${profile.karma}`;

  return (
    <View style={styles.container}>
      {/* Hero orb background */}
      <View style={styles.hero}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <TouchableOpacity style={styles.backCircle} onPress={() => router.push(ROUTES.TABS as any)}>
          <Ionicons name="home-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: avatarColor + '22', borderColor: avatarColor }]}>
          {profile.avatar ? (
            <Image source={{ uri: `data:image/jpeg;base64,${profile.avatar}` }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarLetter, { color: avatarColor }]}>
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.inviteLabel}>You've been invited by</Text>
        <Text style={styles.username}>{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {/* Stats row */}
        <View style={[styles.statsCard, Shadow.card]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: karmaColor }]}>{karmaStr}</Text>
            <Text style={styles.statLabel}>Karma</Text>
          </View>
          {sportDisplay ? (
            <View style={[styles.stat, styles.statBorder]}>
              <Text style={styles.statValue}>{sportDisplay}</Text>
              <Text style={styles.statLabel}>Top Sport</Text>
            </View>
          ) : null}
        </View>

        {/* CTA */}
        {!isSelf && (
          sent || profile.friendship_status === 'accepted' ? (
            <View style={[styles.ctaBtn, styles.ctaBtnMuted]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.accent} />
              <Text style={[styles.ctaBtnText, { color: Colors.accent }]}>
                {profile.friendship_status === 'accepted' ? 'Already Friends' : 'Request Sent'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleAddFriend} disabled={sending} activeOpacity={0.85}>
              {sending
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <>
                    <Ionicons name="person-add-outline" size={20} color={Colors.bg} />
                    <Text style={styles.ctaBtnText}>
                      {token ? `Add ${profile.username}` : 'Sign in to Add Friend'}
                    </Text>
                  </>}
            </TouchableOpacity>
          )
        )}

        {!token && (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaBtnOutline, { marginTop: Spacing.sm }]}
            onPress={() => router.push(ROUTES.REGISTER as any)}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaBtnText, { color: Colors.accent }]}>Create Account</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.push(ROUTES.TABS as any)} style={styles.skipLink}>
          <Text style={styles.skipText}>Open SportLink →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  notFound:  { ...Type.body, color: Colors.textMuted },

  hero: { height: 140, overflow: 'hidden', backgroundColor: Colors.accent + '18' },
  orb1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, left: -40, backgroundColor: Colors.accent + '25' },
  orb2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, bottom: -60, right: -20, backgroundColor: Colors.blue + '18' },
  backCircle: { position: 'absolute', top: 52, left: Spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },

  avatarWrap: { alignItems: 'center', marginTop: -44 },
  avatar:    { width: 88, height: 88, borderRadius: 44, borderWidth: 3.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 34, fontWeight: '900' },

  body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, alignItems: 'center' },
  inviteLabel: { ...Type.label, color: Colors.textMuted, marginBottom: 4 },
  username:    { ...Type.screenTitle, color: Colors.text, marginBottom: Spacing.xs },
  bio:         { ...Type.body, color: Colors.textSub, textAlign: 'center', marginBottom: Spacing.lg },

  statsCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, width: '100%', marginBottom: Spacing.xl },
  stat:       { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderLeftColor: Colors.border },
  statValue:  { fontSize: 22, fontWeight: '900', color: Colors.text },
  statLabel:  { ...Type.statLabel, color: Colors.textMuted, marginTop: 2 },

  ctaBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accent, borderRadius: Radius.pill, height: 52, width: '100%', paddingHorizontal: Spacing.xxl },
  ctaBtnMuted:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.accentBorder },
  ctaBtnOutline:{ backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.accentBorder },
  ctaBtnText:   { ...Type.btnPrimary, color: Colors.bg },

  backBtn:     { backgroundColor: Colors.accent, borderRadius: Radius.pill, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  backBtnText: { ...Type.btnSmall, color: Colors.bg },

  skipLink: { marginTop: Spacing.lg },
  skipText: { ...Type.label, color: Colors.accent },
});
