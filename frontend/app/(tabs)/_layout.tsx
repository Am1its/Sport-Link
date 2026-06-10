import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Colors } from '../../constants/theme';

export default function TabLayout() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const checkUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/api/chats', { token });
      const data = await res.json();
      if (!data.success) return;

      let count = 0;
      for (const chat of data.chats) {
        if (!chat.last_message_at) continue;
        const lastRead = await AsyncStorage.getItem(`chat_last_read_${chat.id}`);
        if (!lastRead || new Date(lastRead) < new Date(chat.last_message_at)) count++;
      }
      setUnreadCount(count);
    } catch {}
  }, [token]);

  useEffect(() => {
    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [checkUnread]);

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
