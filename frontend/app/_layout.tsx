import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { registerPushToken } from '../utils/registerPushToken';
import { setUnauthorizedHandler } from '../utils/api';

function navigateFromNotification(data: Record<string, any>, router: ReturnType<typeof useRouter>) {
  if (!data) return;
  if (data.gameId) {
    router.push({ pathname: '/game-chat', params: { id: String(data.gameId), name: 'Game' } });
  } else if (data.screen === 'friends') {
    router.push('/friends' as any);
  } else if (data.screen === 'games') {
    router.push('/(tabs)/games' as any);
  }
}

function AppServices() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const coldStartHandled = useRef(false);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (token) registerPushToken(token);
  }, [token]);

  // Handle tap when app is open or backgrounded
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      navigateFromNotification(response.notification.request.content.data as Record<string, any>, router);
    });
    return () => sub.remove();
  }, [router]);

  // Handle tap that cold-started the app — runs once after auth resolves
  useEffect(() => {
    if (!token || coldStartHandled.current) return;
    coldStartHandled.current = true;
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) navigateFromNotification(response.notification.request.content.data as Record<string, any>, router);
    });
  }, [token, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppServices />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="game-chat" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="court-detail" />
        <Stack.Screen name="player-matching" />
        <Stack.Screen name="direct-chat" />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="activity" />
      </Stack>
    </AuthProvider>
  );
}
