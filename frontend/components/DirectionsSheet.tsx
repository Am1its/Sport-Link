import React from 'react';
import { Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow, Type } from '../constants/theme';
import type { MapsApp } from '../utils/directions';

export function DirectionsSheet({
  visible,
  apps,
  onSelect,
  onClose,
}: {
  visible: boolean;
  apps: MapsApp[];
  onSelect: (app: MapsApp) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Get Directions</Text>
          {apps.map(app => (
            <TouchableOpacity key={app.key} style={styles.row} onPress={() => onSelect(app)}>
              <Ionicons name={app.icon} size={20} color={Colors.accent} />
              <Text style={styles.rowText}>{app.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    ...Shadow.medium,
  },
  title: { ...Type.sectionLabel, color: Colors.textMuted, marginBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowText: { ...Type.body, color: Colors.text, fontSize: 16, fontWeight: '600' },
  cancelBtn: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
  },
  cancelText: { color: Colors.textMuted, fontWeight: '700' },
});
