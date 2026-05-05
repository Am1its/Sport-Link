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
    const centerIdx = top3.length > 1 ? 1 : 0;

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
              <Text style={[styles.podiumKarma, { color: entry.karma >= 0 ? '#0FEA95' : '#FF453A' }]}>
                {karmaStr}
              </Text>
              {/* Platform block */}
              <View style={[
                styles.podiumBlock,
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
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : board.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={70} color="#2C2C2E" />
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
            const color = getAvatarColor(item.username);
            const karmaStr = item.karma > 0 ? `+${item.karma}` : `${item.karma}`;
            const totalGames = item.games_hosted + item.games_joined;
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <Text style={styles.rankNum}>#{rank}</Text>
                <View style={[styles.rowAvatar, { backgroundColor: color + '22', borderColor: color }]}>
                  {item.avatar ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${item.avatar}` }} style={styles.rowAvatarImg} />
                  ) : (
                    <Text style={[styles.rowAvatarLetter, { color }]}>
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <View style={styles.rowNameRow}>
                    <Text style={styles.rowName}>{item.username}</Text>
                    {isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                  </View>
                  <Text style={styles.rowGames}>{totalGames} game{totalGames !== 1 ? 's' : ''}</Text>
                </View>
                <Text style={[styles.rowKarma, { color: item.karma >= 0 ? '#0FEA95' : '#FF453A' }]}>
                  {karmaStr}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { width: 40 },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '900', color: '#FFFFFF' },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyText: { color: '#636366', fontSize: 15, marginTop: 14, textAlign: 'center' },

  // Podium
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 28, paddingHorizontal: 10, gap: 10 },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  podiumAvatarLarge: { width: 72, height: 72, borderRadius: 36 },
  podiumAvatarImg: { width: '100%', height: '100%' },
  podiumAvatarLetter: { fontWeight: '900' },
  podiumMedal: { fontSize: 20, marginBottom: 2 },
  podiumName: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginBottom: 2, textAlign: 'center' },
  podiumKarma: { fontSize: 13, fontWeight: '900', marginBottom: 6 },
  podiumBlock: { width: '100%', borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  podiumRankNum: { fontSize: 20, fontWeight: '900', paddingVertical: 10 },

  // List rows (rank 4+)
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 14, padding: 12, marginBottom: 10 },
  rowMe: { borderWidth: 1.5, borderColor: '#0FEA9555', backgroundColor: '#0FEA9508' },
  rankNum: { width: 32, fontSize: 14, fontWeight: '800', color: '#636366', textAlign: 'center' },
  rowAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowAvatarImg: { width: '100%', height: '100%' },
  rowAvatarLetter: { fontSize: 17, fontWeight: '900' },
  rowInfo: { flex: 1 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  youBadge: { backgroundColor: '#0FEA9533', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { color: '#0FEA95', fontSize: 10, fontWeight: '800' },
  rowGames: { fontSize: 12, color: '#636366', marginTop: 2 },
  rowKarma: { fontSize: 18, fontWeight: '900', minWidth: 44, textAlign: 'right' },
});
