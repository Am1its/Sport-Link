import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../../utils/api';
import { formatChatTimestamp } from '../../utils/time';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../../constants/sports';
import { getAvatarColor } from '../../utils/avatar';
import { Colors, Spacing, Radius, Type } from '../../constants/theme';
import { ChatSkeleton } from '../../components/SkeletonLoader';

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

  const [tab, setTab]             = useState<'events' | 'friends'>('events');
  const [gameChats, setGameChats] = useState<GameChat[]>([]);
  const [dms, setDms]             = useState<DMConversation[]>([]);
  const [loading, setLoading]     = useState(true);

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
    const color    = SPORT_COLORS[item.sport_type] ?? Colors.accent;
    const icon     = SPORT_ICONS[item.sport_type]  ?? 'map-marker';
    const gameName = `${sportLabel(item.sport_type)} Game`;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push({ pathname: '/game-chat', params: { id: item.id, name: gameName } })}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '18', borderColor: color + '55' }]}>
          <MaterialCommunityIcons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle}>{gameName}</Text>
            <Text style={styles.rowTime}>{formatChatTimestamp(item.last_message_at)}</Text>
          </View>
          {item.location_desc ? (
            <Text style={styles.rowSub} numberOfLines={1}>{item.location_desc}</Text>
          ) : null}
          <Text style={styles.rowPreview} numberOfLines={1}>
            {item.last_message
              ? `${item.last_sender}: ${item.last_message}`
              : 'No messages yet — say hi!'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={Colors.textHint} />
      </TouchableOpacity>
    );
  };

  const renderDM = ({ item }: { item: DMConversation }) => {
    const color     = getAvatarColor(item.username);
    const hasUnread = item.unread_count > 0;
    const isMine    = item.last_sender_id === user?.id;
    const preview   = item.last_type === 'event'
      ? (isMine ? 'You shared a game event' : 'Shared a game event')
      : (item.last_content
          ? (isMine ? `You: ${item.last_content}` : item.last_content)
          : 'Say hi!');

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
          <View style={[styles.avatarCircle, { backgroundColor: color + '18', borderColor: color + '55' }]}>
            {item.avatar ? (
              <Image source={{ uri: `data:image/jpeg;base64,${item.avatar}` }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarLetter, { color }]}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          {hasUnread && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowTitle, hasUnread && { color: Colors.text, fontWeight: '800' }]}>
              {item.username}
            </Text>
            <Text style={styles.rowTime}>{formatChatTimestamp(item.last_time)}</Text>
          </View>
          <Text
            style={[styles.rowPreview, hasUnread && { color: Colors.textSub, fontWeight: '600' }]}
            numberOfLines={1}
          >
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
          activeOpacity={0.8}
        >
          <Ionicons name="trophy-outline" size={15} color={tab === 'events' ? Colors.bg : Colors.textMuted} />
          <Text style={[styles.tabText, tab === 'events' && styles.tabTextActive]}>Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'friends' && styles.tabActive]}
          onPress={() => setTab('friends')}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={15} color={tab === 'friends' ? Colors.bg : Colors.textMuted} />
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>Friends</Text>
          {totalUnread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{totalUnread > 9 ? '9+' : totalUnread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={<ChatSkeleton />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : tab === 'events' ? (
        gameChats.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
            </View>
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
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.textMuted} />
            </View>
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
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.xl },
  title:     { ...Type.screenTitle, color: Colors.text, marginTop: 60, marginBottom: Spacing.lg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { paddingBottom: 30 },
  separator: { height: 1, backgroundColor: Colors.borderSub, marginLeft: 72 },

  // Tabs
  tabs:          { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 4, marginBottom: Spacing.lg },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: Radius.md },
  tabActive:     { backgroundColor: Colors.accent },
  tabText:       { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  tabTextActive: { color: Colors.bg, fontWeight: '800' },
  tabBadge:      { backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  tabBadgeText:  { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  // Rows
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBody: { flex: 1, marginRight: 8 },
  rowTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rowTitle:   { fontSize: 15, fontWeight: '700', color: Colors.textSub },
  rowTime:    { fontSize: 12, color: Colors.textMuted },
  rowSub:     { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  rowPreview: { fontSize: 13, color: Colors.textMuted },

  iconCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 14 },

  avatarWrap:   { position: 'relative', marginRight: 14 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage:  { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 20, fontWeight: '900' },
  onlineDot:    { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: Colors.accent, borderWidth: 2, borderColor: Colors.bg },

  unreadBadge:     { backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },

  // Empty state
  emptyIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyTitle:    { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub:      { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
