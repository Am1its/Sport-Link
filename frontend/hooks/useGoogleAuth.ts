import { useEffect, useRef, useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

WebBrowser.maybeCompleteAuthSession();

const IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     ?? '';
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID         ?? '';

const reverseClientId = IOS_CLIENT_ID.replace('.apps.googleusercontent.com', '');
const REDIRECT_URI = makeRedirectUri({
  native: `com.googleusercontent.apps.${reverseClientId}:/oauthredirect`,
});

export function useGoogleAuth() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Always-current ref — avoids stale-closure issues in the effect.
  const requestRef = useRef<typeof request | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID || undefined,
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
    redirectUri: REDIRECT_URI,
    // Disable the provider's built-in auto-exchange so we can do it ourselves.
    // Without this, the library consumes the auth code first, and our second
    // attempt at exchangeCodeAsync gets invalid_grant.
    shouldAutoExchangeCode: false,
  });

  // Keep requestRef up-to-date on every render so the effect always reads the
  // same request object that was used for the auth challenge.
  requestRef.current = request;

  const handlePromptAsync = useCallback(async () => {
    return promptAsync();
  }, [promptAsync]);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const code = response.params.code;
    const currentRequest = requestRef.current;

    const exchange = async () => {
      setLoading(true);
      try {
        // code_verifier must go in extraParams — AccessTokenRequest has no
        // first-class codeVerifier field; it is added to the form body via extraParams.
        const tokens = await exchangeCodeAsync(
          {
            clientId: IOS_CLIENT_ID,
            code,
            redirectUri: currentRequest?.redirectUri ?? REDIRECT_URI,
            extraParams: {
              code_verifier: currentRequest?.codeVerifier ?? '',
            },
          },
          { tokenEndpoint: 'https://oauth2.googleapis.com/token' }
        );

        const res = await apiFetch('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ access_token: tokens.accessToken }),
        });
        const data = await res.json();
        if (!data.success) {
          Alert.alert('Sign in failed', data.message ?? 'Google sign-in failed');
          return;
        }
        await login(data.token, data.user);
        router.replace(data.user.onboarding_complete ? '/(tabs)' : '/onboarding');
      } catch (err: any) {
        console.error('Google exchange error:', err?.message ?? err);
        Alert.alert('Error', 'Could not complete Google sign-in.');
      } finally {
        setLoading(false);
      }
    };

    exchange();
  }, [response]);

  return {
    promptAsync: handlePromptAsync,
    loading,
    disabled: !request || loading,
  };
}
