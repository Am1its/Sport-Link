import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView, Image,
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

const MAX_MESSAGE_LENGTH = 1000;

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

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [avatarCache, setAvatarCache] = useState<Record<number, string | null>>({});
  const seenUserIds = useRef<Set<number>>(new Set());
  const scrollRef = useRef<ScrollView>(null);
  const socketRef = useRef<Socket | null>(null);

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
      const res = await apiFetch(`/api/chats/${id}/messages`, { token });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
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

  useEffect(() => {
    if (user?.id) fetchAvatars([user.id]);
    fetchMessages();
    AsyncStorage.setItem(`chat_last_read_${id}`, new Date().toISOString());

    // Connect socket.io for real-time messages
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_game', id);
    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      AsyncStorage.setItem(`chat_last_read_${id}`, new Date().toISOString());
      fetchAvatars([msg.user_id]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', { gameId: id, content });
    } else {
      // Fallback to REST if socket not connected
      setSending(true);
      apiFetch(`/api/chats/${id}/messages`, { method: 'POST', token, body: JSON.stringify({ content }) })
        .then(r => r.json())
        .then(data => { if (data.success) setMessages(prev => [...prev, data.message]); })
        .catch(err => { if (!(err instanceof UnauthorizedError)) console.error('Send message error:', err); })
        .finally(() => setSending(false));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name ?? 'Game Chat'}</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0FEA95" size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={60} color="#3A3A3C" />
              <Text style={styles.emptyChatText}>No messages yet. Say hi! 👋</Text>
            </View>
          )}
          {messages.map((msg) => {
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
                <View key={msg.id} style={styles.bubbleRowOwn}>
                  <View style={styles.bubbleOwnContent}>
                    <View style={[styles.bubble, styles.bubbleOwn]}>
                      <Text style={[styles.bubbleText, styles.bubbleTextOwn]}>{msg.content}</Text>
                    </View>
                    <Text style={[styles.timestamp, { textAlign: 'right' }]}>
                      {formatTime(msg.created_at)}
                    </Text>
                  </View>
                  {avatarCircle}
                </View>
              );
            }

            return (
              <View key={msg.id} style={styles.bubbleRowOther}>
                <View style={[styles.avatarSmall, { backgroundColor: color + '22', borderColor: color }]}>
                  {avatarBase64 ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${avatarBase64}` }} style={styles.avatarSmallImage} />
                  ) : (
                    <Text style={[styles.avatarSmallLetter, { color }]}>
                      {msg.username.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.bubbleOtherContent}>
                  <Text style={styles.senderName}>{msg.username}</Text>
                  <View style={[styles.bubble, styles.bubbleOther]}>
                    <Text style={styles.bubbleText}>{msg.content}</Text>
                  </View>
                  <Text style={styles.timestamp}>{formatTime(msg.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#636366"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="send" size={20} color={input.trim() ? '#1C1C1E' : '#636366'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1C1E' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E', backgroundColor: '#1C1C1E' },
  backBtn: { width: 40 },
  headerTitle: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyChatText: { color: '#636366', marginTop: 12, fontSize: 15 },

  bubbleRowOwn: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '85%' },
  bubbleOwnContent: { flex: 1, alignItems: 'flex-end' },
  bubbleRowOther: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '85%' },

  avatarSmall: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  avatarSmallImage: { width: '100%', height: '100%' },
  avatarSmallLetter: { fontSize: 14, fontWeight: '900' },

  bubbleOtherContent: { flex: 1 },
  senderName: { color: '#8E8E93', fontSize: 12, fontWeight: '600', marginBottom: 3, marginLeft: 4 },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn:   { backgroundColor: '#0FEA95', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#2C2C2E', borderBottomLeftRadius: 4 },
  bubbleText:  { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  bubbleTextOwn: { color: '#1C1C1E' },

  timestamp: { color: '#636366', fontSize: 11, marginTop: 3, marginHorizontal: 4 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2C2C2E', backgroundColor: '#1C1C1E' },
  input: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 15, maxHeight: 120, marginRight: 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0FEA95', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#2C2C2E' },
});
