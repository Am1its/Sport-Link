import { Linking, Platform } from 'react-native';

export type MapsAppKey = 'waze' | 'google' | 'native';

export type MapsApp = {
  key: MapsAppKey;
  label: string;
  icon: 'car-outline' | 'logo-google' | 'map-outline';
  url: string;
};

function buildUrls(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  return {
    waze: `waze://?ll=${lat},${lng}&navigate=yes`,
    google: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    native: Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}&q=${encodedLabel}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`,
  };
}

// Returns only the maps apps actually installed, plus native Maps (Apple Maps on
// iOS / the device's geo: handler on Android) which is always available and always
// listed last as the guaranteed fallback. Google Maps is only probed on iOS — on
// Android the native geo: handler already opens the same app.
export async function getInstalledMapsApps(
  lat: number,
  lng: number,
  label = 'Destination'
): Promise<MapsApp[]> {
  const urls = buildUrls(lat, lng, label);
  const apps: MapsApp[] = [];

  const wazeInstalled = await Linking.canOpenURL('waze://').catch(() => false);
  if (wazeInstalled) {
    apps.push({ key: 'waze', label: 'Waze', icon: 'car-outline', url: urls.waze });
  }

  if (Platform.OS === 'ios') {
    const googleInstalled = await Linking.canOpenURL('comgooglemaps://').catch(() => false);
    if (googleInstalled) {
      apps.push({ key: 'google', label: 'Google Maps', icon: 'logo-google', url: urls.google });
    }
  }

  apps.push({
    key: 'native',
    label: Platform.OS === 'ios' ? 'Apple Maps' : 'Maps',
    icon: 'map-outline',
    url: urls.native,
  });

  return apps;
}

export async function openDirections(app: MapsApp): Promise<void> {
  try {
    await Linking.openURL(app.url);
  } catch {
    // Convenience action, not critical-path — nothing to recover from here.
  }
}
