import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import AvatarCircle from '../components/AvatarCircle';
import { BackButton } from '../components/BackButton';

type Participant = {
  id: number;
  username: string;
  avatar: string | null;
  role: 'host' | 'player';
};

export default function GameParticipantsScreen() {
  const router = useRouter();
  const { gameId, title } = useLocalSearchParams<{ gameId: string; title?: string }>();
  const { token } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const res = await apiFetch(`/api/games/${gameId}/participants`, { token });
        const data = await res.json();
        if (data.success) setParticipants(data.participants);
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
        console.error('Participants fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (gameId) fetchParticipants();
  }, [gameId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title} numberOfLines={1}>{title ?? 'Players'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push({ pathname: '/player-profile', params: { userId: item.id } } as any)}
              activeOpacity={0.75}
            >
              <AvatarCircle username={item.username} avatar={item.avatar} size={46} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.username}</Text>
                {item.role === 'host' && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#48484A" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={60} color="#3A3A3C" />
              <Text style={styles.emptyText}>No players yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#2C2C2E',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },

  list: { paddingTop: 10, paddingBottom: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginVertical: 4,
    backgroundColor: '#2C2C2E', borderRadius: 16, padding: 14,
  },
  rowInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  hostBadge: {
    backgroundColor: '#0FEA9518', borderRadius: 8, borderWidth: 1,
    borderColor: '#0FEA9555', paddingHorizontal: 8, paddingVertical: 2,
  },
  hostBadgeText: { color: '#0FEA95', fontSize: 11, fontWeight: '800' },
  emptyText: { color: '#636366', fontSize: 15, marginTop: 12 },
});
