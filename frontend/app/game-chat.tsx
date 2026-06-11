import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { formatTime } from '../utils/time';
import { API_BASE } from '../constants/api';
import { Colors, Radius } from '../constants/theme';

const MAX_MESSAGE_LENGTH = 1000;
const PAGE_SIZE = 30;

type Message = {
  id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
};

export default function GameChatScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { token, user } = useAuth();

  // Messages stored newest-first for the inverted FlatList
  const [messages, setMessages]       = useState<Message[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [input, setInput]             = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [sending, setSending]         = useState(false);
  const [avatarCache, setAvatarCache] = useState<Record<number, string | null>>({});
  const seenUserIds = useRef<Set<number>>(new Set());
  const socketRef   = useRef<Socket | null>(null);

  const fetchAvatars = async (userIds: number[]) => {
    const newIds = userIds.filter(uid => !seenUserIds.current.has(uid));
    if (newIds.length === 0) return;
    newIds.forEach(uid => seenUserIds.current.add(uid));
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
      const res  = await apiFetch(`/api/chats/${id}/messages?limit=${PAGE_SIZE}`, { token });
      const data = await res.json();
      if (data.success) {
        // Server returns ASC; reverse to newest-first for inverted FlatList
        setMessages([...data.messages].reverse());
        setHasMore(data.messages.length === PAGE_SIZE);
        const otherIds = [...new Set<number>(
          data.messages
            .filter((m: Message) => m.user_id !== user?.id)
            .map((m: Message) => m.user_id)
        )];
        fetchAvatars(otherIds);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    // oldest message is at the END of the newest-first array
    const oldestId = messages[messages.length - 1].id;
    setLoadingMore(true);
    try {
      const res  = await apiFetch(`/api/chats/${id}/messages?before=${oldestId}&limit=${PAGE_SIZE}`, { token });
      const data = await res.json();
      if (data.success) {
        // Server returns ASC; reverse to newest-first, then append (visually older = higher in list)
        const older = [...data.messages].reverse();
        setMessages(prev => [...prev, ...older]);
        setHasMore(data.messages.length === PAGE_SIZE);
        const otherIds = [...new Set<number>(
          data.messages.filter((m: Message) => m.user_id !== user?.id).map((m: Message) => m.user_id)
        )];
        fetchAvatars(otherIds);
      }
    } catch {}
    finally { setLoadingMore(false); }
  };

  useEffect(() => {
    if (user?.id) fetchAvatars([user.id]);
    fetchMessages();
    AsyncStorage.setItem(`chat_last_read_${id}`, new Date().toISOString());

    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_game', id);
    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [msg, ...prev]; // newest first
      });
      AsyncStorage.setItem(`chat_last_read_${id}`, new Date().toISOString());
      fetchAvatars([msg.user_id]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  const sendMessage = () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', { gameId: id, content });
    } else {
      setSending(true);
      apiFetch(`/api/chats/${id}/messages`, { method: 'POST', token, body: JSON.stringify({ content }) })
        .then(r => r.json())
        .then(data => { if (data.success) setMessages(prev => [data.message, ...prev]); })
        .catch(err => { if (!(err instanceof UnauthorizedError)) console.error('Send message error:', err); })
        .finally(() => setSending(false));
    }
  };

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const isOwn = msg.user_id === user?.id;
    const color = getAvatarColor(msg.username);
    const avatarBase64 = avatarCache[msg.user_id] ?? null;

    const avatarCircle = (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(msg.user_id) } })}
        activeOpacity={0.75}
      >
        <View style={[styles.avatarSmall, { backgroundColor: color + '22', borderColor: color }]}>
          {avatarBase64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${avatarBase64}` }} style={styles.avatarSmallImage} />
          ) : (
            <Text style={[styles.avatarSmallLetter, { color }]}>
              {msg.username.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );

    if (isOwn) {
      return (
        <View style={styles.bubbleRowOwn}>
          <View style={styles.bubbleOwnContent}>
            <View style={[styles.bubble, styles.bubbleOwn]}>
              <Text style={[styles.bubbleText, styles.bubbleTextOwn]}>{msg.content}</Text>
            </View>
            <Text style={[styles.timestamp, { textAlign: 'right' }]}>{formatTime(msg.created_at)}</Text>
          </View>
          {avatarCircle}
        </View>
      );
    }

    return (
      <View style={styles.bubbleRowOther}>
        {avatarCircle}
        <View style={styles.bubbleOtherContent}>
          <Text style={styles.senderName}>{msg.username}</Text>
          <View style={[styles.bubble, styles.bubbleOther]}>
            <Text style={styles.bubbleText}>{msg.content}</Text>
          </View>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name ?? 'Game Chat'}</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          // In an inverted list, ListFooterComponent renders at the visual TOP (older messages)
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={Colors.accent} style={{ paddingVertical: 12 }} />
            : null}
          ListHeaderComponent={messages.length === 0 ? (
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatIconWrap}>
                <Ionicons name="chatbubbles-outline" size={38} color={Colors.surface2} />
              </View>
              <Text style={styles.emptyChatText}>No messages yet. Say hi! 👋</Text>
            </View>
          ) : null}
        />
      )}

      <View style={styles.inputRow}>
        <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || sending) && styles.sendBtnDisabled,
            input.trim() && styles.sendBtnActive,
          ]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="send" size={20} color={input.trim() ? Colors.bg : Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg },
  backBtn: { width: 40 },
  headerTitle: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, flexGrow: 1, justifyContent: 'flex-end' },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyChatIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyChatText: { color: Colors.textMuted, fontSize: 15 },

  bubbleRowOwn: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '85%' },
  bubbleOwnContent: { flex: 1, alignItems: 'flex-end' },
  bubbleRowOther: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '85%' },

  avatarSmall: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  avatarSmallImage: { width: '100%', height: '100%' },
  avatarSmallLetter: { fontSize: 14, fontWeight: '900' },

  bubbleOtherContent: { flex: 1 },
  senderName: { color: Colors.textSub, fontSize: 12, fontWeight: '600', marginBottom: 3, marginLeft: 4 },

  bubble:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn:    { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleOther:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText:   { color: Colors.text, fontSize: 15, lineHeight: 21 },
  bubbleTextOwn: { color: Colors.bg },

  timestamp: { color: Colors.textMuted, fontSize: 11, marginTop: 3, marginHorizontal: 4 },

  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  inputWrap:  { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 22, backgroundColor: Colors.surface, marginRight: 8 },
  inputWrapFocused: { borderColor: Colors.accent },
  input:      { paddingHorizontal: 16, paddingVertical: 10, color: Colors.text, fontSize: 15, maxHeight: 120 },
  sendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.surface2 },
  sendBtnActive:   {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
