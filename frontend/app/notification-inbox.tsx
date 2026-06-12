import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';

type Notification = {
  id: number;
  title: string;
  body: string;
  data: any;
  is_read: boolean;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationInboxScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications', { token });
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  const markRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT', token });
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PUT', token });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
    setMarkingAll(false);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll}>
            {markingAll
              ? <ActivityIndicator size="small" color="#0FEA95" />
              : <Text style={styles.markAllText}>Mark all read</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={70} color="#2C2C2E" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.is_read && styles.itemUnread]}
              onPress={() => markRead(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.dot, item.is_read && styles.dotRead]} />
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemBody}>{item.body}</Text>
                <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  backBtn: { width: 40 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  markAllText: { color: '#0FEA95', fontSize: 13, fontWeight: '700', width: 80, textAlign: 'right' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#636366', fontSize: 16, marginTop: 12 },

  list: { paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  itemUnread: { backgroundColor: '#0FEA9508' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0FEA95', marginTop: 6 },
  dotRead: { backgroundColor: 'transparent' },
  itemContent: { flex: 1 },
  itemTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  itemBody: { color: '#AEAEB2', fontSize: 13, lineHeight: 18, marginBottom: 5 },
  itemTime: { color: '#636366', fontSize: 11 },
});
