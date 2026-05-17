import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import AvatarCircle from '../components/AvatarCircle';
import { Colors, Spacing, Radius, Type, Shadow } from '../constants/theme';

type Entry = {
  id: number;
  username: string;
  avatar: string | null;
  karma: number;
  games_hosted: number;
  games_joined: number;
};

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [board, setBoard] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoard = async () => {
      try {
        const res = await apiFetch('/api/users/leaderboard', { token });
        const data = await res.json();
        if (data.success) setBoard(data.leaderboard);
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
        console.error('Leaderboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBoard();
  }, []);

  const renderPodium = () => {
    const top3 = board.slice(0, 3);
    if (top3.length < 1) return null;
    // Podium order: 2nd (left), 1st (center), 3rd (right)
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = [100, 130, 80];

    return (
      <View style={styles.podiumContainer}>
        {order.map((entry, i) => {
          const realRank = board.indexOf(entry);
          const isTall = realRank === 0;
          const color = getAvatarColor(entry.username);
          const karmaStr = entry.karma > 0 ? `+${entry.karma}` : `${entry.karma}`;
          return (
            <View key={entry.id} style={styles.podiumCol}>
              {/* Avatar */}
              <View style={[
                styles.podiumAvatar,
                { borderColor: MEDAL_COLORS[realRank], backgroundColor: color + '22' },
                isTall && styles.podiumAvatarLarge,
              ]}>
                {entry.avatar ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${entry.avatar}` }} style={styles.podiumAvatarImg} />
                ) : (
                  <Text style={[styles.podiumAvatarLetter, { color, fontSize: isTall ? 24 : 18 }]}>
                    {entry.username.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.podiumMedal}>{MEDALS[realRank]}</Text>
              <Text style={styles.podiumName} numberOfLines={1}>{entry.username}</Text>
              <Text style={[styles.podiumKarma, { color: entry.karma >= 0 ? Colors.accent : Colors.error }]}>
                {karmaStr}
              </Text>
              {/* Platform block */}
              <View style={[
                styles.podiumBlock,
                Shadow.card,
                { height: heights[i], backgroundColor: MEDAL_COLORS[realRank] + '33', borderColor: MEDAL_COLORS[realRank] + '66' },
              ]}>
                <Text style={[styles.podiumRankNum, { color: MEDAL_COLORS[realRank] }]}>#{realRank + 1}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const rest = board.slice(3);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : board.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="trophy-outline" size={40} color={Colors.surface2} />
          </View>
          <Text style={styles.emptyText}>No ratings yet — play some games!</Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => String(item.id)}
          ListHeaderComponent={renderPodium}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const rank = index + 4;
            const isMe = item.id === user?.id;
            const karmaStr = item.karma > 0 ? `+${item.karma}` : `${item.karma}`;
            const totalGames = item.games_hosted + item.games_joined;
            return (
              <TouchableOpacity
                style={[styles.row, Shadow.card, isMe && styles.rowMe]}
                onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(item.id) } })}
                activeOpacity={0.75}
              >
                <Text style={styles.rankNum}>#{rank}</Text>
                <AvatarCircle username={item.username} avatar={item.avatar} size={42} />
                <View style={styles.rowInfo}>
                  <View style={styles.rowNameRow}>
                    <Text style={styles.rowName}>{item.username}</Text>
                    {isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                  </View>
                  <Text style={styles.rowGames}>{totalGames} game{totalGames !== 1 ? 's' : ''}</Text>
                </View>
                <Text style={[styles.rowKarma, { color: item.karma >= 0 ? Colors.accent : Colors.error }]}>
                  {karmaStr}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900', color: Colors.text },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },

  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center' },

  // Podium
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 28, paddingHorizontal: 10, gap: 10 },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  podiumAvatarLarge: { width: 72, height: 72, borderRadius: 36 },
  podiumAvatarImg: { width: '100%', height: '100%' },
  podiumAvatarLetter: { fontWeight: '900' },
  podiumMedal: { fontSize: 20, marginBottom: 2 },
  podiumName: { fontSize: 12, fontWeight: '800', color: Colors.text, marginBottom: 2, textAlign: 'center' },
  podiumKarma: { fontSize: 13, fontWeight: '900', marginBottom: 6 },
  podiumBlock: { width: '100%', borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  podiumRankNum: { fontSize: 20, fontWeight: '900', paddingVertical: 10 },

  // List rows (rank 4+)
  row:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: 10 },
  rowMe: { backgroundColor: Colors.accentFaint, borderWidth: 1.5, borderColor: Colors.accentBorder },
  rankNum: { width: 32, fontSize: 14, fontWeight: '800', color: Colors.textMuted, textAlign: 'center' },
  rowInfo: { flex: 1, marginLeft: Spacing.md },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  youBadge: { backgroundColor: Colors.accentFaint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { color: Colors.accent, fontSize: 10, fontWeight: '800' },
  rowGames: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rowKarma: { fontSize: 18, fontWeight: '900', minWidth: 44, textAlign: 'right' },
});
