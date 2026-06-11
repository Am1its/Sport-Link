import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Alert, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { SPORT_COLORS, SPORT_ICONS, SPORT_FILTER_ITEMS } from '../constants/sports';

type Suggestion = {
  id: number;
  username: string;
  avatar: string | null;
  karma: number;
  top_sport: string | null;
  shared_count: number;
  shared_sports: string[];
  shared_game_count: number;
};

export default function PlayerMatchingScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [location, setLocation]       = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [pendingIds, setPendingIds]   = useState<Set<number>>(new Set());

  const fetchSuggestions = useCallback(async (loc: { lat: number; lng: number } | null, sport: string) => {
    setLoading(true);
    try {
      let url = '/api/users/suggestions';
      const params: string[] = [];
      if (loc)          params.push(`lat=${loc.lat}&lng=${loc.lng}`);
      if (sport !== 'all') params.push(`sport=${sport}`);
      if (params.length) url += '?' + params.join('&');

      const res  = await apiFetch(url, { token });
      const data = await res.json();
      if (data.success) setSuggestions(data.suggestions);
    } catch (err: any) {
      if (err?.name !== 'UnauthorizedError') console.error('Suggestions error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel('');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(loc);
      setLocationLabel('Near you');
      return loc;
    } catch {
      return null;
    }
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const loc = await requestLocation();
        await fetchSuggestions(loc, sportFilter);
      })();
    }, [])
  );

  const handleSportFilter = async (sport: string) => {
    setSportFilter(sport);
    await fetchSuggestions(location, sport);
  };

  const handleAddFriend = async (targetId: number) => {
    setPendingIds(prev => new Set(prev).add(targetId));
    try {
      const res  = await apiFetch('/api/friends', {
        method: 'POST',
        token,
        body: JSON.stringify({ addressee_id: targetId }),
      });
      const data = await res.json();
      if (!data.success) {
        setPendingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
        Alert.alert('Error', data.message);
      }
    } catch (err: any) {
      if (err?.name !== 'UnauthorizedError') {
        setPendingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
      }
    }
  };

  const renderCard = ({ item }: { item: Suggestion }) => {
    const color    = getAvatarColor(item.username);
    const isPending = pendingIds.has(item.id);
    const topColor  = item.top_sport ? (SPORT_COLORS[item.top_sport] ?? '#0FEA95') : '#0FEA95';
    const topIcon   = item.top_sport ? (SPORT_ICONS[item.top_sport]  ?? 'trophy')  : 'trophy';
    const karmaColor = item.karma > 0 ? '#0FEA95' : item.karma < 0 ? '#FF453A' : '#636366';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(item.id) } })}
      >
        {/* Avatar */}
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, { backgroundColor: color + '22', borderColor: color }]}>
            {item.avatar ? (
              <Image source={{ uri: `data:image/jpeg;base64,${item.avatar}` }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarLetter, { color }]}>{item.username.charAt(0).toUpperCase()}</Text>
            )}
            {/* Top sport badge */}
            {item.top_sport && (
              <View style={[styles.sportBadge, { backgroundColor: topColor }]}>
                <MaterialCommunityIcons name={topIcon as any} size={9} color="#1C1C1E" />
              </View>
            )}
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardMid}>
          <Text style={styles.username}>{item.username}</Text>
          <View style={styles.karmaRow}>
            <Ionicons name="flash" size={12} color={karmaColor} />
            <Text style={[styles.karmaText, { color: karmaColor }]}>
              {item.karma > 0 ? '+' : ''}{item.karma} karma
            </Text>
          </View>

          {/* Shared sports chips */}
          {item.shared_sports.length > 0 && (
            <View style={styles.chipsRow}>
              {item.shared_sports.slice(0, 3).map(s => {
                const c = SPORT_COLORS[s] ?? '#636366';
                const ic = SPORT_ICONS[s]  ?? 'trophy';
                return (
                  <View key={s} style={[styles.chip, { backgroundColor: c + '22', borderColor: c + '55' }]}>
                    <MaterialCommunityIcons name={ic as any} size={10} color={c} />
                    <Text style={[styles.chipText, { color: c }]}>{s}</Text>
                  </View>
                );
              })}
              {item.shared_sports.length > 3 && (
                <Text style={styles.moreChips}>+{item.shared_sports.length - 3}</Text>
              )}
            </View>
          )}

          {(item.shared_count > 0 || item.shared_game_count > 0) && (
            <View style={styles.metaRow}>
              {item.shared_count > 0 && (
                <Text style={styles.sharedLabel}>
                  {item.shared_count} sport{item.shared_count !== 1 ? 's' : ''} in common
                </Text>
              )}
              {item.shared_game_count > 0 && (
                <View style={styles.gamesPlayed}>
                  <Ionicons name="checkmark-circle" size={11} color="#0FEA95" />
                  <Text style={styles.gamesPlayedText}>
                    {item.shared_game_count} game{item.shared_game_count !== 1 ? 's' : ''} together
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Add Friend */}
        <TouchableOpacity
          style={[styles.addBtn, isPending && styles.addBtnPending]}
          onPress={() => !isPending && handleAddFriend(item.id)}
          disabled={isPending}
        >
          <Ionicons
            name={isPending ? 'time-outline' : 'person-add-outline'}
            size={15}
            color={isPending ? '#636366' : '#1C1C1E'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Discover Players</Text>
          <Text style={styles.subtitle}>
            {locationLabel ? `📍 ${locationLabel}  ·  ` : ''}
            Matched by sport
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: '#0FEA9522' }]}>
          <Ionicons name="people-outline" size={22} color="#0FEA95" />
        </View>
      </View>

      {/* Sport filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, sportFilter === 'all' && styles.filterChipActive]}
          onPress={() => handleSportFilter('all')}
        >
          <Text style={[styles.filterChipText, sportFilter === 'all' && styles.filterChipTextActive]}>
            All Sports
          </Text>
        </TouchableOpacity>
        {SPORT_FILTER_ITEMS.map(({ key, label }) => {
          const active = sportFilter === key;
          const c = SPORT_COLORS[key] ?? '#0FEA95';
          return (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, active && { backgroundColor: c + '22', borderColor: c }]}
              onPress={() => handleSportFilter(key)}
            >
              <MaterialCommunityIcons
                name={(SPORT_ICONS[key] ?? 'trophy') as any}
                size={13}
                color={active ? c : '#636366'}
              />
              <Text style={[styles.filterChipText, active && { color: c }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0FEA95" /></View>
      ) : suggestions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color="#3A3A3C" />
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySub}>
            Add sport preferences to get better suggestions, or try a different sport filter.
          </Text>
          <TouchableOpacity
            style={styles.prefsBtn}
            onPress={() => router.push('/sport-preferences' as any)}
          >
            <Text style={styles.prefsBtnText}>Set Sport Preferences</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={item => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {suggestions.length} player{suggestions.length !== 1 ? 's' : ''} found
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header:     { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  backBtn:    { marginRight: 12 },
  title:      { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  subtitle:   { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  filterStrip:   { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center', flexDirection: 'row' },
  filterChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C' },
  filterChipActive: { backgroundColor: '#0FEA9522', borderColor: '#0FEA95' },
  filterChipText:   { fontSize: 12, color: '#636366', fontWeight: '600' },
  filterChipTextActive: { color: '#0FEA95' },

  list:        { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 4 },
  resultCount: { fontSize: 12, color: '#48484A', fontStyle: 'italic', textAlign: 'center', marginVertical: 12 },

  card:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  cardLeft: {},
  cardMid: { flex: 1, gap: 4 },

  avatar:       { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, overflow: 'visible', justifyContent: 'center', alignItems: 'center' },
  avatarImg:    { width: 52, height: 52, borderRadius: 26 },
  avatarLetter: { fontSize: 20, fontWeight: '900' },
  sportBadge:   { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#1C1C1E' },

  username:   { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  karmaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  karmaText:  { fontSize: 12, fontWeight: '700' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },
  moreChips: { fontSize: 10, color: '#636366', alignSelf: 'center' },

  metaRow:        { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  sharedLabel:    { fontSize: 11, color: '#48484A', fontStyle: 'italic' },
  gamesPlayed:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gamesPlayedText: { fontSize: 11, color: '#0FEA95', fontWeight: '700' },

  addBtn:        { width: 38, height: 38, borderRadius: 12, backgroundColor: '#0FEA95', justifyContent: 'center', alignItems: 'center' },
  addBtnPending: { backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#3A3A3C' },

  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 20, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: '#636366', textAlign: 'center', lineHeight: 20 },
  prefsBtn:   { marginTop: 24, backgroundColor: '#0FEA95', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  prefsBtnText: { color: '#1C1C1E', fontWeight: '900', fontSize: 15 },
});
