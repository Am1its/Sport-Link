import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SOUND_FILES = {
  chime:   require('../assets/sounds/chime.wav'),
  pop:     require('../assets/sounds/pop.wav'),
  success: require('../assets/sounds/success.wav'),
  error:   require('../assets/sounds/error.wav'),
  ding:    require('../assets/sounds/ding.wav'),
} as const;

export type SoundName = keyof typeof SOUND_FILES;

export function useSounds() {
  const sounds = useRef<Partial<Record<SoundName, Audio.Sound>>>({});
  const enabledRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function preload() {
      // Skip on simulator — native audio hardware unavailable, causes log spam
      if (!Constants.isDevice) return;

      const stored = await AsyncStorage.getItem('sounds_enabled');
      enabledRef.current = stored !== 'false';
      if (!enabledRef.current) return;

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });

      for (const [name, file] of Object.entries(SOUND_FILES) as [SoundName, any][]) {
        try {
          const { sound } = await Audio.Sound.createAsync(file, { shouldPlay: false });
          if (mounted) sounds.current[name] = sound;
        } catch {}
      }
    }

    preload();
    return () => {
      mounted = false;
      Object.values(sounds.current).forEach(s => s?.unloadAsync());
    };
  }, []);

  const play = useCallback(async (name: SoundName) => {
    if (!enabledRef.current) return;
    try {
      const sound = sounds.current[name];
      if (!sound) return;
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {}
  }, []);

  return { play };
}
