import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch, UnauthorizedError } from '../utils/api';
import AvatarCircle from '../components/AvatarCircle';

type Friend = { friendship_id: number; id: number; username: string; avatar: string | null; karma: number };
type Request = { friendship_id: number; id: number; username: string; avatar: string | null };
type SearchUser = { id: number; username: string; avatar: string | null };

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [pendingSentIds, setPendingSentIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

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

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`, { token });
      const data = await res.json();
      if (data.success) setSearchResults(data.users);
    } catch {}
    finally { setSearching(false); }
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
  const karmaColor = (k: number) => k > 0 ? '#0FEA95' : k < 0 ? '#FF453A' : '#8E8E93';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Friends</Text>
        <View style={{ width: 40 }} />
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
          <ActivityIndicator size="large" color="#0FEA95" />
        </View>
      ) : (
        <>
          {/* ── Friends list ── */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="people-outline" size={70} color="#2C2C2E" />
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#0FEA95" />}
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
                      <Ionicons name="person-remove-outline" size={18} color="#FF453A" />
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
                <Ionicons name="mail-outline" size={70} color="#2C2C2E" />
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={item => String(item.friendship_id)}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#0FEA95" />}
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <AvatarCircle username={item.username} avatar={item.avatar} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName}>{item.username}</Text>
                      <Text style={styles.rowSub}>Wants to be your friend</Text>
                    </View>
                    <View style={styles.requestBtns}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(item.friendship_id)}>
                        <Ionicons name="checkmark" size={18} color="#1C1C1E" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => removeFriend(item.friendship_id, item.username)}>
                        <Ionicons name="close" size={18} color="#FF453A" />
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
                <Ionicons name="search" size={18} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by username..."
                  placeholderTextColor="#636366"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color="#0FEA95" />}
                {searchQuery.length > 0 && !searching && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color="#636366" />
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
                          <Ionicons name="person-add" size={16} color="#1C1C1E" />
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
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40 },
  title: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },

  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center' },
  tabActive: { backgroundColor: '#0FEA95' },
  tabText: { color: '#636366', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#1C1C1E' },

  list: { paddingHorizontal: 20, paddingBottom: 30 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  rowBody: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  rowKarma: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rowSub: { fontSize: 12, color: '#636366', marginTop: 2 },

  removeBtn: { padding: 8 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0FEA95', justifyContent: 'center', alignItems: 'center' },
  declineBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF453A22', borderWidth: 1, borderColor: '#FF453A55', justifyContent: 'center', alignItems: 'center' },

  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0FEA95', justifyContent: 'center', alignItems: 'center' },
  sentBadge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#3A3A3C', borderRadius: 10 },
  sentBadgeText: { color: '#8E8E93', fontSize: 12, fontWeight: '700' },

  searchContainer: { flex: 1, paddingTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 14, marginHorizontal: 20, paddingHorizontal: 14, height: 48, marginBottom: 12, gap: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },

  emptyText: { color: '#636366', fontSize: 16, marginTop: 14, fontWeight: '600' },
  emptySubtext: { color: '#48484A', fontSize: 13, marginTop: 6 },
  addFriendBtn: { marginTop: 20, backgroundColor: '#0FEA95', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  addFriendBtnText: { color: '#1C1C1E', fontWeight: '800', fontSize: 15 },
});
