import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Image, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { getAvatarColor } from '../utils/avatar';
import { API_BASE } from '../constants/api';
import AvatarCircle from '../components/AvatarCircle';
import { SPORT_COLORS, SPORT_ICONS } from '../constants/sports';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';

type PlacesData = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  open_now: boolean | null;
  weekday_hours: string[];
  photo_refs: string[];
};

type Review = {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  rating: number;
  comment: string | null;
  owner_response: string | null;
  owner_response_at: string | null;
  created_at: string;
};

type ClaimedBy = { id: number; username: string; avatar: string | null } | null;
type Announcement = { id: number; message: string; created_at: string; username: string };

function StarRow({ rating, size = 16, color = Colors.yellow, onPress }: {
  rating: number; size?: number; color?: string; onPress?: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onPress?.(n)} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
          <Ionicons
            name={n <= rating ? 'star' : 'star-outline'}
            size={size}
            color={n <= rating ? color : Colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewCard({ review, userId, isManager, placeId, token, onDelete, onRefresh }: {
  review: Review; userId: number; isManager: boolean;
  placeId: string; token: string | null;
  onDelete: (id: number) => void; onRefresh: () => void;
}) {
  const color = getAvatarColor(review.username);
  const isOwn = review.user_id === userId;
  const date = new Date(review.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState(review.owner_response ?? '');
  const [savingReply, setSavingReply] = useState(false);

  const handleSaveReply = async () => {
    if (!replyText.trim()) return;
    setSavingReply(true);
    try {
      await apiFetch(`/api/courts/${placeId}/reviews/${review.id}/response`, {
        method: 'PUT', token,
        body: JSON.stringify({ response: replyText.trim() }),
      });
      setReplyMode(false);
      onRefresh();
    } catch {}
    setSavingReply(false);
  };

  const handleDeleteReply = async () => {
    try {
      await apiFetch(`/api/courts/${placeId}/reviews/${review.id}/response`, { method: 'DELETE', token });
      setReplyText('');
      onRefresh();
    } catch {}
  };

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewAvatar, { backgroundColor: color + '22', borderColor: color }]}>
          {review.avatar ? (
            <Image source={{ uri: `data:image/jpeg;base64,${review.avatar}` }} style={styles.reviewAvatarImg} />
          ) : (
            <Text style={[styles.reviewAvatarLetter, { color }]}>{review.username.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewUsername}>{review.username}</Text>
          <Text style={styles.reviewDate}>{date}</Text>
        </View>
        <StarRow rating={review.rating} size={13} />
        {isOwn && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => Alert.alert('Delete Review', 'Remove your review?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(review.id) },
            ])}
          >
            <Ionicons name="trash-outline" size={15} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}

      {/* Owner response */}
      {review.owner_response && !replyMode && (
        <View style={styles.ownerResponse}>
          <View style={styles.ownerResponseHeader}>
            <Ionicons name="shield-checkmark" size={13} color={Colors.accent} />
            <Text style={styles.ownerResponseLabel}>Manager Response</Text>
            {isManager && (
              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
                <TouchableOpacity onPress={() => { setReplyText(review.owner_response ?? ''); setReplyMode(true); }}>
                  <Ionicons name="pencil-outline" size={13} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteReply}>
                  <Ionicons name="trash-outline" size={13} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={styles.ownerResponseText}>{review.owner_response}</Text>
        </View>
      )}

      {/* Reply input for manager */}
      {isManager && !review.owner_response && !replyMode && (
        <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyMode(true)}>
          <Ionicons name="chatbubble-outline" size={13} color={Colors.accent} />
          <Text style={styles.replyBtnText}>Reply as Manager</Text>
        </TouchableOpacity>
      )}
      {replyMode && (
        <View style={styles.replyInputRow}>
          <TextInput
            style={styles.replyInput}
            placeholder="Write a response…"
            placeholderTextColor={Colors.textHint}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={styles.replyCancel} onPress={() => setReplyMode(false)}>
              <Text style={styles.replyCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.replySave} onPress={handleSaveReply} disabled={savingReply}>
              {savingReply
                ? <ActivityIndicator size="small" color={Colors.bg} />
                : <Text style={styles.replySaveText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function CourtDetailScreen() {
  const router = useRouter();
  const { placeId, name: paramName, sport, vicinity } = useLocalSearchParams<{
    placeId: string; name?: string; sport?: string; vicinity?: string;
  }>();
  const { token, user } = useAuth();

  const [placesData, setPlacesData] = useState<PlacesData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [claimedBy, setClaimedBy] = useState<ClaimedBy>(null);
  const [isManager, setIsManager] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annInput, setAnnInput] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  const sportColor = sport && SPORT_COLORS[sport] ? SPORT_COLORS[sport] : Colors.accent;
  const sportIcon  = sport && SPORT_ICONS[sport]  ? SPORT_ICONS[sport]  : 'trophy';

  const myReview = reviews.find(r => r.user_id === user?.id);

  useEffect(() => {
    if (myReview) {
      setMyRating(myReview.rating);
      setMyComment(myReview.comment ?? '');
    }
  }, [myReview?.id]);

  const load = async () => {
    try {
      const res = await apiFetch(`/api/courts/${placeId}`, { token });
      const data = await res.json();
      if (data.success) {
        setPlacesData(data.places);
        setReviews(data.reviews);
        setReviewCount(data.review_count);
        setAvgRating(data.avg_rating);
        setClaimedBy(data.claimed_by ?? null);
        setIsManager(data.is_manager ?? false);
        setAnnouncements(data.announcements ?? []);
      }
    } catch (err: any) {
      if (err?.name === 'UnauthorizedError') return;
      console.error('Court detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [placeId]);

  const handleSubmitReview = async () => {
    if (myRating === 0) return Alert.alert('Rating required', 'Please select a star rating.');
    setSubmitting(true);
    try {
      await apiFetch(`/api/courts/${placeId}/reviews`, {
        method: 'POST',
        token,
        body: JSON.stringify({ rating: myRating, comment: myComment.trim() || null }),
      });
      await load();
    } catch (err: any) {
      if (err?.name !== 'UnauthorizedError') Alert.alert('Error', 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    try {
      await apiFetch(`/api/courts/${placeId}/reviews/${reviewId}`, { method: 'DELETE', token });
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      setMyRating(0);
      setMyComment('');
      await load();
    } catch (err: any) {
      if (err?.name !== 'UnauthorizedError') Alert.alert('Error', 'Could not delete review.');
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await apiFetch(`/api/courts/${placeId}/claim`, { method: 'POST', token });
      const data = await res.json();
      if (data.success) await load();
      else Alert.alert('Cannot claim', data.message);
    } catch (err: any) {
      if (err?.name !== 'UnauthorizedError') Alert.alert('Error', 'Could not claim court.');
    } finally {
      setClaiming(false);
    }
  };

  const handleUnclaim = () => {
    Alert.alert('Release Court', 'Remove yourself as manager?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Release', style: 'destructive', onPress: async () => {
        try {
          await apiFetch(`/api/courts/${placeId}/claim`, { method: 'DELETE', token });
          await load();
        } catch {}
      }},
    ]);
  };

  const handlePostAnnouncement = async () => {
    const msg = annInput.trim();
    if (!msg || postingAnn) return;
    setPostingAnn(true);
    try {
      const res = await apiFetch(`/api/courts/${placeId}/announcements`, {
        method: 'POST', token,
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (data.success) {
        setAnnouncements(prev => [data.announcement, ...prev]);
        setAnnInput('');
      } else Alert.alert('Error', data.message);
    } catch { Alert.alert('Error', 'Could not post announcement.'); }
    finally { setPostingAnn(false); }
  };

  const handleDeleteAnnouncement = async (annId: number) => {
    try {
      await apiFetch(`/api/courts/${placeId}/announcements/${annId}`, { method: 'DELETE', token });
      setAnnouncements(prev => prev.filter(a => a.id !== annId));
    } catch { Alert.alert('Error', 'Could not delete announcement.'); }
  };

  const displayName = placesData?.name ?? paramName ?? 'Court';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.heroBand, { backgroundColor: sportColor + '28' }]}>
        <View style={[styles.heroOrb1, { backgroundColor: sportColor + '18' }]} />
        <View style={[styles.heroOrb2, { backgroundColor: sportColor + '0C' }]} />
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle} numberOfLines={2}>{displayName}</Text>
          {sport && (
            <View style={styles.sportBadge}>
              <MaterialCommunityIcons name={sportIcon as any} size={13} color={sportColor} />
              <Text style={[styles.sportBadgeText, { color: sportColor }]}>{sport.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Google Places Photos */}
          {placesData && placesData.photo_refs.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosStrip}
              contentContainerStyle={{ gap: 10, paddingHorizontal: Spacing.xl }}
            >
              {placesData.photo_refs.map((ref, i) => (
                <Image
                  key={i}
                  source={{ uri: `${API_BASE}/api/courts/photo?ref=${encodeURIComponent(ref)}&maxwidth=600` }}
                  style={styles.photo}
                />
              ))}
            </ScrollView>
          )}

          {/* Info block */}
          <View style={styles.infoCard}>
            {/* Open / Closed indicator */}
            {placesData?.open_now !== null && placesData?.open_now !== undefined && (
              <View style={styles.openRow}>
                <View style={[styles.openDot, { backgroundColor: placesData.open_now ? Colors.accent : Colors.error }]} />
                <Text style={[styles.openText, { color: placesData.open_now ? Colors.accent : Colors.error }]}>
                  {placesData.open_now ? 'Open Now' : 'Closed'}
                </Text>
              </View>
            )}

            {/* Address */}
            {(placesData?.address ?? vicinity) && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.infoText}>{placesData?.address ?? vicinity}</Text>
              </View>
            )}

            {/* Phone */}
            {placesData?.phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.infoText}>{placesData.phone}</Text>
              </View>
            )}

            {/* Google rating */}
            {placesData?.google_rating && (
              <View style={styles.infoRow}>
                <Ionicons name="logo-google" size={16} color={Colors.textMuted} />
                <StarRow rating={Math.round(placesData.google_rating)} size={14} />
                <Text style={styles.infoMuted}>
                  {placesData.google_rating.toFixed(1)}
                  {placesData.google_rating_count ? ` (${placesData.google_rating_count.toLocaleString()})` : ''}
                </Text>
              </View>
            )}

            {/* Hours */}
            {placesData?.weekday_hours && placesData.weekday_hours.length > 0 && (
              <View>
                <TouchableOpacity style={styles.infoRow} onPress={() => setHoursExpanded(e => !e)}>
                  <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>Opening Hours</Text>
                  <Ionicons
                    name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.textMuted}
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>
                {hoursExpanded && (
                  <View style={styles.hoursList}>
                    {placesData.weekday_hours.map((line, i) => (
                      <Text key={i} style={styles.hoursLine}>{line}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Court manager / claim banner */}
          {claimedBy ? (
            <View style={styles.claimBanner}>
              <AvatarCircle username={claimedBy.username} avatar={claimedBy.avatar} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.claimLabel}>Managed by</Text>
                <Text style={styles.claimUsername}>{claimedBy.username}</Text>
              </View>
              <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
              {isManager && (
                <TouchableOpacity onPress={handleUnclaim} style={styles.unclaimBtn}>
                  <Text style={styles.unclaimText}>Release</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.claimCta} onPress={handleClaim} disabled={claiming}>
              <Ionicons name="shield-outline" size={18} color={Colors.blue} />
              <Text style={styles.claimCtaText}>
                {claiming ? 'Claiming…' : 'Manage This Court'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Court Announcements */}
          {(announcements.length > 0 || isManager) && (
            <View style={styles.annSection}>
              <View style={styles.annHeader}>
                <Ionicons name="megaphone-outline" size={16} color={Colors.orange} />
                <Text style={styles.annSectionTitle}>Announcements</Text>
              </View>
              {announcements.map(ann => (
                <View key={ann.id} style={styles.annCard}>
                  <View style={styles.annCardHeader}>
                    <Ionicons name="alert-circle-outline" size={14} color={Colors.orange} />
                    <Text style={styles.annUsername}>{ann.username}</Text>
                    {isManager && (
                      <TouchableOpacity
                        onPress={() => Alert.alert('Delete Announcement', 'Remove this announcement?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteAnnouncement(ann.id) },
                        ])}
                        style={{ marginLeft: 'auto' }}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.annMessage}>{ann.message}</Text>
                </View>
              ))}
              {isManager && (
                <View style={styles.annInputRow}>
                  <TextInput
                    style={styles.annInput}
                    placeholder="Post an announcement..."
                    placeholderTextColor={Colors.textHint}
                    value={annInput}
                    onChangeText={setAnnInput}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.annPostBtn, (!annInput.trim() || postingAnn) && { opacity: 0.4 }]}
                    onPress={handlePostAnnouncement}
                    disabled={!annInput.trim() || postingAnn}
                  >
                    {postingAnn
                      ? <ActivityIndicator size="small" color={Colors.bg} />
                      : <Text style={styles.annPostBtnText}>Post</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* SportLink rating aggregate */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Community Reviews</Text>
            {avgRating !== null && (
              <View style={styles.aggRow}>
                <Text style={styles.aggScore}>{avgRating.toFixed(1)}</Text>
                <StarRow rating={Math.round(avgRating)} size={14} />
                <Text style={styles.aggCount}>{reviewCount} review{reviewCount !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {/* Write / edit review */}
          <View style={styles.writeCard}>
            <Text style={styles.writeTitle}>{myReview ? 'Your Review' : 'Leave a Review'}</Text>
            <StarRow rating={myRating} size={28} onPress={setMyRating} />
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment (optional)"
              placeholderTextColor={Colors.textHint}
              value={myComment}
              onChangeText={setMyComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.submitBtn, myRating === 0 && styles.submitBtnDisabled]}
              onPress={handleSubmitReview}
              disabled={submitting || myRating === 0}
            >
              {submitting
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={styles.submitBtnText}>{myReview ? 'Update Review' : 'Submit Review'}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>No reviews yet — be the first!</Text>
          ) : (
            reviews.map(r => (
              <ReviewCard
                key={r.id}
                review={r}
                userId={user?.id ?? -1}
                isManager={isManager}
                placeId={placeId}
                token={token}
                onDelete={handleDeleteReview}
                onRefresh={load}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:    { paddingBottom: 60 },

  heroBand:  { flexDirection: 'row', alignItems: 'center', minHeight: 120, paddingTop: 56, paddingBottom: Spacing.xxl, paddingHorizontal: Spacing.xl, gap: 12, overflow: 'hidden' },
  heroOrb1:  { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -90, right: -70 },
  heroOrb2:  { position: 'absolute', width: 140, height: 140, borderRadius: 70, bottom: -50, left: -40 },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: Colors.text, lineHeight: 26 },
  sportBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  sportBadgeText: { fontSize: 11, fontWeight: '800' },

  photosStrip: { marginVertical: 14 },
  photo:       { width: 220, height: 145, borderRadius: Radius.lg },

  infoCard: { marginHorizontal: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, gap: 12, ...Shadow.card },
  openRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  openDot:  { width: 8, height: 8, borderRadius: 4 },
  openText: { fontSize: 13, fontWeight: '800' },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSub, lineHeight: 18 },
  infoMuted: { fontSize: 12, color: Colors.textMuted, marginLeft: 6 },
  hoursList: { paddingLeft: 26, marginTop: 6, gap: 3 },
  hoursLine: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  sectionHeader: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  sectionTitle:  { fontSize: 20, fontWeight: '900', color: Colors.text, marginBottom: 6 },
  aggRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aggScore:  { fontSize: 22, fontWeight: '900', color: Colors.yellow },
  aggCount:  { fontSize: 12, color: Colors.textMuted },

  writeCard:        { marginHorizontal: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, gap: 12, ...Shadow.card },
  writeTitle:       { fontSize: 15, fontWeight: '800', color: Colors.text },
  commentInput:     { backgroundColor: Colors.surface2, borderRadius: Radius.md, padding: 12, color: Colors.text, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  submitBtn:        { backgroundColor: Colors.accent, borderRadius: Radius.pill, height: 50, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:    { color: Colors.bg, fontWeight: '900', fontSize: 15 },

  noReviews: { textAlign: 'center', color: Colors.textHint, fontStyle: 'italic', marginTop: 10, marginBottom: 20 },

  reviewCard:   { marginHorizontal: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow.card },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar:  { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarImg:    { width: '100%', height: '100%' },
  reviewAvatarLetter: { fontSize: 15, fontWeight: '900' },
  reviewUsername: { fontSize: 13, fontWeight: '800', color: Colors.text },
  reviewDate:     { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  reviewComment:  { fontSize: 13, color: Colors.textSub, lineHeight: 19 },
  deleteBtn:      { padding: 4 },

  ownerResponse:       { marginTop: 10, backgroundColor: Colors.accentFaint, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.accentBorder },
  ownerResponseHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  ownerResponseLabel:  { fontSize: 11, fontWeight: '800', color: Colors.accent },
  ownerResponseText:   { fontSize: 13, color: Colors.textSub, lineHeight: 18 },
  replyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  replyBtnText:   { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  replyInputRow:  { marginTop: 10 },
  replyInput:     { backgroundColor: Colors.surface2, borderRadius: Radius.md, padding: 10, color: Colors.text, fontSize: 13, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.accentBorder },
  replyCancel:    { flex: 1, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, height: 36, alignItems: 'center', justifyContent: 'center' },
  replyCancelText: { fontSize: 13, color: Colors.textMuted, fontWeight: '700' },
  replySave:      { flex: 1, borderRadius: Radius.pill, backgroundColor: Colors.accent, height: 36, alignItems: 'center', justifyContent: 'center' },
  replySaveText:  { fontSize: 13, color: Colors.bg, fontWeight: '900' },

  claimBanner: { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl, backgroundColor: Colors.accentFaint, borderRadius: Radius.xl, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.accentBorder },
  claimLabel:    { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  claimUsername: { fontSize: 13, fontWeight: '800', color: Colors.text },
  unclaimBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.error },
  unclaimText:   { fontSize: 11, color: Colors.error, fontWeight: '700' },
  claimCta:      { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.blueFaint, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.blueBorder },
  claimCtaText:  { fontSize: 13, color: Colors.blue, fontWeight: '800' },

  // Announcements
  annSection:      { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  annHeader:       { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  annSectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.orange },
  annCard:         { backgroundColor: Colors.orange + '14', borderRadius: Radius.lg, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.orange + '44' },
  annCardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  annUsername:     { fontSize: 11, fontWeight: '800', color: Colors.orange },
  annMessage:      { fontSize: 13, color: Colors.text, lineHeight: 19 },
  annInputRow:     { marginTop: 6, gap: 8 },
  annInput:        { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, color: Colors.text, fontSize: 14, minHeight: 60, textAlignVertical: 'top', borderWidth: 1.5, borderColor: Colors.orange + '66' },
  annPostBtn:      { backgroundColor: Colors.orange, borderRadius: Radius.pill, height: 42, alignItems: 'center', justifyContent: 'center' },
  annPostBtnText:  { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
});
