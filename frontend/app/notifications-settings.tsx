import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type } from '../constants/theme';
import { useSound } from '../context/SoundContext';

const SETTINGS = [
  {
    key: 'game_reminders',
    label: 'Game Reminders',
    desc: 'Reminded 1 hour before your game starts',
    icon: 'alarm-outline' as const,
    color: Colors.accent,
  },
  {
    key: 'join_notifications',
    label: 'New Players Join',
    desc: 'When someone joins a game you host',
    icon: 'person-add-outline' as const,
    color: Colors.blue,
  },
  {
    key: 'chat_messages',
    label: 'Chat Messages',
    desc: 'New messages in your game chats',
    icon: 'chatbubble-outline' as const,
    color: Colors.orange,
  },
  {
    key: 'rating_received',
    label: 'Ratings Received',
    desc: 'When teammates rate your performance',
    icon: 'star-outline' as const,
    color: Colors.yellow,
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
  const { soundsEnabled, setSoundsEnabled } = useSound();

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
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
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
                trackColor={{ false: Colors.surface2, true: Colors.accentBorder }}
                thumbColor={settings[s.key] ? Colors.accent : Colors.textMuted}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.purple + '22' }]}>
              <Ionicons name="volume-high-outline" size={20} color={Colors.purple} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Sound Effects</Text>
              <Text style={styles.rowDesc}>Chimes and taps throughout the app</Text>
            </View>
            <Switch
              value={soundsEnabled}
              onValueChange={setSoundsEnabled}
              trackColor={{ false: Colors.surface2, true: Colors.accentBorder }}
              thumbColor={soundsEnabled ? Colors.accent : Colors.textMuted}
            />
          </View>
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
  container: { flex: 1, backgroundColor: Colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
  backBtn: { width: 40 },
  title: { flex: 1, textAlign: 'center', ...Type.cardTitle, fontSize: 20 },

  content: { paddingHorizontal: Spacing.xl, paddingBottom: 50 },

  sectionLabel: { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: Spacing.xxl },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  rowDesc: { ...Type.meta, color: Colors.textMuted },

  hint: { marginTop: Spacing.lg, color: Colors.textHint, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  saveBtn: { marginTop: Spacing.xxxl, backgroundColor: Colors.accent, height: 54, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: Colors.bg, ...Type.btnPrimary },
});
