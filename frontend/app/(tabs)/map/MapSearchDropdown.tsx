import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/theme';
import type { GeoResult } from '../../../utils/geocode';

type Props = {
  searchQuery: string;
  searchLoading: boolean;
  searchResults: GeoResult[];
  recentSearches: GeoResult[];
  onSelectPlace: (place: GeoResult) => void;
};

export function MapSearchDropdown({
  searchQuery,
  searchLoading,
  searchResults,
  recentSearches,
  onSelectPlace,
}: Props) {
  return (
    <View style={styles.dropdown}>
      {searchQuery.length < 2 && recentSearches.length > 0 && (
        <>
          <Text style={styles.label}>Recent</Text>
          {recentSearches.map(place => (
            <TouchableOpacity key={place.name} style={styles.item} onPress={() => onSelectPlace(place)}>
              <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
              <Text style={styles.itemText} numberOfLines={1}>{place.name}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
      {searchQuery.length >= 2 && searchLoading && (
        <View style={styles.item}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={[styles.itemText, { color: Colors.textMuted }]}>Searching...</Text>
        </View>
      )}
      {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
        <View style={styles.item}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <Text style={[styles.itemText, { color: Colors.textMuted }]}>No results found</Text>
        </View>
      )}
      {searchResults.map(place => (
        <TouchableOpacity key={place.name} style={styles.item} onPress={() => onSelectPlace(place)}>
          <Ionicons name="location-outline" size={15} color={Colors.accent} />
          <Text style={styles.itemText} numberOfLines={1}>{place.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
});
