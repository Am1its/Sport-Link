import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0FEA95',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Map',      tabBarIcon: ({ color }) => <Ionicons name="map"         size={26} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Ionicons name="search"      size={26} color={color} /> }} />
      <Tabs.Screen name="games"    options={{ title: 'My Games', tabBarIcon: ({ color }) => <Ionicons name="calendar"    size={26} color={color} /> }} />
      <Tabs.Screen name="chat"     options={{ title: 'Chat',     tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={26} color={color} /> }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile',  tabBarIcon: ({ color }) => <Ionicons name="person"      size={26} color={color} /> }} />
    </Tabs>
  );
}
