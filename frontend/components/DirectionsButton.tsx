import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { getInstalledMapsApps, openDirections, MapsApp } from '../utils/directions';
import { DirectionsSheet } from './DirectionsSheet';

export function DirectionsButton({
  lat,
  lng,
  label,
  style,
  textStyle,
  iconColor = Colors.accent,
  iconSize = 15,
  showLabel = true,
  labelText = 'Directions',
}: {
  lat: number;
  lng: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  iconSize?: number;
  showLabel?: boolean;
  labelText?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [apps, setApps] = useState<MapsApp[]>([]);

  const handlePress = async () => {
    const found = await getInstalledMapsApps(lat, lng, label);
    if (found.length === 0) return;
    setApps(found);
    setVisible(true);
  };

  const handleSelect = (app: MapsApp) => {
    setVisible(false);
    openDirections(app);
  };

  return (
    <>
      <TouchableOpacity style={style} onPress={handlePress}>
        <Ionicons name="navigate-outline" size={iconSize} color={iconColor} />
        {showLabel && <Text style={textStyle}>{labelText}</Text>}
      </TouchableOpacity>
      <DirectionsSheet
        visible={visible}
        apps={apps}
        onSelect={handleSelect}
        onClose={() => setVisible(false)}
      />
    </>
  );
}
