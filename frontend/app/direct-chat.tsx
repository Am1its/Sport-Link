import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Modal, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { formatTime } from '../utils/time';
import { API_BASE } from '../constants/api';
import { SPORT_COLORS, SPORT_ICONS, sportLabel } from '../constants/sports';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';
import { BackButton } from '../components/BackButton';
import { SOCKET_EVENTS } from '../constants/events';

type DmMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string | null;
  type: 'text' | 'event';
  event_id: number | null;
  is_read: boolean;
  created_at: string;
  game_title?: string | null;
  game_sport?: string | null;
  game_time?: string | null;
  game_location?: string | null;
  game_max_players?: number | null;
  game_status?: string | null;
  game_current_players?: number;
  game_joined?: boolean | number;
  game_is_host?: boolean | number;
};

type MyGame = {
  id: number;
  title: string | null;
  sport_type: string;
  scheduled_time: string;
  location_desc: string | null;
  max_players: number;
  current_players?: number;
};

const formatGameTime = (t: string) => {
  const [datePart, timePart] = t.split(' ');
  if (!datePart || !timePart) return t;
  const [, month, day] = datePart.split('-');
  const [hour, min] = timePart.split(':');
  const h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day}/${month} ${h12}:${min} ${ampm}`;
};

export default function DirectChatScreen() {
  const router = useRouter();
  const { userId, username } = useLocalSearchParams<{ userId: string; username: string }>();
  const { token, user } = useAuth();

  const [messages, setMessages]       = useState<DmMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [avatarCache, setAvatarCache] = useState<Record<number, string | null>>({});
  const [showPicker, setShowPicker]   = useState(false);
  const [myGames, setMyGames]         = useState<MyGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [isTyping, setIsTyping]       = useState(false);

  const scrollRef        = useRef<ScrollView>(null);
  const socketRef        = useRef<Socket | null>(null);
  const seenIds          = useRef<Set<number>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit   = useRef<number>(0);

  const otherId = parseInt(userId, 10);

  const fetchAvatars = async (ids: number[]) => {
    const newIds = ids.filter(id => !seenIds.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach(id => seenIds.current.add(id));
    try {
      const res = await apiFetch(`/api/users/avatars?ids=${newIds.join(',')}`, { token });
      const data = await res.json();
      if (data.success) {
        const map: Record<number, string | null> = {};
        data.avatars.forEach((a: { id: number; avatar: string | null }) => { map[a.id] = a.avatar; });
        setAvatarCache(prev => ({ ...prev, ...map }));
      }
    } catch {}
  };

  const fetchMessages = async () => {
    try {
      const res  = await apiFetch(`/api/dm/${userId}`, { token });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        const ids = [...new Set<number>(data.messages.map((m: DmMessage) => m.sender_id))];
        fetchAvatars(ids);
      }
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) console.error('DM fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchAvatars([user.id]);
    fetchAvatars([otherId]);
    fetchMessages();

    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.NEW_DM, (msg: DmMessage) => {
      if (msg.sender_id !== otherId && msg.receiver_id !== otherId) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      fetchAvatars([msg.sender_id]);
      apiFetch(`/api/dm/${userId}/read`, { method: 'PUT', token }).catch(() => {});
      setIsTyping(false);
    });

    socket.on(SOCKET_EVENTS.DM_TYPING, ({ from }: { from: number }) => {
      if (from !== otherId) return;
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    });

    socket.on(SOCKET_EVENTS.DM_READ, ({ readBy }: { readBy: number }) => {
      if (readBy !== otherId) return;
      setMessages(prev => prev.map(m => m.sender_id === user?.id ? { ...m, is_read: true } : m));
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isTyping]);

  const sendText = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    try {
      const res  = await apiFetch(`/api/dm/${userId}`, {
        method: 'POST', token,
        body: JSON.stringify({ content, type: 'text' }),
      });
      const data = await res.json();
      if (data.success) setMessages(prev => [...prev, data.message]);
    } catch {}
    finally { setSending(false); }
  };

  const openEventPicker = async () => {
    setShowPicker(true);
    if (myGames.length > 0) return;
    setLoadingGames(true);
    try {
      const res  = await apiFetch('/api/games/mine', { token });
      const data = await res.json();
      if (data.success) {
        const now = new Date();
        const upcoming = (data.games as MyGame[]).filter(g => {
          const [dp, tp] = g.scheduled_time.split(' ');
          const [yr, mo, dy] = dp.split('-').map(Number);
          const [hr, mn]     = (tp || '00:00').split(':').map(Number);
          return new Date(yr, mo - 1, dy, hr, mn) > now;
        });
        setMyGames(upcoming);
      }
    } catch {}
    finally { setLoadingGames(false); }
  };

  const sendEvent = async (game: MyGame) => {
    setShowPicker(false);
    try {
      const res  = await apiFetch(`/api/dm/${userId}`, {
        method: 'POST', token,
        body: JSON.stringify({ type: 'event', event_id: game.id }),
      });
      const data = await res.json();
      if (data.success) setMessages(prev => [...prev, data.message]);
    } catch {
      Alert.alert('Error', 'Could not share the event.');
    }
  };

  const handleJoinGame = async (gameId: number) => {
    try {
      const res  = await apiFetch(`/api/games/${gameId}/join`, { method: 'POST', token });
      const data = await res.json();
      if (!data.success) return Alert.alert('Cannot join', data.message);
      setMessages(prev => prev.map(m =>
        m.event_id === gameId ? { ...m, game_joined: 1, game_current_players: (m.game_current_players || 0) + 1 } : m
      ));
    } catch {
      Alert.alert('Error', 'Could not join the game.');
    }
  };

  const renderMessage = (msg: DmMessage) => {
    const isOwn      = msg.sender_id === user?.id;
    const color      = getAvatarColor(isOwn ? (user?.username ?? '') : username);
    const avatarBase64 = avatarCache[msg.sender_id] ?? null;

    const avatar = (
      <TouchableOpacity
        onPress={() => !isOwn && router.push({ pathname: '/player-profile' as any, params: { userId: String(msg.sender_id) } })}
        activeOpacity={isOwn ? 1 : 0.75}
      >
        <View style={[styles.avatarSmall, { backgroundColor: color + '22', borderColor: color }]}>
          {avatarBase64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${avatarBase64}` }} style={styles.avatarSmallImage} />
          ) : (
            <Text style={[styles.avatarSmallLetter, { color }]}>
              {(isOwn ? (user?.username ?? '?') : username).charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );

    const bubbleContent = msg.type === 'event' ? (
      <EventCard msg={msg} isOwn={isOwn} onJoin={() => msg.event_id && handleJoinGame(msg.event_id)} />
    ) : (
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{msg.content}</Text>
      </View>
    );

    if (isOwn) {
      return (
        <View key={msg.id} style={styles.bubbleRowOwn}>
          <View style={styles.bubbleOwnContent}>
            {bubbleContent}
            <View style={styles.readReceiptRow}>
              <Text style={[styles.timestamp, { textAlign: 'right' }]}>{formatTime(msg.created_at)}</Text>
              <Ionicons
                name={msg.is_read ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={msg.is_read ? Colors.accent : Colors.textMuted}
              />
            </View>
          </View>
          {avatar}
        </View>
      );
    }
    return (
      <View key={msg.id} style={styles.bubbleRowOther}>
        {avatar}
        <View style={styles.bubbleOtherContent}>
          {bubbleContent}
          <Text style={styles.timestamp}>{formatTime(msg.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.header}>
        <BackButton />
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId } })}
          activeOpacity={0.7}
        >
          <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(username) + '33', borderColor: getAvatarColor(username) }]}>
            {avatarCache[otherId] ? (
              <Image source={{ uri: `data:image/jpeg;base64,${avatarCache[otherId]}` }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={[styles.headerAvatarLetter, { color: getAvatarColor(username) }]}>
                {username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>{username}</Text>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatCircle}>
                <Ionicons name="chatbubbles-outline" size={60} color={Colors.border} />
              </View>
              <Text style={styles.emptyChatText}>Start the conversation! 👋</Text>
            </View>
          )}
          {messages.map(renderMessage)}
          {isTyping && (
            <View style={styles.bubbleRowOther}>
              <View style={[styles.avatarSmall, { backgroundColor: getAvatarColor(username) + '22', borderColor: getAvatarColor(username) }]}>
                {avatarCache[otherId] ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${avatarCache[otherId]}` }} style={styles.avatarSmallImage} />
                ) : (
                  <Text style={[styles.avatarSmallLetter, { color: getAvatarColor(username) }]}>
                    {username.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.bubbleOtherContent}>
                <View style={[styles.bubble, styles.bubbleOther, styles.typingBubble]}>
                  <Text style={styles.typingDots}>• • •</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.shareBtn} onPress={openEventPicker}>
          <Ionicons name="add-circle-outline" size={28} color={Colors.accent} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            const now = Date.now();
            if (text.length > 0 && now - lastTypingEmit.current > 2000 && socketRef.current?.connected) {
              socketRef.current.emit(SOCKET_EVENTS.DM_TYPING, { to: otherId });
              lastTypingEmit.current = now;
            }
          }}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={sendText}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendText}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="send" size={20} color={input.trim() ? Colors.bg : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Event picker modal */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Share a Game</Text>
          <Text style={styles.modalSub}>Pick an upcoming game to share with {username}</Text>
          {loadingGames ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
          ) : myGames.length === 0 ? (
            <View style={styles.pickerEmpty}>
              <Ionicons name="calendar-outline" size={48} color={Colors.border} />
              <Text style={styles.pickerEmptyText}>No upcoming games to share</Text>
            </View>
          ) : (
            <FlatList
              data={myGames}
              keyExtractor={g => String(g.id)}
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: g }) => {
                const color = SPORT_COLORS[g.sport_type as keyof typeof SPORT_COLORS] ?? Colors.accent;
                const icon  = SPORT_ICONS[g.sport_type  as keyof typeof SPORT_ICONS]  ?? 'trophy';
                return (
                  <TouchableOpacity style={styles.pickerItem} onPress={() => sendEvent(g)} activeOpacity={0.7}>
                    <View style={[styles.pickerIcon, { backgroundColor: color + '22' }]}>
                      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerGameTitle}>{g.title || `${sportLabel(g.sport_type)} Game`}</Text>
                      <Text style={styles.pickerGameInfo}>{formatGameTime(g.scheduled_time)}{g.location_desc ? `  ·  ${g.location_desc}` : ''}</Text>
                    </View>
                    <Ionicons name="share-outline" size={20} color={Colors.accent} />
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function EventCard({ msg, isOwn, onJoin }: { msg: DmMessage; isOwn: boolean; onJoin: () => void }) {
  const color    = SPORT_COLORS[msg.game_sport as keyof typeof SPORT_COLORS] ?? Colors.accent;
  const icon     = SPORT_ICONS[msg.game_sport  as keyof typeof SPORT_ICONS]  ?? 'trophy';
  const joined   = !!msg.game_joined;
  const isHost   = !!msg.game_is_host;
  const isFull   = msg.game_current_players != null && msg.game_max_players != null &&
                   msg.game_current_players >= msg.game_max_players;
  const isActive = msg.game_status === 'active';
  const gameTitle = msg.game_title ||
    (msg.game_sport ? sportLabel(msg.game_sport) + ' Game' : 'Game');

  return (
    <View style={[styles.eventCard, { borderColor: color + '55' }]}>
      <View style={styles.eventCardHeader}>
        <View style={[styles.eventCardIcon, { backgroundColor: color + '22' }]}>
          <MaterialCommunityIcons name={icon as any} size={20} color={color} />
        </View>
        <Text style={styles.eventCardTitle} numberOfLines={1}>{gameTitle}</Text>
      </View>
      {msg.game_time ? <Text style={styles.eventCardTime}>{formatGameTime(msg.game_time)}</Text> : null}
      {msg.game_location ? <Text style={styles.eventCardLocation} numberOfLines={1}>{msg.game_location}</Text> : null}
      <View style={styles.eventCardFooter}>
        <Text style={styles.eventCardPlayers}>
          {msg.game_current_players ?? '?'}/{msg.game_max_players ?? '?'} players
        </Text>
        {msg.game_sport == null ? null : !isActive ? (
          <Text style={styles.eventCardDone}>Ended</Text>
        ) : isHost ? (
          <Text style={styles.eventCardHosted}>You host</Text>
        ) : joined ? (
          <Text style={styles.eventCardJoined}>✓ Joined</Text>
        ) : isFull ? (
          <Text style={styles.eventCardFull}>Full</Text>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.8}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderSub, backgroundColor: Colors.bg },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  headerAvatarImg:    { width: '100%', height: '100%' },
  headerAvatarLetter: { fontSize: 14, fontWeight: '900' },
  headerTitle:  { color: Colors.text, fontSize: 17, fontWeight: '800' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageList:    { flex: 1 },
  messageContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 12 },

  emptyChat:       { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyChatCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  emptyChatText:   { color: Colors.textMuted, fontSize: 15 },

  bubbleRowOwn:   { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '85%' },
  bubbleOwnContent: { flex: 1, alignItems: 'flex-end' },
  bubbleRowOther: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '85%' },
  bubbleOtherContent: { flex: 1 },

  avatarSmall:       { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  avatarSmallImage:  { width: '100%', height: '100%' },
  avatarSmallLetter: { fontSize: 14, fontWeight: '900' },

  bubble:       { borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn:    { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleOther:  { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText:   { color: Colors.text, fontSize: 15, lineHeight: 21 },
  bubbleTextOwn: { color: Colors.bg },
  timestamp:       { color: Colors.textMuted, fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  readReceiptRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  typingBubble:    { paddingHorizontal: 16, paddingVertical: 12 },
  typingDots:      { color: Colors.textMuted, fontSize: 18, letterSpacing: 2 },

  // Event card
  eventCard:       { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1.5, gap: 6, minWidth: 200, ...Shadow.card },
  eventCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventCardIcon:   { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  eventCardTitle:  { fontSize: 15, fontWeight: '800', color: Colors.text, flex: 1 },
  eventCardTime:   { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  eventCardLocation: { fontSize: 12, color: Colors.textSub },
  eventCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  eventCardPlayers: { fontSize: 12, color: Colors.textMuted },
  eventCardJoined: { fontSize: 13, color: Colors.accent, fontWeight: '700' },
  eventCardHosted: { fontSize: 13, color: Colors.orange, fontWeight: '700' },
  eventCardDone:   { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  eventCardFull:   { fontSize: 13, color: Colors.error, fontWeight: '600' },
  joinBtn:     { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  joinBtnText: { color: Colors.bg, fontSize: 13, fontWeight: '900' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderSub, backgroundColor: Colors.bg, gap: 8 },
  shareBtn: { paddingBottom: 2 },
  input:    { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, color: Colors.text, fontSize: 15, maxHeight: 120, borderWidth: 1.5, borderColor: Colors.border },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  sendBtnDisabled: { backgroundColor: Colors.surface, shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },

  // Event picker modal
  modalOverlay: { flex: 1, backgroundColor: '#00000066' },
  modalSheet:   { backgroundColor: Colors.bg, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xxl, paddingBottom: 40 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  modalSub:     { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },

  pickerEmpty:     { alignItems: 'center', paddingVertical: 32 },
  pickerEmptyText: { color: Colors.textMuted, fontSize: 15, marginTop: 12 },

  pickerItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  pickerIcon:      { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  pickerGameTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  pickerGameInfo:  { fontSize: 12, color: Colors.textMuted },
});
