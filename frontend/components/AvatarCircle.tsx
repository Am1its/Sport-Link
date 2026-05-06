import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { getAvatarColor } from '../utils/avatar';

interface AvatarCircleProps {
  username: string;
  avatar: string | null;
  size?: number;
  onPress?: () => void;
}

export default function AvatarCircle({ username, avatar, size = 44, onPress }: AvatarCircleProps) {
  const radius = size / 2;
  const fontSize = Math.round(size * 0.38);

  const inner = avatar ? (
    <Image
      source={{ uri: `data:image/jpeg;base64,${avatar}` }}
      style={[styles.img, { width: size, height: size, borderRadius: radius }]}
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: getAvatarColor(username) }]}>
      <Text style={[styles.initial, { fontSize }]}>{username.charAt(0).toUpperCase()}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  img: { resizeMode: 'cover' },
  fallback: { justifyContent: 'center', alignItems: 'center' },
  initial: { color: '#FFFFFF', fontWeight: '700' },
});
