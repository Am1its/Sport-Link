import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../constants/api';

type Message = {
  id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function GameChatScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { token, user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chats/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/chats/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      await fetchMessages();
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSending(false);
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
            return (
              <View key={msg.id} style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
                {!isOwn && <Text style={styles.senderName}>{msg.username}</Text>}
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{msg.content}</Text>
                </View>
                <Text style={[styles.timestamp, isOwn && { textAlign: 'right' }]}>
                  {formatTime(msg.created_at)}
                </Text>
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

  bubbleRow: { maxWidth: '80%' },
  bubbleRowOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },

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
