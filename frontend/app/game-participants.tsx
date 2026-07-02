import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import AvatarCircle from '../components/AvatarCircle';
import { BackButton } from '../components/BackButton';
import { Colors } from '../constants/theme';
import { API } from '../constants/endpoints';
import { ROUTES } from '../constants/routes';
import type { Participant } from '../types';

const attendanceColor = (rate: number): string =>
  rate >= 70 ? Colors.accent : rate >= 40 ? Colors.warning : Colors.error;

export default function GameParticipantsScreen() {
  const router = useRouter();
  const { gameId, title } = useLocalSearchParams<{ gameId: string; title?: string }>();
  const { token, user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const res = await apiFetch(API.gameParticipants(gameId), { token });
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

  const isHost = participants.some(p => p.role === 'host' && p.id === user?.id);

  const handleRemove = (participant: Participant) => {
    Alert.alert(
      'Remove Player',
      `Remove ${participant.username} from this game?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(participant.id);
            try {
              const res  = await apiFetch(API.gameRemoveParticipant(gameId, participant.id), { method: 'DELETE', token });
              const data = await res.json();
              if (!data.success) {
                Alert.alert('Error', data.message || 'Could not remove player');
                return;
              }
              setParticipants(prev => prev.filter(p => p.id !== participant.id));
            } catch (err) {
              if (err instanceof UnauthorizedError) return;
              Alert.alert('Error', 'Could not connect to server');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title} numberOfLines={1}>{title ?? 'Players'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
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
              onPress={() => router.push({ pathname: ROUTES.PLAYER_PROFILE, params: { userId: item.id } } as any)}
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
                {item.attendance_rate != null && (
                  <View style={[styles.attendanceBadge, { backgroundColor: attendanceColor(item.attendance_rate) + '22', borderColor: attendanceColor(item.attendance_rate) + '55' }]}>
                    <Ionicons name="checkmark-done" size={11} color={attendanceColor(item.attendance_rate)} />
                    <Text style={[styles.attendanceBadgeText, { color: attendanceColor(item.attendance_rate) }]}>{item.attendance_rate}%</Text>
                  </View>
                )}
              </View>
              {isHost && item.role !== 'host' && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item)}
                  disabled={removingId === item.id}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {removingId === item.id
                    ? <ActivityIndicator size="small" color={Colors.error} />
                    : <Ionicons name="close-circle-outline" size={22} color={Colors.error} />}
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-forward" size={18} color={Colors.textHint} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={60} color={Colors.surface2} />
              <Text style={styles.emptyText}>No players yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.surface,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },

  list: { paddingTop: 10, paddingBottom: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginVertical: 4,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
  },
  rowInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  hostBadge: {
    backgroundColor: Colors.accentFaint, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.accentBorder, paddingHorizontal: 8, paddingVertical: 2,
  },
  hostBadgeText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  attendanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  attendanceBadgeText: { fontSize: 11, fontWeight: '800' },
  removeBtn: { marginRight: 4 },
  emptyText: { color: Colors.textMuted, fontSize: 15, marginTop: 12 },
});
