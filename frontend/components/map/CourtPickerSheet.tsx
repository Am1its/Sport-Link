import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { SPORT_COLORS, SPORT_ICONS } from '../../constants/sports';
import type { MapItem } from '../../types';
import { ROUTES } from '../../constants/routes';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  courts: MapItem[];
  onClose: () => void;
};

export function CourtPickerSheet({ courts, onClose }: Props) {
  const router = useRouter();

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose a Court</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={courts}
        keyExtractor={item => item.place_id}
        style={{ maxHeight: 320 }}
        renderItem={({ item }) => {
          const color = SPORT_COLORS[item.sport_type] ?? Colors.accent;
          const icon = (SPORT_ICONS[item.sport_type] ?? 'map-marker') as IconName;
          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onClose();
                router.push({
                  pathname: ROUTES.MODAL,
                  params: {
                    lat: item.geometry.location.lat,
                    lng: item.geometry.location.lng,
                    existingLocationDesc: item.name,
                  },
                });
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: color + '22', borderColor: color }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.address} numberOfLines={1}>{item.vicinity}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textHint} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  title: { fontSize: 18, fontWeight: '900', color: Colors.text },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  address: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
