import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '../../../utils/api';
import { API } from '../../../constants/endpoints';
import type { MapItem } from '../../../types';

export const PENDING_MAP_PAN_KEY = 'pending_map_pan';

export type PendingPan = { lat: number; lng: number } | null;

export function isPast(scheduledTime: string | null | undefined): boolean {
  if (!scheduledTime) return false;
  const d = new Date(scheduledTime);
  return !isNaN(d.getTime()) && d < new Date();
}

export function useMapData(token: string | null) {
  const [courts, setCourts] = useState<MapItem[]>([]);
  const [games, setGames] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [initialRegion, setInitialRegion] = useState({ latitude: 32.0853, longitude: 34.7818 });
  const [pendingPan, setPendingPan] = useState<PendingPan>(null);

  const fetchCourts = async (lat: number, lng: number) => {
    try {
      const res = await apiFetch(`${API.COURTS_NEARBY}?lat=${lat}&lng=${lng}`, { token });
      const data = await res.json();
      if (data.success) setCourts(data.courts);
    } catch (err) {
      console.warn('Courts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location permission denied', 'Showing courts in Tel Aviv by default');
          await fetchCourts(32.0853, 34.7818);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        setInitialRegion({ latitude, longitude });
        setUserLocation({ latitude, longitude });
        await fetchCourts(latitude, longitude);
      } catch (err) {
        console.warn('Location error:', err);
        await fetchCourts(32.0853, 34.7818);
      }
    };
    initLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          const [gamesRes, meRes] = await Promise.all([
            apiFetch(API.GAMES, { token }),
            apiFetch(API.ME, { token }),
          ]);
          const gamesData = await gamesRes.json();
          const meData = await meRes.json();
          if (gamesData.success) {
            setGames(gamesData.games.map((g: any) => {
              const { photo: _p, post_game_photo: _pp, ...rest } = g;
              return rest;
            }));
          }
          if (meData.success) {
            setMyAvatar(meData.user.avatar ?? null);
            setMyUsername(meData.user.username ?? '');
          }
        } catch {}

        // Pan to newly created game if queued
        try {
          const raw = await AsyncStorage.getItem(PENDING_MAP_PAN_KEY);
          if (!raw) return;
          await AsyncStorage.removeItem(PENDING_MAP_PAN_KEY);
          const { lat, lng } = JSON.parse(raw);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
          setPendingPan({ lat, lng });
        } catch {}
      };
      run();
    }, [token])
  );

  const clearPendingPan = () => setPendingPan(null);

  return {
    courts,
    games,
    loading,
    myAvatar,
    myUsername,
    userLocation,
    setUserLocation,
    initialRegion,
    pendingPan,
    clearPendingPan,
    setCourts,
    setGames,
  };
}
