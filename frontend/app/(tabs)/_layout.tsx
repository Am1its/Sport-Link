import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Colors } from '../../constants/theme';
import { API_BASE } from '../../constants/api';
import { API } from '../../constants/endpoints';
import { SOCKET_EVENTS } from '../../constants/events';

function AnimatedTabIcon({ name, color, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; color: string; focused: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1.0, { stiffness: 400, damping: 18 });
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <Ionicons name={name} size={26} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const checkUnread = useCallback(async () => {
    if (!token) return;
    try {
      const [chatsRes, dmRes] = await Promise.all([
        apiFetch(API.CHATS, { token }),
        apiFetch(API.DM,    { token }),
      ]);
      const [chatsData, dmData] = await Promise.all([chatsRes.json(), dmRes.json()]);

      let count = 0;

      if (chatsData.success) {
        const chatsWithMsg = chatsData.chats.filter((c: any) => c.last_message_at);
        const keys = chatsWithMsg.map((c: any) => `chat_last_read_${c.id}`);
        const readEntries = await AsyncStorage.multiGet(keys);
        readEntries.forEach(([, lastRead], i) => {
          if (!lastRead || new Date(lastRead) < new Date(chatsWithMsg[i].last_message_at)) count++;
        });
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
    socket.on(SOCKET_EVENTS.NEW_DM, () => checkUnread());
    return () => { socket.disconnect(); };
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
      <Tabs.Screen name="index"    options={{ title: 'Map',      tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="map"         color={color} focused={focused} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="search"      color={color} focused={focused} /> }} />
      <Tabs.Screen name="games"    options={{ title: 'My Games', tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="calendar"    color={color} focused={focused} /> }} />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="chatbubbles" color={color} focused={focused} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="profile"  options={{ title: 'Profile',  tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="person"      color={color} focused={focused} /> }} />
    </Tabs>
  );
}
