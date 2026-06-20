import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { SPORT_COLORS, SPORT_ICONS } from '../constants/sports';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';
import { BackButton } from '../components/BackButton';
import { API } from '../constants/endpoints';
import { ROUTES } from '../constants/routes';

type ResultEntry = {
  id: number;
  username: string;
  avatar: string | null;
  attended: boolean | null;
  peer_count: number;
  sportsmanship_pct: number | null;
  punctuality_pct: number | null;
  communication_pct: number | null;
  skill_avg: number | null;
};

const CATEGORIES = [
  { key: 'sportsmanship_pct', label: 'Sportsmanship', icon: 'ribbon-outline' },
  { key: 'punctuality_pct',   label: 'Punctuality',   icon: 'time-outline' },
  { key: 'communication_pct', label: 'Communication', icon: 'chatbubble-ellipses-outline' },
] as const;

function ScoreBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export default function GameResultsScreen() {
  const router = useRouter();
  const { gameId, title, sport, scheduledTime } = useLocalSearchParams<{
    gameId: string; title?: string; sport?: string; scheduledTime?: string;
  }>();
  const { token } = useAuth();
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(API.gameRatingResults(gameId), { token });
        const data = await res.json();
        if (data.success) {
          setCanView(data.can_view);
          setResults(data.results);
        }
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
        console.error('Results fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (gameId) load();
  }, [gameId]);

  const sportColor = (sport && SPORT_COLORS[sport]) ? SPORT_COLORS[sport] : Colors.accent;
  const sportIcon  = (sport && SPORT_ICONS[sport])  ? SPORT_ICONS[sport]  : 'trophy';

  const header = (
    <View style={styles.header}>
      <View style={[styles.resultOrb1, { backgroundColor: sportColor + '12' }]} />
      <View style={[styles.resultOrb2, { backgroundColor: sportColor + '08' }]} />
      <BackButton bgColor="rgba(0,0,0,0.35)" style={styles.backBtn} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Game Results</Text>
        <Text style={styles.subtitle}>
          {sport ? sport.toUpperCase() : ''}
          {scheduledTime ? `  ·  ${scheduledTime}` : ''}
        </Text>
      </View>
      <View style={[styles.sportIcon, { backgroundColor: sportColor + '22' }]}>
        <MaterialCommunityIcons name={sportIcon as any} size={22} color={sportColor} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      </View>
    );
  }

  if (canView === false) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <View style={styles.lockCircle}>
            <Ionicons name="lock-closed-outline" size={64} color={Colors.border} />
          </View>
          <Text style={styles.lockedTitle}>Results Locked</Text>
          <Text style={styles.lockedSub}>Rate all players in this game to unlock the results.</Text>
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => router.replace({
              pathname: ROUTES.RATE_PLAYERS as any,
              params: { gameId, sport: sport ?? '', scheduledTime: scheduledTime ?? '' },
            })}
          >
            <Ionicons name="star-outline" size={16} color={Colors.bg} />
            <Text style={styles.rateBtnText}>Rate Players</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={results}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.anonymousNote}>
            Scores are aggregated — individual votes are anonymous.
          </Text>
        }
        renderItem={({ item }) => {
          const color = getAvatarColor(item.username);
          const hasPeer = item.peer_count > 0;

          return (
            <View style={styles.card}>
              {/* Player row */}
              <View style={styles.playerRow}>
                <View style={[styles.avatar, { backgroundColor: color + '22', borderColor: color }]}>
                  {item.avatar ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${item.avatar}` }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarLetter, { color }]}>
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.playerName}>{item.username}</Text>
                {item.attended !== null && item.attended !== undefined && (
                  <View style={[styles.attendBadge, item.attended ? styles.attendBadgeYes : styles.attendBadgeNo]}>
                    <Ionicons
                      name={item.attended ? 'checkmark-circle' : 'close-circle'}
                      size={13}
                      color={Colors.bg}
                    />
                    <Text style={styles.attendBadgeText}>
                      {item.attended ? 'Showed Up' : 'No-Show'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Peer category scores */}
              {hasPeer ? (
                <View style={styles.scoresBlock}>
                  {CATEGORIES.map(cat => {
                    const pct = item[cat.key] as number | null;
                    if (pct === null || pct === undefined) return null;
                    const barColor = pct >= 70 ? Colors.accent : pct >= 40 ? Colors.orange : Colors.error;
                    return (
                      <View key={cat.key} style={styles.scoreRow}>
                        <View style={styles.scoreLabelRow}>
                          <Ionicons name={cat.icon as any} size={13} color={Colors.textMuted} />
                          <Text style={styles.scoreLabel}>{cat.label}</Text>
                        </View>
                        <View style={styles.scoreRight}>
                          <ScoreBar pct={pct} color={barColor} />
                          <Text style={[styles.scorePct, { color: barColor }]}>{pct}%</Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Skill stars */}
                  {item.skill_avg !== null && item.skill_avg !== undefined && (
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreLabelRow}>
                        <Ionicons name="flash-outline" size={13} color={Colors.textMuted} />
                        <Text style={styles.scoreLabel}>Skill</Text>
                      </View>
                      <View style={styles.skillRight}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <Ionicons
                            key={n}
                            name={n <= Math.round(item.skill_avg!) ? 'star' : 'star-outline'}
                            size={16}
                            color={n <= Math.round(item.skill_avg!) ? Colors.yellow : Colors.border}
                          />
                        ))}
                        <Text style={styles.skillNum}>{Number(item.skill_avg).toFixed(1)}</Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.raterCount}>
                    Based on {item.peer_count} rating{item.peer_count !== 1 ? 's' : ''}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noRatings}>No peer ratings yet</Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl, backgroundColor: Colors.bg, overflow: 'hidden' },
  resultOrb1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, right: -60 },
  resultOrb2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, top: 20, left: -40 },
  backBtn: { marginRight: Spacing.md },
  title:   { fontSize: 20, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSub, marginTop: 2 },
  sportIcon: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 50 },
  anonymousNote: { fontSize: 12, color: Colors.textHint, textAlign: 'center', marginVertical: 14, marginHorizontal: Spacing.xl, fontStyle: 'italic' },

  // Player card
  card:       { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, marginBottom: 12, ...Shadow.card },
  playerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarImg:  { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 17, fontWeight: '900' },
  playerName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },

  attendBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  attendBadgeYes: { backgroundColor: Colors.accent },
  attendBadgeNo:  { backgroundColor: Colors.error },
  attendBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.bg },

  // Scores
  scoresBlock: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  scoreRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 120 },
  scoreLabel:  { fontSize: 12, color: Colors.textSub, fontWeight: '600' },
  scoreRight:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar:         { flex: 1, height: 6, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 4 },
  scorePct:    { width: 36, fontSize: 12, fontWeight: '800', textAlign: 'right' },

  skillRight:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  skillNum:    { fontSize: 12, color: Colors.yellow, fontWeight: '800', marginLeft: 4 },

  raterCount:  { fontSize: 11, color: Colors.textHint, marginTop: 6, textAlign: 'right', fontStyle: 'italic' },
  noRatings:   { fontSize: 13, color: Colors.textHint, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },

  // Locked state
  lockCircle:  { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, ...Shadow.card, justifyContent: 'center', alignItems: 'center' },
  lockedTitle: { fontSize: 22, fontWeight: '900', color: Colors.text, marginTop: 20, marginBottom: 8 },
  lockedSub:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  rateBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radius.pill, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  rateBtnText: { color: Colors.bg, fontWeight: '900', fontSize: 15 },
});
