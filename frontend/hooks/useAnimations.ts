import { useEffect, useCallback, useState } from 'react';
import {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withDelay, withRepeat,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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

  const onPressIn = useCallback(() => {
    scale.value = withSpring(scaleDown, { stiffness, damping });
  }, [scale, scaleDown, stiffness, damping]);

  const onPressOut = useCallback(() => {
    scale.value = withSequence(
      withSpring(scaleUp, { stiffness, damping }),
      withSpring(1, { stiffness, damping }),
    );
  }, [scale, scaleUp, stiffness, damping]);

  return { animatedStyle, onPressIn, onPressOut };
}

export function useEntranceAnimation(delay = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { stiffness: 200, damping: 20 }));
    translateY.value = withDelay(delay, withSpring(0, { stiffness: 200, damping: 20 }));
  }, [delay]);

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

  const trigger = useCallback((onComplete?: () => void) => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 400 }, (finished) => {
      if (finished && onComplete) scheduleOnRN(onComplete);
    });
  }, [progress]);

  return { trigger, dotStyles: [dot0, dot1, dot2, dot3, dot4, dot5] };
}

export function useFloatingOrb(phase = 0) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      Math.round(phase * 2000),
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(8,  { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, []);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
}

export function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return display;
}

export function useFieldShake() {
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const shake = useCallback(() => {
    translateX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8,  { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6,  { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(0,  { duration: 50 }),
    );
  }, [translateX]);

  return { animatedStyle, shake };
}

export function useTypingIndicator() {
  const dot0 = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const [visible, setVisible] = useState(false);

  const dot0Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot0.value }] }));
  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));

  const startLoop = useCallback(() => {
    const bounce = (sv: { value: number }, delay: number) => {
      sv.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(-6, { duration: 300 }),
          withTiming(0,  { duration: 300 }),
        ),
        -1,
      ));
    };
    bounce(dot0, 0);
    bounce(dot1, 120);
    bounce(dot2, 240);
  }, [dot0, dot1, dot2]);

  const stopLoop = useCallback(() => {
    dot0.value = withTiming(0, { duration: 200 });
    dot1.value = withTiming(0, { duration: 200 });
    dot2.value = withTiming(0, { duration: 200 });
  }, [dot0, dot1, dot2]);

  const show = useCallback(() => {
    setVisible(true);
    startLoop();
  }, [startLoop]);

  const hide = useCallback(() => {
    stopLoop();
    setTimeout(() => setVisible(false), 200);
  }, [stopLoop]);

  return { dot0Style, dot1Style, dot2Style, visible, show, hide };
}
