import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SETTINGS = [
  {
    key: 'game_reminders',
    label: 'Game Reminders',
    desc: 'Reminded 1 hour before your game starts',
    icon: 'alarm-outline' as const,
    color: '#0FEA95',
  },
  {
    key: 'join_notifications',
    label: 'New Players Join',
    desc: 'When someone joins a game you host',
    icon: 'person-add-outline' as const,
    color: '#4F9EFF',
  },
  {
    key: 'chat_messages',
    label: 'Chat Messages',
    desc: 'New messages in your game chats',
    icon: 'chatbubble-outline' as const,
    color: '#FF8C00',
  },
  {
    key: 'rating_received',
    label: 'Ratings Received',
    desc: 'When teammates rate your performance',
    icon: 'star-outline' as const,
    color: '#FFD700',
  },
];

const NOTIF_KEY = 'notification_settings';

type Settings = Record<string, boolean>;

const defaultSettings: Settings = {
  game_reminders: true,
  join_notifications: true,
  chat_messages: true,
  rating_received: true,
};

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      if (raw) setSettings(JSON.parse(raw));
    });
  }, []);

  const toggle = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>Notification Types</Text>
        <View style={styles.card}>
          {SETTINGS.map((s, idx) => (
            <View key={s.key} style={[styles.row, idx < SETTINGS.length - 1 && styles.rowBorder]}>
              <View style={[styles.iconWrap, { backgroundColor: s.color + '22' }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{s.label}</Text>
                <Text style={styles.rowDesc}>{s.desc}</Text>
              </View>
              <Switch
                value={!!settings[s.key]}
                onValueChange={() => toggle(s.key)}
                trackColor={{ false: '#3A3A3C', true: '#0FEA9560' }}
                thumbColor={settings[s.key] ? '#0FEA95' : '#8E8E93'}
              />
            </View>
          ))}
        </View>

        <Text style={styles.hint}>
          Push notifications require the app to be installed via Expo Go or a native build.
        </Text>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save Settings'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { width: 40 },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#FFFFFF' },

  content: { paddingHorizontal: 20, paddingBottom: 50 },

  sectionLabel: { fontSize: 12, color: '#636366', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 24 },

  card: { backgroundColor: '#2C2C2E', borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  rowDesc: { fontSize: 12, color: '#636366' },

  hint: { marginTop: 16, color: '#48484A', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  saveBtn: { marginTop: 32, backgroundColor: '#0FEA95', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#1C1C1E', fontSize: 16, fontWeight: '900' },
});
