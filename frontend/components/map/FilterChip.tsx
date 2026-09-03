import React from 'react';
import { Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import ReAnimated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withDelay,
} from 'react-native-reanimated';
import { Springs } from '../../constants/motion';
import { usePressAnimation } from '../../hooks/useAnimations';

export function FilterChip({
  label, isActive, onPress, chipStyle, textStyle, activeChipStyle, activeTextStyle, index,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  chipStyle: any;
  textStyle: any;
  activeChipStyle: any;
  activeTextStyle: any;
  index: number;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.94, scaleUp: 1.0, stiffness: 400, damping: 18,
  });
  const translateX = useSharedValue(-30);
  const chipOpacity = useSharedValue(0);

  React.useEffect(() => {
    const delay = Math.min(index * 60, 300);
    translateX.value = withDelay(delay, withSpring(0, Springs.bouncy));
    chipOpacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staggerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: chipOpacity.value,
  }));

  return (
    <ReAnimated.View style={[staggerStyle, animatedStyle]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        style={[chipStyle, isActive && activeChipStyle]}
      >
        <Text style={[textStyle, isActive && activeTextStyle]}>{label}</Text>
      </Pressable>
    </ReAnimated.View>
  );
}
