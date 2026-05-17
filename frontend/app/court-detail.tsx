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
  created_at: string;
};

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

function ReviewCard({ review, userId, onDelete }: { review: Review; userId: number; onDelete: (id: number) => void }) {
  const color = getAvatarColor(review.username);
  const isOwn = review.user_id === userId;
  const date = new Date(review.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
                onDelete={handleDeleteReview}
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
});
