import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { usePressAnimation } from '../hooks/useAnimations';

export function BackButton({
  bgColor = Colors.surface2,
  iconColor = Colors.text,
  onPress,
  style,
}: {
  bgColor?: string;
  iconColor?: string;
  onPress?: () => void;
  style?: object;
}) {
  const router = useRouter();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.88,
    scaleUp: 1.0,
    stiffness: 400,
    damping: 18,
  });

  return (
    <Animated.View style={[styles.circle, { backgroundColor: bgColor }, animatedStyle, style]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress ? onPress() : router.back();
        }}
        style={styles.pressable}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={20} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pressable: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
});
