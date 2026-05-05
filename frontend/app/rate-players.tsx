import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../constants/api';

type Player = { id: number; username: string };
type RatingMap = Record<number, boolean>; // ratee_id → attended

export default function RatePlayersScreen() {
  const router = useRouter();
  const { gameId, sport, scheduledTime } = useGlobalSearchParams();
  const { token } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [ratings, setRatings] = useState<RatingMap>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ratings/game/${gameId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) return Alert.alert('Error', data.message);
        setPlayers(data.players);
        // default everyone to "attended"
        const defaults: RatingMap = {};
        data.players.forEach((p: Player) => { defaults[p.id] = true; });
        setRatings(defaults);
      } catch {
        Alert.alert('Error', 'Could not connect to server');
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [gameId]);

  const handleSubmit = async () => {
    if (players.length === 0) return router.back();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/ratings/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          game_id: parseInt(gameId as string),
          ratings: players.map((p) => ({ ratee_id: p.id, attended: ratings[p.id] ?? true })),
        }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      setDone(true);
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0FEA95" />
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={80} color="#0FEA95" />
        <Text style={styles.doneTitle}>Ratings Submitted!</Text>
        <Text style={styles.doneSubtitle}>Your feedback helps build a trustworthy community.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Back to My Games</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rate Players</Text>
          <Text style={styles.subtitle}>
            {(sport as string)?.toUpperCase() ?? 'Game'}
            {scheduledTime ? `  ·  ${scheduledTime}` : ''}
          </Text>
        </View>
      </View>

      {players.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle" size={70} color="#0FEA95" />
          <Text style={styles.emptyTitle}>All players rated!</Text>
          <Text style={styles.emptySubtitle}>You've already rated everyone in this game.</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.instructions}>Did each player show up?</Text>
          <FlatList
            data={players}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const attended = ratings[item.id] ?? true;
              return (
                <View style={styles.playerCard}>
                  <View style={styles.playerLeft}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={22} color="#8E8E93" />
                    </View>
                    <Text style={styles.username}>{item.username}</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, attended && styles.toggleBtnAttended]}
                      onPress={() => setRatings((prev) => ({ ...prev, [item.id]: true }))}
                    >
                      <Ionicons name="checkmark" size={18} color={attended ? '#1C1C1E' : '#8E8E93'} />
                      <Text style={[styles.toggleText, attended && styles.toggleTextAttended]}>Showed Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, !attended && styles.toggleBtnNoShow]}
                      onPress={() => setRatings((prev) => ({ ...prev, [item.id]: false }))}
                    >
                      <Ionicons name="close" size={18} color={!attended ? '#1C1C1E' : '#8E8E93'} />
                      <Text style={[styles.toggleText, !attended && styles.toggleTextNoShow]}>No-Show</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#1C1C1E" />
                : <Text style={styles.submitBtnText}>Submit Ratings</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center: { flex: 1, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  backBtn: { marginRight: 12 },
  title: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#8E8E93', marginTop: 2 },

  instructions: { color: '#8E8E93', fontSize: 14, fontWeight: '600', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },

  playerCard: { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 14, marginBottom: 12 },
  playerLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3A3A3C', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  username: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10, backgroundColor: '#3A3A3C' },
  toggleBtnAttended: { backgroundColor: '#0FEA95' },
  toggleBtnNoShow:   { backgroundColor: '#FF453A' },
  toggleText: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  toggleTextAttended: { color: '#1C1C1E' },
  toggleTextNoShow:   { color: '#1C1C1E' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, backgroundColor: '#1C1C1E', borderTopWidth: 1, borderTopColor: '#2C2C2E' },
  submitBtn: { backgroundColor: '#0FEA95', height: 56, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowColor: '#0FEA95', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtnText: { color: '#1C1C1E', fontSize: 17, fontWeight: '900' },

  doneTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 20 },
  doneSubtitle: { fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' },
  doneBtn: { marginTop: 30, backgroundColor: '#0FEA95', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  doneBtnText: { color: '#1C1C1E', fontWeight: '900', fontSize: 16 },

  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' },
});
