import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { Colors, Spacing, Radius, Type, Shadow } from '../constants/theme';

type Player = { id: number; username: string; avatar: string | null };

type AttendanceMap = Record<number, boolean | null>; // null = not yet chosen

type CategoryRating = {
  sportsmanship: boolean;
  punctuality: boolean;
  communication: boolean;
  skill: number; // 1–5
};
type PeerMap = Record<number, CategoryRating>;

const THUMB_CATEGORIES: { key: keyof Omit<CategoryRating, 'skill'>; label: string; icon: string }[] = [
  { key: 'sportsmanship', label: 'Sportsmanship', icon: 'ribbon-outline' },
  { key: 'punctuality',   label: 'Punctuality',   icon: 'time-outline' },
  { key: 'communication', label: 'Communication', icon: 'chatbubble-ellipses-outline' },
];

function AvatarCircle({ player, onPress }: { player: Player; onPress?: () => void }) {
  const color = getAvatarColor(player.username);
  const inner = (
    <View style={[styles.avatar, { backgroundColor: color + '22', borderColor: color, borderWidth: 1.5 }]}>
      {player.avatar ? (
        <Image source={{ uri: `data:image/jpeg;base64,${player.avatar}` }} style={styles.avatarImage} />
      ) : (
        <Text style={[styles.avatarLetter, { color }]}>
          {player.username.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{inner}</TouchableOpacity>;
  return inner;
}

export default function RatePlayersScreen() {
  const router = useRouter();
  const { gameId, sport, scheduledTime } = useLocalSearchParams();
  const { token } = useAuth();

  const [players, setPlayers]       = useState<Player[]>([]);
  const [isHost, setIsHost]         = useState(false);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [peerRatings, setPeerRatings] = useState<PeerMap>({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await apiFetch(`/api/ratings/game/${gameId}`, { token });
        const data = await res.json();
        if (!data.success) return Alert.alert('Error', data.message);

        setPlayers(data.players);
        setIsHost(data.is_host);

        if (data.is_host) {
          const defaults: AttendanceMap = {};
          data.players.forEach((p: Player) => { defaults[p.id] = null; }); // null = not chosen yet
          setAttendance(defaults);
        } else {
          const defaults: PeerMap = {};
          data.players.forEach((p: Player) => {
            defaults[p.id] = { sportsmanship: true, punctuality: true, communication: true, skill: 3 };
          });
          setPeerRatings(defaults);
        }
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
        Alert.alert('Error', 'Could not connect to server');
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [gameId]);

  const setAttended = (playerId: number, value: boolean) =>
    setAttendance(prev => ({ ...prev, [playerId]: value }));

  const setPeer = (playerId: number, patch: Partial<CategoryRating>) =>
    setPeerRatings(prev => ({ ...prev, [playerId]: { ...prev[playerId], ...patch } }));

  const handleSubmit = async () => {
    if (players.length === 0) return router.back();

    if (isHost) {
      const unchosen = players.filter(p => attendance[p.id] === null);
      if (unchosen.length > 0)
        return Alert.alert('Mark all players', `Please choose Arrived or No-Show for: ${unchosen.map(p => p.username).join(', ')}`);
    }

    setSubmitting(true);
    try {
      if (isHost) {
        const res = await apiFetch('/api/ratings/batch', {
          method: 'POST',
          token,
          body: JSON.stringify({
            game_id: parseInt(gameId as string),
            ratings: players.map(p => ({ ratee_id: p.id, attended: attendance[p.id] })),
          }),
        });
        const data = await res.json();
        if (!data.success) return Alert.alert('Error', data.message);
      } else {
        const res = await apiFetch('/api/ratings/peer', {
          method: 'POST',
          token,
          body: JSON.stringify({
            game_id: parseInt(gameId as string),
            ratings: players.map(p => ({
              ratee_id:      p.id,
              sportsmanship: peerRatings[p.id]?.sportsmanship ?? true,
              punctuality:   peerRatings[p.id]?.punctuality   ?? true,
              communication: peerRatings[p.id]?.communication ?? true,
              skill:         peerRatings[p.id]?.skill         ?? 3,
            })),
          }),
        });
        const data = await res.json();
        if (!data.success) return Alert.alert('Error', data.message);
      }
      setDone(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  if (done) {
    return (
      <View style={styles.center}>
        <View style={styles.doneIconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.accent} />
        </View>
        <Text style={styles.doneTitle}>{isHost ? 'Attendance Saved!' : 'Ratings Submitted!'}</Text>
        <Text style={styles.doneSubtitle}>
          {isHost ? 'Player karma has been updated.' : 'Your feedback helps build a trustworthy community.'}
        </Text>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace({
            pathname: '/game-results' as any,
            params: { gameId, sport: sport ?? '', scheduledTime: scheduledTime ?? '' },
          })}
        >
          <Text style={styles.doneBtnText}>View Results</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneSecondaryBtn} onPress={() => router.back()}>
          <Text style={styles.doneSecondaryBtnText}>Back to My Games</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{isHost ? 'Mark Attendance' : 'Rate Players'}</Text>
          <Text style={styles.subtitle}>
            {(sport as string)?.toUpperCase() ?? 'Game'}
            {scheduledTime ? `  ·  ${scheduledTime}` : ''}
          </Text>
        </View>
      </View>

      {players.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.doneIconWrap}>
            <Ionicons name="checkmark-done-circle" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>All done!</Text>
          <Text style={styles.emptySubtitle}>
            {isHost ? "You've already marked attendance for everyone." : "You've already rated everyone."}
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.replace({
              pathname: '/game-results' as any,
              params: { gameId, sport: sport ?? '', scheduledTime: scheduledTime ?? '' },
            })}
          >
            <Text style={styles.doneBtnText}>View Results</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneSecondaryBtn} onPress={() => router.back()}>
            <Text style={styles.doneSecondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.instructions}>
            {isHost ? 'Did each player show up to the game?' : 'Rate your teammates across three areas and their skill level:'}
          </Text>

          <FlatList
            data={players}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (isHost) {
                const status = attendance[item.id]; // null | true | false
                return (
                  <View style={[styles.playerCard, Shadow.card]}>
                    <View style={styles.playerLeft}>
                      <AvatarCircle player={item} onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(item.id) } })} />
                      <Text style={styles.username}>{item.username}</Text>
                      {status === null && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.attendanceRow}>
                      <TouchableOpacity
                        style={[styles.attendBtn, status === true && styles.attendBtnArrived]}
                        onPress={() => setAttended(item.id, true)}
                      >
                        <Ionicons name="checkmark-circle" size={20} color={status === true ? Colors.bg : Colors.textSub} />
                        <Text style={[styles.attendText, status === true && styles.attendTextArrived]}>Arrived</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.attendBtn, status === false && styles.attendBtnNoShow]}
                        onPress={() => setAttended(item.id, false)}
                      >
                        <Ionicons name="close-circle" size={20} color={status === false ? Colors.bg : Colors.textSub} />
                        <Text style={[styles.attendText, status === false && styles.attendTextNoShow]}>No-Show</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              // Non-host: thumbs + skill stars
              const ratings = peerRatings[item.id] ?? { sportsmanship: true, punctuality: true, communication: true, skill: 3 };
              return (
                <View style={[styles.playerCard, Shadow.card]}>
                  <View style={styles.playerLeft}>
                    <AvatarCircle player={item} onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(item.id) } })} />
                    <Text style={styles.username}>{item.username}</Text>
                  </View>

                  {THUMB_CATEGORIES.map(cat => {
                    const positive = ratings[cat.key];
                    return (
                      <View key={cat.key} style={styles.categoryRow}>
                        <View style={styles.categoryLabelRow}>
                          <Ionicons name={cat.icon as any} size={14} color={Colors.textSub} />
                          <Text style={styles.categoryLabel}>{cat.label}</Text>
                        </View>
                        <View style={styles.thumbRow}>
                          <TouchableOpacity
                            style={[styles.thumbBtn, positive && styles.thumbBtnUp]}
                            onPress={() => setPeer(item.id, { [cat.key]: true })}
                          >
                            <Ionicons name={positive ? 'thumbs-up' : 'thumbs-up-outline'} size={17} color={positive ? Colors.bg : Colors.textSub} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.thumbBtn, !positive && styles.thumbBtnDown]}
                            onPress={() => setPeer(item.id, { [cat.key]: false })}
                          >
                            <Ionicons name={!positive ? 'thumbs-down' : 'thumbs-down-outline'} size={17} color={!positive ? Colors.bg : Colors.textSub} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {/* Skill 1–5 stars */}
                  <View style={styles.categoryRow}>
                    <View style={styles.categoryLabelRow}>
                      <Ionicons name="flash-outline" size={14} color={Colors.textSub} />
                      <Text style={styles.categoryLabel}>Skill Level</Text>
                    </View>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity key={star} onPress={() => setPeer(item.id, { skill: star })} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                          <Ionicons
                            name={star <= ratings.skill ? 'star' : 'star-outline'}
                            size={26}
                            color={star <= ratings.skill ? Colors.yellow : Colors.surface2}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={styles.submitBtnText}>{isHost ? 'Save Attendance' : 'Submit Ratings'}</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: Spacing.md },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSub, marginTop: 2 },

  instructions: { color: Colors.textSub, fontSize: 14, fontWeight: '600', paddingHorizontal: Spacing.xl, paddingTop: 18, paddingBottom: 10 },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 130 },

  playerCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 12 },
  playerLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 16, fontWeight: '900' },
  username: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },

  pendingBadge:     { backgroundColor: Colors.warningFaint, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.warningBorder },
  pendingBadgeText: { color: Colors.warning, fontSize: 11, fontWeight: '700' },

  // Host attendance
  attendanceRow: { flexDirection: 'row', gap: 10 },
  attendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: Radius.md, backgroundColor: Colors.surface2 },
  attendBtnArrived: { backgroundColor: Colors.accent },
  attendBtnNoShow:  { backgroundColor: Colors.error },
  attendText: { fontSize: 14, fontWeight: '700', color: Colors.textSub },
  attendTextArrived: { color: Colors.bg },
  attendTextNoShow:  { color: Colors.bg },

  // Peer thumb categories
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryLabel: { fontSize: 13, color: Colors.textSub, fontWeight: '600' },
  thumbRow: { flexDirection: 'row', gap: 8 },
  thumbBtn: { width: 44, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center' },
  thumbBtnUp:   { backgroundColor: Colors.accent },
  thumbBtnDown: { backgroundColor: Colors.error },

  // Skill stars
  starsRow: { flexDirection: 'row', gap: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.xl, paddingBottom: 40, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  submitBtn: {
    backgroundColor: Colors.accent,
    height: 56,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: { color: Colors.bg, fontSize: 17, fontWeight: '900' },

  // Done / celebration screen
  doneIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.successFaint,
    borderWidth: 2,
    borderColor: Colors.accentBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  doneTitle:    { fontSize: 24, fontWeight: '900', color: Colors.text, marginTop: 20 },
  doneSubtitle: { fontSize: 14, color: Colors.textSub, marginTop: 8, textAlign: 'center' },
  doneBtn: {
    marginTop: 30,
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  doneBtnText: { color: Colors.bg, fontWeight: '900', fontSize: 16 },
  doneSecondaryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneSecondaryBtnText: { color: Colors.textSub, fontWeight: '700', fontSize: 14 },

  emptyTitle:    { fontSize: 20, fontWeight: '900', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSub, marginTop: 8, textAlign: 'center' },
});
