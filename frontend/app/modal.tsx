import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { SPORT_COLORS } from '../constants/sports';
import { Colors, Spacing, Radius, Shadow, Type } from '../constants/theme';

type Friend = { friendship_id: number; id: number; username: string; avatar: string | null };

const SPORTS = [
  { key: 'basketball', icon: 'basketball',     label: 'Basketball' },
  { key: 'tennis',     icon: 'tennis',         label: 'Tennis' },
  { key: 'volleyball', icon: 'volleyball',     label: 'Volleyball' },
  { key: 'football',   icon: 'soccer',         label: 'Football' },
  { key: 'yoga',       icon: 'yoga',           label: 'Yoga' },
  { key: 'gym',        icon: 'dumbbell',       label: 'Gym' },
  { key: 'studio',     icon: 'dance-ballroom', label: 'Studio' },
  { key: 'footvolley', icon: 'handball',       label: 'Footvolley' },
  { key: 'swimming',   icon: 'swim',           label: 'Swimming' },
] as const;

const LEVEL_META = [
  { n: 1, label: 'Beginner',  color: '#4ADE80' },
  { n: 2, label: 'Casual',    color: '#A3E635' },
  { n: 3, label: 'Inter',     color: '#FACC15' },
  { n: 4, label: 'Advanced',  color: '#FB923C' },
  { n: 5, label: 'Pro',       color: '#F87171' },
];

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function GameFormModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();

  const isEdit = !!params.gameId;
  const gameId = params.gameId ? parseInt(params.gameId as string) : null;

  const [sport, setSport]             = useState((params.existingSport as string) || 'basketball');
  const [level, setLevel]             = useState(params.existingLevel ? parseInt(params.existingLevel as string) : 3);
  const [locationDesc, setLocationDesc] = useState((params.existingLocationDesc as string) || '');
  const [equipment, setEquipment]     = useState((params.existingEquipment as string) || '');
  const [maxPlayers, setMaxPlayers]   = useState((params.existingMaxPlayers as string) || '');
  const [title, setTitle]             = useState((params.existingTitle as string) || '');
  const [photo, setPhoto]             = useState<string | null>((params.existingPhoto as string) || null);
  const [loading, setLoading]         = useState(false);

  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly'>('none');

  const [friends, setFriends]                 = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isEdit) return;
    apiFetch('/api/friends', { token })
      .then(r => r.json())
      .then(d => { if (d.success) setFriends(d.friends); })
      .catch(() => {});
  }, [isEdit]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow photo access to add a game photo.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
  };

  const parseInitialDate = (): Date | null => {
    if (!params.existingTime) return null;
    const d = new Date(params.existingTime as string);
    return isNaN(d.getTime()) ? null : d;
  };
  const [scheduledDate, setScheduledDate] = useState<Date | null>(parseInitialDate);
  const [pickerMode, setPickerMode]       = useState<'date' | 'time' | null>(null);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateLabel = scheduledDate
    ? scheduledDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Pick date';
  const timeLabel = scheduledDate
    ? `${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}`
    : 'Pick time';
  const scheduledTimeStr = scheduledDate
    ? `${scheduledDate.getFullYear()}-${pad(scheduledDate.getMonth() + 1)}-${pad(scheduledDate.getDate())} ${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}`
    : null;

  const toggleFriend = (id: number) => {
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!token) return Alert.alert('Error', 'You must be logged in');
    if (scheduledDate && scheduledDate <= new Date())
      return Alert.alert('Invalid Time', 'Scheduled time must be in the future');
    if (maxPlayers && parseInt(maxPlayers) < 2)
      return Alert.alert('Invalid Players', 'Max players must be at least 2');

    setLoading(true);
    try {
      const method = isEdit ? 'PUT' : 'POST';
      const body: Record<string, any> = {
        sport_type:      sport,
        level,
        title:           title.trim() || null,
        location_desc:   locationDesc  || null,
        scheduled_time:  scheduledTimeStr,
        equipment_notes: equipment     || null,
        max_players:     maxPlayers    ? parseInt(maxPlayers) : null,
        photo:           photo         || null,
      };
      if (!isEdit) {
        body.latitude   = parseFloat(params.lat as string);
        body.longitude  = parseFloat(params.lng as string);
        body.recurrence = recurrence;
        if (selectedFriendIds.size > 0) body.invited_friends = Array.from(selectedFriendIds);
      }

      const res  = await apiFetch(isEdit ? `/api/games/${gameId}` : '/api/games', { method, token, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      router.back();
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const sportColor = SPORT_COLORS[sport] ?? Colors.accent;
  const selectedSport = SPORTS.find(s => s.key === sport)!;
  const selectedLevel = LEVEL_META[level - 1];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.textSub} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Game' : 'New Game'}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Sport hero banner ── */}
        <View style={[styles.heroBanner, { backgroundColor: sportColor + '18', borderColor: sportColor + '40' }]}>
          <View style={[styles.heroIconRing, { backgroundColor: sportColor + '22', borderColor: sportColor + '55' }]}>
            <MaterialCommunityIcons name={selectedSport.icon as any} size={32} color={sportColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroSportName, { color: sportColor }]}>{selectedSport.label.toUpperCase()}</Text>
            <Text style={styles.heroSportSub}>Level {level} · {selectedLevel.label}</Text>
          </View>
          {scheduledDate && (
            <View style={styles.heroBadge}>
              <Ionicons name="calendar" size={12} color={sportColor} />
              <Text style={[styles.heroBadgeText, { color: sportColor }]}>
                {scheduledDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Sport picker ── */}
        <SectionLabel>What sport?</SectionLabel>
        <View style={styles.sportsGrid}>
          {SPORTS.map(s => {
            const c = SPORT_COLORS[s.key] ?? Colors.accent;
            const active = sport === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.sportTile,
                  active
                    ? { backgroundColor: c + '22', borderColor: c, borderWidth: 2 }
                    : { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1.5 },
                ]}
                onPress={() => setSport(s.key)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name={s.icon as any} size={26} color={active ? c : Colors.textMuted} />
                <Text style={[styles.sportTileLabel, active && { color: c }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Skill level ── */}
        <SectionLabel>Skill Level</SectionLabel>
        <View style={styles.levelRow}>
          {LEVEL_META.map(lv => {
            const active = level === lv.n;
            return (
              <TouchableOpacity
                key={lv.n}
                style={[
                  styles.levelChip,
                  active
                    ? { backgroundColor: lv.color + '22', borderColor: lv.color, borderWidth: 2 }
                    : { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1.5 },
                ]}
                onPress={() => setLevel(lv.n)}
                activeOpacity={0.75}
              >
                <Text style={[styles.levelNum, active && { color: lv.color }]}>{lv.n}</Text>
                <Text style={[styles.levelLabel, active && { color: lv.color }]}>{lv.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Title ── */}
        <SectionLabel>Title (optional)</SectionLabel>
        <View style={styles.inputRow}>
          <Ionicons name="trophy-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.inputField}
            placeholder="e.g. Friday night pickup"
            placeholderTextColor={Colors.textHint}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* ── Location ── */}
        <SectionLabel>Location Notes</SectionLabel>
        <View style={styles.inputRow}>
          <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.inputField}
            placeholder="e.g. North court, building entrance"
            placeholderTextColor={Colors.textHint}
            value={locationDesc}
            onChangeText={setLocationDesc}
          />
        </View>

        {/* ── Date & Time ── */}
        <SectionLabel>When does it start?</SectionLabel>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={[styles.dateBtn, scheduledDate != null && { borderColor: sportColor, backgroundColor: sportColor + '10' }]}
            onPress={() => setPickerMode('date')}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={18} color={scheduledDate ? sportColor : Colors.textMuted} />
            <Text style={[styles.dateBtnText, scheduledDate != null && { color: Colors.text, fontWeight: '700' }]}>
              {dateLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateBtn, styles.dateBtnTime, scheduledDate != null && { borderColor: sportColor, backgroundColor: sportColor + '10' }]}
            onPress={() => setPickerMode('time')}
            activeOpacity={0.75}
          >
            <Ionicons name="time-outline" size={18} color={scheduledDate ? sportColor : Colors.textMuted} />
            <Text style={[styles.dateBtnText, scheduledDate != null && { color: Colors.text, fontWeight: '700' }]}>
              {timeLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {pickerMode != null && (
          <DateTimePicker
            value={scheduledDate ?? new Date(Date.now() + 3_600_000)}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
            themeVariant="dark"
            onChange={(_, selected) => {
              if (Platform.OS === 'android') setPickerMode(null);
              if (!selected) return;
              setScheduledDate(prev => {
                const base = new Date(prev ?? Date.now() + 3_600_000);
                if (pickerMode === 'date') base.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                else base.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                return base;
              });
            }}
          />
        )}
        {pickerMode != null && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.pickerDone} onPress={() => setPickerMode(null)}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        )}

        {/* ── Max Players ── */}
        <SectionLabel>Max Players</SectionLabel>
        <View style={styles.inputRow}>
          <Ionicons name="people-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.inputField}
            placeholder="e.g. 10"
            placeholderTextColor={Colors.textHint}
            value={maxPlayers}
            onChangeText={setMaxPlayers}
            keyboardType="number-pad"
          />
        </View>

        {/* ── Equipment ── */}
        <SectionLabel>Equipment Notes (optional)</SectionLabel>
        <View style={styles.inputRow}>
          <Ionicons name="bag-add-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.inputField}
            placeholder="e.g. Who's bringing the ball?"
            placeholderTextColor={Colors.textHint}
            value={equipment}
            onChangeText={setEquipment}
          />
        </View>

        {/* ── Photo ── */}
        <SectionLabel>Game Photo (optional)</SectionLabel>
        {photo ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photoPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)}>
              <Ionicons name="close-circle" size={28} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} activeOpacity={0.75}>
            <View style={styles.photoPickerIcon}>
              <Ionicons name="camera-outline" size={22} color={Colors.textMuted} />
            </View>
            <Text style={styles.photoPickerText}>Add a court or action photo</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
          </TouchableOpacity>
        )}

        {/* ── Invite Friends ── */}
        {!isEdit && friends.length > 0 && (
          <>
            <SectionLabel>Invite Friends</SectionLabel>
            <View style={styles.friendsRow}>
              {friends.map(f => {
                const selected = selectedFriendIds.has(f.id);
                const c = getAvatarColor(f.username);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.friendChip, selected && { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint }]}
                    onPress={() => toggleFriend(f.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.friendAvatar, { backgroundColor: c + '22', borderColor: c }]}>
                      {f.avatar
                        ? <Image source={{ uri: `data:image/jpeg;base64,${f.avatar}` }} style={styles.friendAvatarImg} />
                        : <Text style={[styles.friendAvatarLetter, { color: c }]}>{f.username.charAt(0).toUpperCase()}</Text>}
                    </View>
                    <Text style={[styles.friendName, selected && { color: Colors.accent }]} numberOfLines={1}>{f.username}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedFriendIds.size > 0 && (
              <View style={styles.inviteNote}>
                <Ionicons name="people" size={14} color={Colors.accent} />
                <Text style={styles.inviteNoteText}>
                  {selectedFriendIds.size} friend{selectedFriendIds.size > 1 ? 's' : ''} will be added automatically
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Recurrence (new games only) ── */}
        {!isEdit && (
          <>
            <SectionLabel>Repeat</SectionLabel>
            <View style={styles.recurrenceRow}>
              {(['none', 'weekly', 'biweekly'] as const).map(opt => {
                const labels = { none: 'One-time', weekly: 'Weekly', biweekly: 'Bi-weekly' };
                const active = recurrence === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.recurrenceChip, active && { backgroundColor: sportColor + '22', borderColor: sportColor, borderWidth: 2 }]}
                    onPress={() => setRecurrence(opt)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.recurrenceText, active && { color: sportColor, fontWeight: '800' }]}>{labels[opt]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {recurrence !== 'none' && (
              <View style={styles.recurrenceNote}>
                <Ionicons name="repeat-outline" size={14} color={Colors.accent} />
                <Text style={styles.recurrenceNoteText}>
                  A new game will be scheduled automatically after each session.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.75 }, { shadowColor: sportColor }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.bg} size="small" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>{isEdit ? 'Save Changes' : 'Post on Map'}</Text>
              <Ionicons name="arrow-forward-circle" size={22} color={Colors.bg} />
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll:    { padding: Spacing.xl, paddingBottom: 60 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl, marginTop: Spacing.sm },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.text },

  // Hero banner
  heroBanner:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.md, marginBottom: Spacing.xxl, overflow: 'hidden' },
  heroIconRing:{ width: 56, height: 56, borderRadius: Radius.lg, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  heroSportName: { fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  heroSportSub:  { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  heroBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  heroBadgeText: { fontSize: 11, fontWeight: '700' },

  // Section label
  sectionLabel: { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: 2 },

  // Sport grid — 3 columns
  sportsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  sportTile:   { width: '30.5%', aspectRatio: 1, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', gap: 6 },
  sportTileLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },

  // Level chips
  levelRow:   { flexDirection: 'row', gap: 6, marginBottom: Spacing.xl },
  levelChip:  { flex: 1, height: 58, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', gap: 3 },
  levelNum:   { fontSize: 16, fontWeight: '900', color: Colors.textMuted },
  levelLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Inputs
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 52, borderWidth: 1.5, borderColor: Colors.border, marginBottom: Spacing.lg },
  inputField: { flex: 1, color: Colors.text, fontSize: 15 },

  // Date / Time
  dateTimeRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  dateBtn:      { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 52, borderWidth: 1.5, borderColor: Colors.border },
  dateBtnTime:  { flex: 1 },
  dateBtnText:  { flex: 1, color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  pickerDone:   { alignSelf: 'flex-end', marginBottom: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: 9, backgroundColor: Colors.accent, borderRadius: Radius.pill },
  pickerDoneText: { color: Colors.bg, fontWeight: '800', fontSize: 14 },

  // Photo
  photoPicker:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, height: 56, paddingHorizontal: Spacing.md, marginBottom: Spacing.xl, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  photoPickerIcon:{ width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.surface2, justifyContent: 'center', alignItems: 'center' },
  photoPickerText:{ flex: 1, color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  photoWrap:      { position: 'relative', marginBottom: Spacing.xl },
  photoPreview:   { width: '100%', height: 185, borderRadius: Radius.lg },
  photoRemove:    { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.bg, borderRadius: 14 },

  // Friends
  friendsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  friendChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1.5, borderColor: Colors.border, maxWidth: 160 },
  friendAvatar:      { width: 26, height: 26, borderRadius: 13, borderWidth: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  friendAvatarImg:   { width: '100%', height: '100%' },
  friendAvatarLetter:{ fontSize: 12, fontWeight: '900' },
  friendName:   { color: Colors.textSub, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  inviteNote:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl },
  inviteNoteText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  recurrenceRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  recurrenceChip: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  recurrenceText: { fontSize: 13, fontWeight: '600', color: Colors.textSub },
  recurrenceNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: Spacing.xl },
  recurrenceNoteText: { flex: 1, color: Colors.accent, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, height: 56, borderRadius: Radius.pill, marginTop: Spacing.md,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnText: { color: Colors.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
});
