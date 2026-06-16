import { useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SoundProvider } from '../context/SoundContext';
import { registerPushToken } from '../utils/registerPushToken';
import { setUnauthorizedHandler } from '../utils/api';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: false,
  tracesSampleRate: 0.2,
});

function navigateFromNotification(data: Record<string, any>, router: ReturnType<typeof useRouter>) {
  if (!data) return;
  if (data.gameId) {
    router.push({ pathname: '/game/[id]', params: { id: String(data.gameId) } } as any);
  } else if (data.screen === 'friends') {
    router.push('/friends' as any);
  } else if (data.screen === 'games') {
    router.push('/(tabs)/games' as any);
  }
}

function AppServices() {
  const { token, logout, user } = useAuth();
  const router = useRouter();
  const coldStartHandled = useRef(false);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (token) registerPushToken(token);
  }, [token]);

  // Handle tap when app is open or backgrounded — skip if onboarding not done
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      if (!user?.onboarding_complete) return;
      navigateFromNotification(response.notification.request.content.data as Record<string, any>, router);
    });
    return () => sub.remove();
  }, [router, user]);

  // Handle tap that cold-started the app — wait for user to load before navigating
  useEffect(() => {
    if (!token || !user || coldStartHandled.current) return;
    coldStartHandled.current = true;
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response && user.onboarding_complete) {
        navigateFromNotification(response.notification.request.content.data as Record<string, any>, router);
      }
    });
  }, [token, router, user]);

  return null;
}

function RootLayout() {
  return (
    <SoundProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#1C1C1E" translucent={false} />
        <AppServices />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="register" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="game-chat" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="court-detail" options={{ animationDuration: 380 }} />
          <Stack.Screen name="player-matching" />
          <Stack.Screen name="direct-chat" />
          <Stack.Screen name="game/[id]" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="invite/[id]" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="player-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="game-participants" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notification-inbox" options={{ presentation: 'modal' }} />
          <Stack.Screen name="game-results" options={{ animationDuration: 380 }} />
          <Stack.Screen name="leaderboard" options={{ animationDuration: 380 }} />
          <Stack.Screen name="rate-players" options={{ animationDuration: 380 }} />
        </Stack>
      </AuthProvider>
    </SoundProvider>
  );
}

export default Sentry.wrap(RootLayout);
