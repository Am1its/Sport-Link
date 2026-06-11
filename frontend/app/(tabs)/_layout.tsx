import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Colors } from '../../constants/theme';
import { API_BASE } from '../../constants/api';

export default function TabLayout() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const checkUnread = useCallback(async () => {
    if (!token) return;
    try {
      const [chatsRes, dmRes] = await Promise.all([
        apiFetch('/api/chats', { token }),
        apiFetch('/api/dm',    { token }),
      ]);
      const [chatsData, dmData] = await Promise.all([chatsRes.json(), dmRes.json()]);

      let count = 0;

      if (chatsData.success) {
        for (const chat of chatsData.chats) {
          if (!chat.last_message_at) continue;
          const lastRead = await AsyncStorage.getItem(`chat_last_read_${chat.id}`);
          if (!lastRead || new Date(lastRead) < new Date(chat.last_message_at)) count++;
        }
      }

      if (dmData.success) {
        for (const dm of dmData.conversations) {
          count += dm.unread_count || 0;
        }
      }

      setUnreadCount(count);
    } catch {}
  }, [token]);

  // Poll as a fallback for game chats (DMs are now socket-driven)
  useEffect(() => {
    checkUnread();
    const interval = setInterval(checkUnread, 60000);
    return () => clearInterval(interval);
  }, [checkUnread]);

  // Real-time socket for instant DM badge updates
  useEffect(() => {
    if (!token) return;
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;
    socket.on('new_dm', () => checkUnread());
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, checkUnread]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.surface,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          height: 62,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Map',      tabBarIcon: ({ color }) => <Ionicons name="map"         size={26} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Ionicons name="search"      size={26} color={color} /> }} />
      <Tabs.Screen name="games"    options={{ title: 'My Games', tabBarIcon: ({ color }) => <Ionicons name="calendar"    size={26} color={color} /> }} />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={26} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="profile"  options={{ title: 'Profile',  tabBarIcon: ({ color }) => <Ionicons name="person"      size={26} color={color} /> }} />
    </Tabs>
  );
}
