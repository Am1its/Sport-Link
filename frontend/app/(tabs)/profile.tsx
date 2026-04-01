import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  // נתונים פיקטיביים לעיצוב (עד שנחבר למסד נתונים)
  const userProfile = {
    name: "עמית עובד",
    level: 4,
    karma: 98, // אחוז אמינות
    gamesPlayed: 12,
    favoriteSport: "Basketball"
  };

  const handleLogout = () => {
    // מנתק את המשתמש ומחזיר למסך התחברות
    router.replace('/login');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={100} color="#0FEA95" />
        </View>
        <Text style={styles.name}>{userProfile.name}</Text>
        <Text style={styles.bio}>חי ונושם מגרשים 🏀</Text>
      </View>

      {/* שורת סטטיסטיקות */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{userProfile.gamesPlayed}</Text>
          <Text style={styles.statLabel}>משחקים</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxBorder]}>
          <Text style={[styles.statNumber, { color: '#0FEA95' }]}>{userProfile.karma}%</Text>
          <Text style={styles.statLabel}>אמינות (Karma)</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>Lv.{userProfile.level}</Text>
          <Text style={styles.statLabel}>רמה</Text>
        </View>
      </View>

      {/* תפריט אפשרויות */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
            <Text style={styles.menuText}>הגדרות חשבון</Text>
          </View>
          <Ionicons name="chevron-back" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="whistle" size={24} color="#FFFFFF" />
            <Text style={styles.menuText}>העדפות ספורט</Text>
          </View>
          <Ionicons name="chevron-back" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
            <Text style={styles.menuText}>התראות (רדאר מחליפים)</Text>
          </View>
          <Ionicons name="chevron-back" size={20} color="#8E8E93" />
        </TouchableOpacity>

        {/* כפתור התנתקות */}
        <TouchableOpacity style={[styles.menuItem, { marginTop: 20 }]} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out-outline" size={24} color="#FF453A" />
            <Text style={[styles.menuText, { color: '#FF453A' }]}>התנתק</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { alignItems: 'center', marginTop: 60, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  avatarContainer: { backgroundColor: '#2C2C2E', borderRadius: 50, marginBottom: 15 },
  name: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  bio: { fontSize: 16, color: '#8E8E93', marginTop: 5 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, backgroundColor: '#2C2C2E', marginHorizontal: 20, borderRadius: 20, marginTop: 20 },
  statBox: { alignItems: 'center', flex: 1 },
  statBoxBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#3A3A3C' },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 5 },
  statLabel: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold' },
  menuContainer: { marginTop: 30, paddingHorizontal: 20 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2C2C2E', padding: 18, borderRadius: 15, marginBottom: 12 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: { color: '#FFFFFF', fontSize: 16, marginLeft: 15, fontWeight: '600' }
});