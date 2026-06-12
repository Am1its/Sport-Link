import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { formatTime } from '../utils/time';
import { API_BASE } from '../constants/api';
import { Colors } from '../constants/theme';
import { BackButton } from '../components/BackButton';
import { SOCKET_EVENTS } from '../constants/events';
import { usePressAnimation } from '../hooks/useAnimations';
import { ChatBubble } from '../components/ChatBubble';

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

  const { animatedStyle: sendPressStyle, onPressIn: sendPressIn, onPressOut: sendPressOut } = usePressAnimation({
    scaleDown: 0.88,
    scaleUp: 1.0,
    stiffness: 500,
    damping: 20,
  });
  const sendOpacity = useSharedValue(0.35);
  const sendBtnStyle = useAnimatedStyle(() => ({
    opacity: sendOpacity.value,
  }));

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
    socket.emit(SOCKET_EVENTS.JOIN_GAME, id);
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, (msg: Message) => {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    if (socketRef.current?.connected) {
      socketRef.current.emit(SOCKET_EVENTS.SEND_MESSAGE, { gameId: id, content });
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
    return (
      <ChatBubble
        messageId={msg.id}
        userId={msg.user_id}
        username={msg.username}
        content={msg.content}
        createdAt={msg.created_at}
        isMine={msg.user_id === user?.id}
        avatar={avatarCache[msg.user_id]}
        onAvatarPress={() => router.push({ pathname: '/player-profile', params: { id: String(msg.user_id) } } as any)}
        formatTime={formatTime}
      />
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
            onChangeText={(text) => {
              setInput(text);
              sendOpacity.value = withTiming(text.length > 0 ? 1 : 0.35, { duration: 150 });
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
        </View>
        <Animated.View style={[sendBtnStyle, sendPressStyle]}>
          <Pressable
            onPress={sendMessage}
            onPressIn={() => { if (input.trim()) sendPressIn(); }}
            onPressOut={() => { if (input.trim()) sendPressOut(); }}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, inputFocused && styles.sendBtnActive]}
          >
            <Ionicons name="send" size={20} color={Colors.bg} />
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg },
  headerTitle: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, flexGrow: 1, justifyContent: 'flex-end' },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyChatIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyChatText: { color: Colors.textMuted, fontSize: 15 },

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
