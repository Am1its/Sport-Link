import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Colors, Radius } from '../constants/theme';

function SkeletonBlock({
  width, height, borderRadius = Radius.md, style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: Colors.surface2 },
        { opacity },
        style,
      ]}
    />
  );
}

export function DiscoverSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <View key={i} style={s.card}>
          <View style={s.cardTop}>
            <SkeletonBlock width={48} height={48} borderRadius={24} />
            <View style={s.cardInfo}>
              <SkeletonBlock width={72} height={10} style={{ marginBottom: 8 }} />
              <SkeletonBlock width="85%" height={17} style={{ marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SkeletonBlock width={80} height={11} />
                <SkeletonBlock width={60} height={11} />
                <SkeletonBlock width={50} height={11} />
              </View>
            </View>
          </View>
          <SkeletonBlock width="100%" height={44} borderRadius={Radius.xl} style={{ marginTop: 14 }} />
        </View>
      ))}
    </>
  );
}

export function GamesSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <View key={i} style={[s.card, { flexDirection: 'row', gap: 14 }]}>
          <SkeletonBlock width={52} height={52} borderRadius={26} />
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBlock width={90} height={12} />
              <SkeletonBlock width={52} height={20} borderRadius={10} />
            </View>
            <SkeletonBlock width="90%" height={17} />
            <SkeletonBlock width="65%" height={12} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
              <SkeletonBlock width={68} height={32} borderRadius={Radius.md} />
              <SkeletonBlock width={68} height={32} borderRadius={Radius.md} />
              <SkeletonBlock width={68} height={32} borderRadius={Radius.md} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <View style={[s.card, {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginHorizontal: 20,
    }]}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={{ alignItems: 'center', gap: 7 }}>
          <SkeletonBlock width={40} height={26} borderRadius={6} />
          <SkeletonBlock width={50} height={10} />
        </View>
      ))}
    </View>
  );
}

export function ChatSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={s.chatRow}>
          <SkeletonBlock width={52} height={52} borderRadius={26} />
          <View style={{ flex: 1, gap: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBlock width={120} height={15} />
              <SkeletonBlock width={40} height={11} />
            </View>
            <SkeletonBlock width="75%" height={12} />
          </View>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  card:    { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 14 },
  cardInfo:{ flex: 1 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
});
