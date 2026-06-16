import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Image, Pressable,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';
import { usePressAnimation, useEntranceAnimation, useStaggerEntrance } from '../hooks/useAnimations';
import { Springs } from '../constants/motion';
import { useSound } from '../context/SoundContext';

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

function AttendanceButton({
  value, isSelected, onPress, isNoShow,
}: { value: boolean; isSelected: boolean; onPress: () => void; isNoShow?: boolean }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.88, scaleUp: 1.12, stiffness: 500, damping: 18,
  });
  const bgOpacity = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    bgOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 180 });
  }, [isSelected, bgOpacity]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => {
          Haptics.impactAsync(isNoShow ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        style={styles.toggleBtn}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.toggleBtnBg, bgStyle,
          { backgroundColor: isNoShow ? Colors.errorFaint : Colors.accentFaint }]} />
        <Ionicons
          name={value ? 'checkmark-circle' : 'close-circle'}
          size={26}
          color={isSelected ? (isNoShow ? Colors.error : Colors.accent) : Colors.textMuted}
        />
      </Pressable>
    </Animated.View>
  );
}

function ThumbButton({
  isUp, isSelected, onPress,
}: { isUp: boolean; isSelected: boolean; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.88,
    scaleUp: 1.1,
    stiffness: Springs.bouncy.stiffness,
    damping: Springs.bouncy.damping,
  });
  const nudgeY = useSharedValue(0);

  const handlePress = () => {
    Haptics.selectionAsync();
    if (isUp) nudgeY.value = withSequence(withSpring(-4, { stiffness: 600 }), withSpring(0, { stiffness: 300 }));
    onPress();
  };

  const nudgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: nudgeY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, nudgeStyle]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        style={[styles.thumbBtn, isSelected && (isUp ? styles.thumbBtnUp : styles.thumbBtnDown)]}
      >
        <Ionicons
          name={isUp ? 'thumbs-up' : 'thumbs-down'}
          size={20}
          color={isSelected ? (isUp ? Colors.accent : Colors.error) : Colors.textMuted}
        />
      </Pressable>
    </Animated.View>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // 5 explicit shared values — never call useSharedValue inside .map()
  const s0 = useSharedValue(1);
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  const s4 = useSharedValue(1);
  const scales = [s0, s1, s2, s3, s4];

  // 5 explicit animated styles — never call useAnimatedStyle inside .map()
  const a0 = useAnimatedStyle(() => ({ transform: [{ scale: s0.value }] }));
  const a1 = useAnimatedStyle(() => ({ transform: [{ scale: s1.value }] }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ scale: s2.value }] }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ scale: s3.value }] }));
  const a4 = useAnimatedStyle(() => ({ transform: [{ scale: s4.value }] }));
  const styles5 = [a0, a1, a2, a3, a4];

  const handlePress = (rating: number) => {
    scales.forEach((sv, i) => {
      if (i < rating) {
        sv.value = withDelay(i * 40, withSpring(1.25, Springs.bouncy, () => {
          sv.value = withSpring(1, Springs.snappy);
        }));
      } else {
        sv.value = withSpring(1, Springs.snappy);
      }
    });
    Haptics.selectionAsync();
    onChange(rating);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n, i) => (
        <Animated.View key={n} style={styles5[i]}>
          <Pressable onPress={() => handlePress(n)}>
            <Ionicons
              name={value >= n ? 'star' : 'star-outline'}
              size={28}
              color={value >= n ? Colors.yellow : Colors.textMuted}
            />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

export default function RatePlayersScreen() {
  const router = useRouter();
  const { gameId, sport, scheduledTime } = useLocalSearchParams();
  const { token } = useAuth();
  const { play } = useSound();

  const [players, setPlayers]       = useState<Player[]>([]);
  const [isHost, setIsHost]         = useState(false);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [peerRatings, setPeerRatings] = useState<PeerMap>({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  // Done screen entrance animations
  const circleScale    = useSharedValue(0.3);
  const circleEntrance = useEntranceAnimation(0);
  const textEntrance   = useEntranceAnimation(300);
  const btn1Entrance   = useStaggerEntrance(0, 500);
  const btn2Entrance   = useStaggerEntrance(1, 500);

  useEffect(() => {
    if (done) {
      circleScale.value = withSpring(1, { stiffness: 200, damping: 14 });
      play('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [done]);

  const circleScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

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
        <Animated.View style={[styles.doneIconWrap, circleScaleStyle, circleEntrance]}>
          <Ionicons name="checkmark" size={52} color={Colors.success} />
        </Animated.View>
        <Animated.View style={textEntrance}>
          <Text style={styles.doneTitle}>{isHost ? 'Attendance Saved!' : 'Ratings Submitted!'}</Text>
          <Text style={styles.doneSubtitle}>
            {isHost ? 'Player karma has been updated.' : 'Your feedback helps build a trustworthy community.'}
          </Text>
        </Animated.View>
        <Animated.View style={btn1Entrance}>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.replace({
              pathname: '/game-results' as any,
              params: { gameId, sport: sport ?? '', scheduledTime: scheduledTime ?? '' },
            })}
          >
            <Text style={styles.doneBtnText}>View Results</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={btn2Entrance}>
          <TouchableOpacity style={styles.doneSecondaryBtn} onPress={() => router.back()}>
            <Text style={styles.doneSecondaryBtnText}>Back to My Games</Text>
          </TouchableOpacity>
        </Animated.View>
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
                      <AttendanceButton
                        value={true}
                        isSelected={status === true}
                        onPress={() => setAttended(item.id, true)}
                        isNoShow={false}
                      />
                      <AttendanceButton
                        value={false}
                        isSelected={status === false}
                        onPress={() => setAttended(item.id, false)}
                        isNoShow={true}
                      />
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
                          <ThumbButton
                            isUp={true}
                            isSelected={positive}
                            onPress={() => setPeer(item.id, { [cat.key]: true })}
                          />
                          <ThumbButton
                            isUp={false}
                            isSelected={!positive}
                            onPress={() => setPeer(item.id, { [cat.key]: false })}
                          />
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
                    <StarRating
                      value={ratings.skill}
                      onChange={(v) => setPeer(item.id, { skill: v })}
                    />
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

  // Host attendance — new animated toggle buttons
  attendanceRow: { flexDirection: 'row', gap: 10 },
  toggleBtn:   { width: 44, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: Colors.surface2 },
  toggleBtnBg: { borderRadius: 10 },

  // Peer thumb categories
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryLabel: { fontSize: 13, color: Colors.textSub, fontWeight: '600' },
  thumbRow: { flexDirection: 'row', gap: 8 },
  thumbBtn:     { width: 44, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface2 },
  thumbBtnUp:   { backgroundColor: Colors.accentFaint, borderWidth: 1, borderColor: Colors.accentBorder },
  thumbBtnDown: { backgroundColor: Colors.errorFaint,  borderWidth: 1, borderColor: Colors.errorBorder },

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
  doneTitle:    { fontSize: 24, fontWeight: '900', color: Colors.text, marginTop: 20, textAlign: 'center' },
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
