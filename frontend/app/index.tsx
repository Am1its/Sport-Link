import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { token, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' }}>
        <ActivityIndicator size="large" color="#0FEA95" />
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;
  if (!user?.onboarding_complete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
