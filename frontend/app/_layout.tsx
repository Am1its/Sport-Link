import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { registerPushToken } from '../utils/registerPushToken';
import { setUnauthorizedHandler } from '../utils/api';

function AppServices() {
  const { token, logout } = useAuth();

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (token) registerPushToken(token);
  }, [token]);

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
      </Stack>
    </AuthProvider>
  );
}
