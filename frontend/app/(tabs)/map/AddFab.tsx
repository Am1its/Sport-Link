import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReAnimated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { Colors } from '../../../constants/theme';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  onDropPin: () => void;
  onChooseCourt: () => void;
  fabRotateStyle?: AnimatedStyle<ViewStyle>;
};

export function AddFab({ isOpen, onToggle, onDropPin, onChooseCourt, fabRotateStyle }: Props) {
  return (
    <>
      {isOpen && (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={onDropPin}>
            <Ionicons name="location-outline" size={20} color={Colors.text} />
            <Text style={styles.menuText}>Drop Pin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={onChooseCourt}>
            <Ionicons name="business-outline" size={20} color={Colors.accent} />
            <Text style={[styles.menuText, { color: Colors.accent }]}>Choose Court</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        style={[styles.fab, isOpen && { backgroundColor: Colors.error }]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        {fabRotateStyle ? (
          <ReAnimated.View style={fabRotateStyle}>
            <Ionicons name="add" size={32} color={Colors.text} />
          </ReAnimated.View>
        ) : (
          <Ionicons name={isOpen ? 'close' : 'add'} size={32} color={Colors.text} />
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    bottom: 105,
    right: 20,
    gap: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  menuText: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    backgroundColor: Colors.bg,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
