import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { getAvatarColor } from '../utils/avatar';
import { Colors } from '../constants/theme';
import { Springs } from '../constants/motion';

type ChatBubbleProps = {
  messageId: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  avatar: string | null | undefined;
  onAvatarPress?: () => void;
  formatTime: (ts: string) => string;
};

export function ChatBubble({
  messageId, userId, username, content, createdAt,
  isMine, avatar, onAvatarPress, formatTime,
}: ChatBubbleProps) {
  const translateY = useSharedValue(8);
  const translateX = useSharedValue(isMine ? 0 : -6);
  const rotate = useSharedValue(isMine ? 0 : -2);

  useEffect(() => {
    translateY.value = withSpring(0, { stiffness: 220, damping: 22 });
    translateX.value = withSpring(0, { stiffness: 260, damping: 24 });
    rotate.value = withSpring(0, Springs.snappy);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const avatarColor = getAvatarColor(username);

  const avatarEl = (
    <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress} activeOpacity={0.75}>
      <View style={[styles.avatar, { backgroundColor: avatarColor + '22', borderColor: avatarColor, borderWidth: 1.5 }]}>
        {avatar
          ? <Image source={{ uri: `data:image/jpeg;base64,${avatar}` }} style={styles.avatarImg} />
          : <Text style={[styles.avatarLetter, { color: avatarColor }]}>{username.charAt(0).toUpperCase()}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.row, isMine ? styles.rowMine : styles.rowOther, animStyle]}>
      {!isMine && avatarEl}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!isMine && <Text style={styles.username}>{username}</Text>}
        <Text style={[styles.content, isMine && styles.contentMine]}>{content}</Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(createdAt)}</Text>
      </View>
      {isMine && avatarEl}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', marginVertical: 4, paddingHorizontal: 12, alignItems: 'flex-end', gap: 8 },
  rowMine:    { justifyContent: 'flex-end' },
  rowOther:   { justifyContent: 'flex-start' },
  avatar:     { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:  { width: 32, height: 32, borderRadius: 16 },
  avatarLetter: { fontSize: 13, fontWeight: '700' },
  bubble:     { maxWidth: '72%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine:  { backgroundColor: Colors.accent },
  bubbleOther: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  username:   { fontSize: 11, fontWeight: '700', color: Colors.textSub, marginBottom: 3 },
  content:    { fontSize: 15, color: Colors.text, lineHeight: 20 },
  contentMine: { color: Colors.bg },
  time:       { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  timeMine:   { color: Colors.bg + 'AA' },
});
