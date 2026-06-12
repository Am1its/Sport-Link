import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Alert, RefreshControl, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import AvatarCircle from '../components/AvatarCircle';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';
import { BackButton } from '../components/BackButton';
import { API_BASE } from '../constants/api';

type Friend = { friendship_id: number; id: number; username: string; avatar: string | null; karma: number };
type Request = { friendship_id: number; id: number; username: string; avatar: string | null };
type SearchUser = { id: number; username: string; avatar: string | null };

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [pendingSentIds, setPendingSentIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [fRes, rRes] = await Promise.all([
        apiFetch('/api/friends', { token }),
        apiFetch('/api/friends/requests', { token }),
      ]);
      const [fData, rData] = await Promise.all([fRes.json(), rRes.json()]);
      if (fData.success) setFriends(fData.friends);
      if (rData.success) setRequests(rData.requests);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      console.error('Friends fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (q.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`, { token });
        const data = await res.json();
        if (data.success) setSearchResults(data.users);
      } catch (err) {
        if (err instanceof UnauthorizedError) return;
        console.warn('User search error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [token]);

  const sendRequest = async (addresseeId: number) => {
    try {
      const res = await apiFetch('/api/friends', {
        method: 'POST',
        token,
        body: JSON.stringify({ addressee_id: addresseeId }),
      });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      setPendingSentIds(prev => new Set([...prev, addresseeId]));
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const acceptRequest = async (friendshipId: number) => {
    try {
      const res = await apiFetch(`/api/friends/${friendshipId}/accept`, { method: 'PUT', token });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      await fetchAll(true);
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const removeFriend = (friendshipId: number, name: string) => {
    Alert.alert('Remove Friend', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/friends/${friendshipId}`, { method: 'DELETE', token });
            fetchAll(true);
          } catch {
            Alert.alert('Error', 'Could not connect to server');
          }
        },
      },
    ]);
  };

  const isFriendOrPending = (userId: number) =>
    pendingSentIds.has(userId) ||
    friends.some(f => f.id === userId) ||
    requests.some(r => r.id === userId);

  const karmaStr = (k: number) => k > 0 ? `+${k}` : `${k}`;
  const karmaColor = (k: number) => k > 0 ? Colors.accent : k < 0 ? Colors.error : Colors.textMuted;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => {
            if (!user?.id) return;
            const url = `${API_BASE}/invite/${user.id}`;
            Share.share({ title: 'Join me on SportLink!', message: `Join me on SportLink! ${url}`, url });
          }}
        >
          <Ionicons name="share-outline" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['friends', 'requests', 'search'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'friends' ? 'Friends' : t === 'requests' ? `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` : 'Add Friends'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <>
          {/* ── Friends list ── */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="people-outline" size={70} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No friends yet</Text>
                <Text style={styles.emptySubtext}>Search for players to add them</Text>
                <TouchableOpacity style={styles.addFriendBtn} onPress={() => setActiveTab('search')}>
                  <Text style={styles.addFriendBtnText}>Find Players</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={item => String(item.friendship_id)}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={Colors.accent} />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/player-profile' as any, params: { userId: String(item.id) } })}
                    activeOpacity={0.75}
                  >
                    <AvatarCircle username={item.username} avatar={item.avatar} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName}>{item.username}</Text>
                      <Text style={[styles.rowKarma, { color: karmaColor(item.karma) }]}>
                        ⚡ {karmaStr(item.karma)} karma
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeFriend(item.friendship_id, item.username)}>
                      <Ionicons name="person-remove-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )
          )}

          {/* ── Incoming requests ── */}
          {activeTab === 'requests' && (
            requests.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="mail-outline" size={70} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={item => String(item.friendship_id)}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={Colors.accent} />}
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <AvatarCircle username={item.username} avatar={item.avatar} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName}>{item.username}</Text>
                      <Text style={styles.rowSub}>Wants to be your friend</Text>
                    </View>
                    <View style={styles.requestBtns}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(item.friendship_id)}>
                        <Ionicons name="checkmark" size={18} color={Colors.bg} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => removeFriend(item.friendship_id, item.username)}>
                        <Ionicons name="close" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )
          )}

          {/* ── Search / Add ── */}
          {activeTab === 'search' && (
            <View style={styles.searchContainer}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textSub} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by username..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={Colors.accent} />}
                {searchQuery.length > 0 && !searching && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                <View style={styles.center}>
                  <Text style={styles.emptyText}>No users found</Text>
                </View>
              )}

              <FlatList
                data={searchResults}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const alreadyConnected = isFriendOrPending(item.id);
                  return (
                    <View style={styles.row}>
                      <AvatarCircle username={item.username} avatar={item.avatar} />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName}>{item.username}</Text>
                      </View>
                      {alreadyConnected ? (
                        <View style={styles.sentBadge}>
                          <Text style={styles.sentBadgeText}>
                            {friends.some(f => f.id === item.id) ? 'Friends' : 'Sent'}
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(item.id)}>
                          <Ionicons name="person-add" size={16} color={Colors.bg} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  inviteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentFaint, borderWidth: 1, borderColor: Colors.accentBorder, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: 9, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: Colors.bg },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 30 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, marginBottom: 8, ...Shadow.card },
  rowBody: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowKarma: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  removeBtn: { padding: 8 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  declineBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.errorFaint, borderWidth: 1, borderColor: Colors.errorBorder, justifyContent: 'center', alignItems: 'center' },

  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  sentBadge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surface2, borderRadius: Radius.md },
  sentBadgeText: { color: Colors.textSub, fontSize: 12, fontWeight: '700' },

  searchContainer: { flex: 1, paddingTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, marginHorizontal: Spacing.xl, paddingHorizontal: 14, height: 48, marginBottom: 12, gap: 10, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },

  emptyText: { color: Colors.textMuted, fontSize: 16, marginTop: 14, fontWeight: '600' },
  emptySubtext: { color: Colors.textHint, fontSize: 13, marginTop: 6 },
  addFriendBtn: { marginTop: 20, backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill },
  addFriendBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 15 },
});
