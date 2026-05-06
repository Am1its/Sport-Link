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
        const res = await apiFetch(`/api/ratings/game/${gameId}/results`, { token });
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

  const sportColor = (sport && SPORT_COLORS[sport]) ? SPORT_COLORS[sport] : '#0FEA95';
  const sportIcon  = (sport && SPORT_ICONS[sport])  ? SPORT_ICONS[sport]  : 'trophy';

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>
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
        <View style={styles.center}><ActivityIndicator size="large" color="#0FEA95" /></View>
      </View>
    );
  }

  if (canView === false) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={64} color="#3A3A3C" />
          <Text style={styles.lockedTitle}>Results Locked</Text>
          <Text style={styles.lockedSub}>Rate all players in this game to unlock the results.</Text>
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => router.replace({
              pathname: '/rate-players' as any,
              params: { gameId, sport: sport ?? '', scheduledTime: scheduledTime ?? '' },
            })}
          >
            <Ionicons name="star-outline" size={16} color="#1C1C1E" />
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
                      color={item.attended ? '#1C1C1E' : '#1C1C1E'}
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
                    const barColor = pct >= 70 ? '#0FEA95' : pct >= 40 ? '#FF8C00' : '#FF453A';
                    return (
                      <View key={cat.key} style={styles.scoreRow}>
                        <View style={styles.scoreLabelRow}>
                          <Ionicons name={cat.icon as any} size={13} color="#636366" />
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
                        <Ionicons name="flash-outline" size={13} color="#636366" />
                        <Text style={styles.scoreLabel}>Skill</Text>
                      </View>
                      <View style={styles.skillRight}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <Ionicons
                            key={n}
                            name={n <= Math.round(item.skill_avg!) ? 'star' : 'star-outline'}
                            size={16}
                            color={n <= Math.round(item.skill_avg!) ? '#FFD700' : '#3A3A3C'}
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
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  backBtn: { marginRight: 12 },
  title:   { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  sportIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  list: { paddingHorizontal: 20, paddingBottom: 50 },
  anonymousNote: { fontSize: 12, color: '#48484A', textAlign: 'center', marginVertical: 14, fontStyle: 'italic' },

  // Player card
  card:       { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 14, marginBottom: 12 },
  playerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarImg:  { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 17, fontWeight: '900' },
  playerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  attendBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  attendBadgeYes: { backgroundColor: '#0FEA95' },
  attendBadgeNo:  { backgroundColor: '#FF453A' },
  attendBadgeText: { fontSize: 11, fontWeight: '800', color: '#1C1C1E' },

  // Scores
  scoresBlock: { borderTopWidth: 1, borderTopColor: '#3A3A3C', paddingTop: 10 },
  scoreRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 120 },
  scoreLabel:  { fontSize: 12, color: '#AEAEB2', fontWeight: '600' },
  scoreRight:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar:         { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#3A3A3C', overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 4 },
  scorePct:    { width: 36, fontSize: 12, fontWeight: '800', textAlign: 'right' },

  skillRight:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  skillNum:    { fontSize: 12, color: '#FFD700', fontWeight: '800', marginLeft: 4 },

  raterCount:  { fontSize: 11, color: '#48484A', marginTop: 6, textAlign: 'right', fontStyle: 'italic' },
  noRatings:   { fontSize: 13, color: '#48484A', fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#3A3A3C', paddingTop: 10 },

  // Locked state
  lockedTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 20, marginBottom: 8 },
  lockedSub:   { fontSize: 14, color: '#636366', textAlign: 'center', lineHeight: 20 },
  rateBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, backgroundColor: '#0FEA95', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  rateBtnText: { color: '#1C1C1E', fontWeight: '900', fontSize: 15 },
});
