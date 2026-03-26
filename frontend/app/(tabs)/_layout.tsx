import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // מעלים את הכותרת העליונה הדיפולטיבית
        tabBarActiveTintColor: '#0FEA95', // הירוק הספורטיבי שלנו
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
      {/* 1. מסך הבית - המפה שלנו */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'מפה',
          tabBarIcon: ({ color }) => <Ionicons name="map" size={26} color={color} />,
        }}
      />

      {/* 2. גילוי - רשימת מגרשים ואירועים */}
      <Tabs.Screen
        name="discover"
        options={{
          title: 'חיפוש',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={26} color={color} />,
        }}
      />

      {/* 3. המשחקים שלי */}
      <Tabs.Screen
        name="games"
        options={{
          title: 'המשחקים שלי',
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={26} color={color} />,
        }}
      />

      {/* 4. צ'אט */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'צ\'אט',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={26} color={color} />,
        }}
      />

      {/* 5. פרופיל אישי */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'פרופיל',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}