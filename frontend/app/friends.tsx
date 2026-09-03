import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { API } from '../constants/endpoints';
import { ROUTES } from '../constants/routes';
import { API_BASE } from '../constants/api';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, withSequence,
} from 'react-native-reanimated';
import { useSound } from '../context/SoundContext';
import { Springs } from '../constants/motion';
import * as Haptics from 'expo-haptics';

type Friend = { friendship_id: number; id: number; username: string; avatar: string | null; karma: number };
type Request = { friendship_id: number; id: number; username: string; avatar: string | null };
type SearchUser = { id: number; username: string; avatar: string | null };

type Tab = 'friends' | 'requests' | 'search';

// ── StaggeredCard: stagger-in entrance animation ─────────────────────────────
function StaggeredCard({ index, children }: { index: number; children: React.ReactNode }) {
  const translateY = useSharedValue(16);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    const delay = Math.min(index * 50, 400);
    translateY.value = withDelay(delay, withSpring(0, Springs.bouncy));
    opacity.value    = withDelay(delay, withTiming(1, { duration: 200 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <ReAnimated.View style={style}>{children}</ReAnimated.View>;
}

// ── RequestCard: accept flash overlay + sound + haptic ───────────────────────
function RequestCard({
  request,
  index,
  onAccept,
  onDecline,
}: {
  request: Request;
  index: number;
  onAccept: (friendshipId: number) => void;
  onDecline: (friendshipId: number, username: string) => void;
}) {
  const flashOpacity = useSharedValue(0);
  const flashStyle   = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  const handleAccept = () => {
    // Flash fires immediately on press
    flashOpacity.value = withSequence(
      withTiming(0.4, { duration: 100 }),
      withTiming(0, { duration: 300 }),
    );
    onAccept(request.friendship_id);
  };

  return (
    <StaggeredCard index={index}>
      <View style={{ position: 'relative' }}>
        <View style={styles.row}>
          <AvatarCircle username={request.username} avatar={request.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>{request.username}</Text>
            <Text style={styles.rowSub}>Wants to be your friend</Text>
          </View>
          <View style={styles.requestBtns}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
              <Ionicons name="checkmark" size={18} color={Colors.bg} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => onDecline(request.friendship_id, request.username)}
            >
              <Ionicons name="close" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        <ReAnimated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: Colors.accent,
              borderRadius: Radius.lg,
            },
            flashStyle,
          ]}
        />
      </View>
    </StaggeredCard>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { play } = useSound();

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
        apiFetch(API.FRIENDS, { token }),
        apiFetch(API.FRIEND_REQUESTS, { token }),
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
        const res = await apiFetch(`${API.USERS_SEARCH}?q=${encodeURIComponent(q.trim())}`, { token });
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
      const res = await apiFetch(API.FRIENDS, {
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
      const res = await apiFetch(API.friendAccept(friendshipId), { method: 'PUT', token });
      const data = await res.json();
      if (!data.success) return Alert.alert('Error', data.message);
      // Sound + haptic fire on API success
      play('chime');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            await apiFetch(API.friend(friendshipId), { method: 'DELETE', token });
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
                renderItem={({ item, index }) => (
                  <StaggeredCard index={index}>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => router.push({ pathname: ROUTES.PLAYER_PROFILE as any, params: { userId: String(item.id) } })}
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
                  </StaggeredCard>
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
                renderItem={({ item, index }) => (
                  <RequestCard
                    request={item}
                    index={index}
                    onAccept={acceptRequest}
                    onDecline={removeFriend}
                  />
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
                renderItem={({ item, index }) => {
                  const alreadyConnected = isFriendOrPending(item.id);
                  return (
                    <StaggeredCard index={index}>
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
                    </StaggeredCard>
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
  emptySubtext: { color: Colors.textSub, fontSize: 13, marginTop: 6 },
  addFriendBtn: { marginTop: 20, backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill },
  addFriendBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 15 },
});
