import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFloatingOrb } from '../hooks/useAnimations';
import { Colors, Radius } from '../constants/theme';
import { Springs } from '../constants/motion';

const SPORT_ICONS = [
  'basketball', 'soccer', 'tennis', 'volleyball',
  'swim', 'dumbbell', 'yoga', 'handball', 'dance-ballroom',
];

const ICON_LAYOUT = [
  { top: 14,  left: 20,  size: 22, opacity: 0.07, rotate: '-8deg' },
  { top: 10,  left: 90,  size: 18, opacity: 0.05, rotate: '12deg' },
  { top: 18,  left: 160, size: 24, opacity: 0.08, rotate: '-4deg' },
  { top: 12,  left: 230, size: 20, opacity: 0.06, rotate: '16deg' },
  { top: 8,   left: 300, size: 22, opacity: 0.05, rotate: '-12deg' },
  { top: 56,  left: 50,  size: 20, opacity: 0.05, rotate: '8deg' },
  { top: 60,  left: 125, size: 26, opacity: 0.07, rotate: '-6deg' },
  { top: 52,  left: 200, size: 18, opacity: 0.06, rotate: '20deg' },
  { top: 58,  left: 270, size: 24, opacity: 0.05, rotate: '-10deg' },
  { top: 140, left: 30,  size: 24, opacity: 0.06, rotate: '10deg' },
  { top: 135, left: 110, size: 20, opacity: 0.05, rotate: '-14deg' },
  { top: 180, left: 185, size: 22, opacity: 0.07, rotate: '6deg' },
  { top: 175, left: 255, size: 18, opacity: 0.05, rotate: '-18deg' },
  { top: 240, left: 70,  size: 22, opacity: 0.06, rotate: '4deg' },
  { top: 260, left: 150, size: 26, opacity: 0.05, rotate: '-8deg' },
  { top: 245, left: 230, size: 20, opacity: 0.07, rotate: '14deg' },
];

function FloatingIcon({ item, iconName, phase }: {
  item: { top: number; left: number; size: number; opacity: number; rotate: string };
  iconName: string;
  phase: number;
}) {
  const floatStyle = useFloatingOrb(phase);
  return (
    <ReAnimated.View
      style={[{ position: 'absolute', top: item.top, left: item.left }, floatStyle]}
      pointerEvents="none"
    >
      <MaterialCommunityIcons
        name={iconName as any}
        size={item.size}
        color="#FFFFFF"
        style={{ opacity: item.opacity, transform: [{ rotate: item.rotate }] }}
      />
    </ReAnimated.View>
  );
}

export function AuthBackground() {
  const logoScale   = useSharedValue(0);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value   = withSpring(1, Springs.bouncy);
    logoOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      {ICON_LAYOUT.map((item, i) => (
        <FloatingIcon
          key={i}
          item={item}
          iconName={SPORT_ICONS[i % SPORT_ICONS.length]}
          phase={(i % 5) * 0.2}
        />
      ))}
      <ReAnimated.View style={[styles.brand, logoStyle]}>
        <View style={styles.logoRing}>
          <Image
            source={require('../assets/Logo4.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>SportLink</Text>
        <View style={styles.taglineRow}>
          <View style={styles.taglineDot} />
          <Text style={styles.tagline}>Find Your Match. Play Your Game.</Text>
          <View style={styles.taglineDot} />
        </View>
      </ReAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb1: {
    position: 'absolute', width: 340, height: 340, borderRadius: 170,
    backgroundColor: Colors.accent + '12', top: -100, right: -80,
  },
  orb2: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.accent + '07', top: 80, left: -80,
  },
  brand: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: '50%',
    alignItems: 'center', justifyContent: 'center',
  },
  logoRing: {
    width: 100, height: 100, borderRadius: Radius.xxl,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5, borderColor: Colors.accent + '40',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  logo: { width: 68, height: 68 },
  appName: { fontSize: 36, fontWeight: '900', color: Colors.text, letterSpacing: 0.5 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  taglineDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  tagline: { fontSize: 13, color: Colors.accent, fontWeight: '600', letterSpacing: 0.3 },
});
