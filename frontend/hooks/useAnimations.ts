import { useEffect } from 'react';
import {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withDelay,
  runOnJS,
} from 'react-native-reanimated';

export function usePressAnimation(config?: {
  scaleDown?: number;
  scaleUp?: number;
  stiffness?: number;
  damping?: number;
}) {
  const { scaleDown = 0.94, scaleUp = 1.02, stiffness = 300, damping = 20 } = config ?? {};
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(scaleDown, { stiffness, damping });
  };

  const onPressOut = () => {
    scale.value = withSequence(
      withSpring(scaleUp, { stiffness, damping }),
      withSpring(1, { stiffness, damping }),
    );
  };

  return { animatedStyle, onPressIn, onPressOut };
}

export function useEntranceAnimation(delay = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { stiffness: 200, damping: 20 }));
    translateY.value = withDelay(delay, withSpring(0, { stiffness: 200, damping: 20 }));
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export function useStaggerEntrance(index: number, baseDelay = 0) {
  return useEntranceAnimation(baseDelay + index * 60);
}

const DOT_ANGLES = Array.from({ length: 6 }, (_, i) => (i * Math.PI * 2) / 6);

function makeDotStyle(p: number, angle: number) {
  'worklet';
  return {
    opacity: 1 - p,
    transform: [
      { translateX: Math.cos(angle) * p * 40 },
      { translateY: Math.sin(angle) * p * 40 },
    ],
  };
}

export function useSuccessBurst() {
  const progress = useSharedValue(0);

  const dot0 = useAnimatedStyle(() => makeDotStyle(progress.value, DOT_ANGLES[0]));
  const dot1 = useAnimatedStyle(() => makeDotStyle(progress.value, DOT_ANGLES[1]));
  const dot2 = useAnimatedStyle(() => makeDotStyle(progress.value, DOT_ANGLES[2]));
  const dot3 = useAnimatedStyle(() => makeDotStyle(progress.value, DOT_ANGLES[3]));
  const dot4 = useAnimatedStyle(() => makeDotStyle(progress.value, DOT_ANGLES[4]));
  const dot5 = useAnimatedStyle(() => makeDotStyle(progress.value, DOT_ANGLES[5]));

  const trigger = (onComplete?: () => void) => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 400 }, (finished) => {
      if (finished && onComplete) runOnJS(onComplete)();
    });
  };

  return { trigger, dotStyles: [dot0, dot1, dot2, dot3, dot4, dot5] };
}
