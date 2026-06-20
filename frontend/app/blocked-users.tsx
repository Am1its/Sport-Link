import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import AvatarCircle from '../components/AvatarCircle';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';
import { API } from '../constants/endpoints';

type BlockedUser = { id: number; username: string; avatar: string | null };

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await apiFetch(API.USERS_BLOCKED, { token });
      const data = await res.json();
      if (data.success) setBlocked(data.blocked);
    } catch (err: any) {
      if (err?.name === 'UnauthorizedError') return;
      console.error('Blocked users fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchBlocked(); }, [fetchBlocked]));

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert('Unblock User', `Unblock ${user.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock', onPress: async () => {
          try {
            await apiFetch(API.userBlock(user.id), { method: 'DELETE', token });
            setBlocked(prev => prev.filter(u => u.id !== user.id));
          } catch {
            Alert.alert('Error', 'Could not unblock user');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Blocked Users</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="ban-outline" size={38} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyText}>No blocked users</Text>
          <Text style={styles.emptySub}>Users you block will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <AvatarCircle username={item.username} avatar={item.avatar} />
              <Text style={styles.rowName}>{item.username}</Text>
              <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item)}>
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  title:     { fontSize: 22, fontWeight: '900', color: Colors.text },

  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText:       { fontSize: 16, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 },
  emptySub:        { fontSize: 13, color: Colors.textHint, textAlign: 'center' },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 30 },
  row:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, marginBottom: 8, ...Shadow.card },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text, marginLeft: 12 },

  unblockBtn:  { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.surface2, borderRadius: Radius.md },
  unblockText: { fontSize: 13, fontWeight: '700', color: Colors.textSub },
});
