import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { formatChatTimestamp } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS } from '../../constants/sports';
import { getAvatarColor } from '../../utils/avatar';

type GameChat = {
  id: number;
  sport_type: string;
  location_desc: string | null;
  scheduled_time: string | null;
  last_message: string | null;
  last_sender: string | null;
  last_message_at: string | null;
};

type DMConversation = {
  id: number;
  username: string;
  avatar: string | null;
  last_content: string | null;
  last_type: string;
  last_event_id: number | null;
  last_sender_id: number;
  last_time: string | null;
  unread_count: number;
};

export default function ChatScreen() {
  const { token, user } = useAuth();
  const router = useRouter();

  const [tab, setTab]           = useState<'events' | 'friends'>('events');
  const [gameChats, setGameChats] = useState<GameChat[]>([]);
  const [dms, setDms]           = useState<DMConversation[]>([]);
  const [loading, setLoading]   = useState(true);

  const totalUnread = dms.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  useFocusEffect(
    useCallback(() => {
      const fetchAll = async () => {
        setLoading(true);
        try {
          const [gRes, dRes] = await Promise.all([
            apiFetch('/api/chats', { token }),
            apiFetch('/api/dm',    { token }),
          ]);
          const [gData, dData] = await Promise.all([gRes.json(), dRes.json()]);
          if (gData.success) setGameChats(gData.chats);
          if (dData.success) setDms(dData.conversations);
        } catch (err) {
          if (err instanceof UnauthorizedError) return;
        } finally {
          setLoading(false);
        }
      };
      fetchAll();
    }, [token])
  );

  const renderGameChat = ({ item }: { item: GameChat }) => {
    const color    = SPORT_COLORS[item.sport_type] ?? '#0FEA95';
    const icon     = SPORT_ICONS[item.sport_type]  ?? 'map-marker';
    const gameName = `${item.sport_type.charAt(0).toUpperCase() + item.sport_type.slice(1)} Game`;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push({ pathname: '/game-chat', params: { id: item.id, name: gameName } })}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '22', borderColor: color }]}>
          <MaterialCommunityIcons name={icon as any} size={26} color={color} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle}>{gameName}</Text>
            <Text style={styles.rowTime}>{formatChatTimestamp(item.last_message_at)}</Text>
          </View>
          {item.location_desc ? <Text style={styles.rowSub} numberOfLines={1}>{item.location_desc}</Text> : null}
          <Text style={styles.rowPreview} numberOfLines={1}>
            {item.last_message
              ? `${item.last_sender}: ${item.last_message}`
              : 'No messages yet — say hi! 👋'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#3A3A3C" />
      </TouchableOpacity>
    );
  };

  const renderDM = ({ item }: { item: DMConversation }) => {
    const color      = getAvatarColor(item.username);
    const hasUnread  = item.unread_count > 0;
    const isMine     = item.last_sender_id === user?.id;
    const preview    = item.last_type === 'event'
      ? (isMine ? 'You shared a game event' : 'Shared a game event')
      : (item.last_content
        ? (isMine ? `You: ${item.last_content}` : item.last_content)
        : 'Say hi! 👋');

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push({
          pathname: '/direct-chat',
          params: { userId: String(item.id), username: item.username },
        })}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarCircle, { backgroundColor: color + '22', borderColor: color }]}>
            {item.avatar ? (
              <Image source={{ uri: `data:image/jpeg;base64,${item.avatar}` }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarLetter, { color }]}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          {hasUnread && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowTitle, hasUnread && { color: '#FFFFFF' }]}>{item.username}</Text>
            <Text style={styles.rowTime}>{formatChatTimestamp(item.last_time)}</Text>
          </View>
          <Text style={[styles.rowPreview, hasUnread && styles.rowPreviewBold]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'events' && styles.tabActive]}
          onPress={() => setTab('events')}
        >
          <Ionicons name="trophy-outline" size={16} color={tab === 'events' ? '#1C1C1E' : '#636366'} />
          <Text style={[styles.tabText, tab === 'events' && styles.tabTextActive]}>Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'friends' && styles.tabActive]}
          onPress={() => setTab('friends')}
        >
          <Ionicons name="people-outline" size={16} color={tab === 'friends' ? '#1C1C1E' : '#636366'} />
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>Friends</Text>
          {totalUnread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{totalUnread > 9 ? '9+' : totalUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : tab === 'events' ? (
        gameChats.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="trophy-outline" size={70} color="#2C2C2E" />
            <Text style={styles.emptyTitle}>No event chats yet</Text>
            <Text style={styles.emptySub}>Join or create a game to start chatting</Text>
          </View>
        ) : (
          <FlatList
            data={gameChats}
            keyExtractor={item => String(item.id)}
            renderItem={renderGameChat}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      ) : (
        dms.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="chatbubble-ellipses-outline" size={70} color="#2C2C2E" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>Go to a friend's profile to start a conversation</Text>
          </View>
        ) : (
          <FlatList
            data={dms}
            keyExtractor={item => String(item.id)}
            renderItem={renderDM}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: 20 },
  title:     { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginTop: 60, marginBottom: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { paddingBottom: 30 },
  separator: { height: 1, backgroundColor: '#2C2C2E', marginLeft: 72 },

  tabs:          { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 14, padding: 4, marginBottom: 16 },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 11 },
  tabActive:     { backgroundColor: '#0FEA95' },
  tabText:       { fontSize: 14, fontWeight: '700', color: '#636366' },
  tabTextActive: { color: '#1C1C1E' },
  tabBadge:      { backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  tabBadgeText:  { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBody: { flex: 1, marginRight: 8 },
  rowTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  rowTitle:   { fontSize: 16, fontWeight: '700', color: '#AEAEB2' },
  rowTime:    { fontSize: 12, color: '#636366' },
  rowSub:     { fontSize: 12, color: '#8E8E93', marginBottom: 2 },
  rowPreview: { fontSize: 13, color: '#636366' },
  rowPreviewBold: { color: '#AEAEB2', fontWeight: '600' },

  iconCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },

  avatarWrap:   { position: 'relative', marginRight: 14 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage:  { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 20, fontWeight: '900' },
  unreadDot:    { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#0FEA95', borderWidth: 2, borderColor: '#1C1C1E' },

  unreadBadge:     { backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },

  emptyTitle: { color: '#FFFFFF', fontSize: 18, marginTop: 15, fontWeight: 'bold' },
  emptySub:   { color: '#8E8E93', fontSize: 14, marginTop: 5, textAlign: 'center' },
});
