import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

WebBrowser.maybeCompleteAuthSession();

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export function useGoogleAuth() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const code = response.params.code;

    const exchange = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({
            code,
            code_verifier: request?.codeVerifier,
            redirect_uri: request?.redirectUri,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          Alert.alert('Sign in failed', data.message ?? 'Google sign-in failed');
          return;
        }
        await login(data.token, data.user);
      } catch {
        Alert.alert('Error', 'Could not connect to server.');
      } finally {
        setLoading(false);
      }
    };

    exchange();
  }, [response]);

  return {
    promptAsync,
    loading,
    disabled: !request || loading,
  };
}
