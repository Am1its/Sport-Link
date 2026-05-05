import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../constants/api';

type ChatPreview = {
  id: number;
  sport_type: string;
  location_desc: string | null;
  scheduled_time: string | null;
  last_message: string | null;
  last_sender: string | null;
  last_message_at: string | null;
};

const SPORT_COLORS: Record<string, string> = {
  basketball: '#FF8C00',
  tennis:     '#CCFF00',
  volleyball: '#FFD700',
  football:   '#FFFFFF',
};
const SPORT_ICONS: Record<string, string> = {
  basketball: 'basketball',
  tennis:     'tennis',
  volleyball: 'volleyball',
  football:   'soccer',
};

const formatTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function ChatScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchChats = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/api/chats`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) setChats(data.chats);
        } catch (err) {
          console.error('Chats fetch error:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchChats();
    }, [token])
  );

  const renderItem = ({ item }: { item: ChatPreview }) => {
    const color = SPORT_COLORS[item.sport_type] ?? '#0FEA95';
    const icon  = SPORT_ICONS[item.sport_type]  ?? 'map-marker';
    const gameName = `${item.sport_type.charAt(0).toUpperCase() + item.sport_type.slice(1)} Game`;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        onPress={() => router.push({ pathname: '/game-chat', params: { id: item.id, name: gameName } })}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color }]}>
          <MaterialCommunityIcons name={icon as any} size={26} color={color} />
        </View>

        <View style={styles.chatBody}>
          <View style={styles.chatTopRow}>
            <Text style={styles.chatTitle}>{gameName}</Text>
            <Text style={styles.chatTime}>{formatTime(item.last_message_at)}</Text>
          </View>
          {item.location_desc ? (
            <Text style={styles.chatSub} numberOfLines={1}>{item.location_desc}</Text>
          ) : null}
          <Text style={styles.chatPreview} numberOfLines={1}>
            {item.last_message
              ? `${item.last_sender}: ${item.last_message}`
              : 'No messages yet — say hi! 👋'}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#3A3A3C" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={80} color="#2C2C2E" />
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySub}>Join or create a game to start chatting</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 60, marginBottom: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 30 },
  separator: { height: 1, backgroundColor: '#2C2C2E', marginLeft: 72 },

  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  chatBody: { flex: 1, marginRight: 8 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  chatTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  chatTime: { fontSize: 12, color: '#636366' },
  chatSub: { fontSize: 12, color: '#8E8E93', marginBottom: 2 },
  chatPreview: { fontSize: 13, color: '#636366' },

  emptyTitle: { color: '#FFFFFF', fontSize: 18, marginTop: 15, fontWeight: 'bold' },
  emptySub: { color: '#8E8E93', fontSize: 14, marginTop: 5, textAlign: 'center' },
});
