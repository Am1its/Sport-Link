import { useEffect, useRef, useCallback, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
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
  const players = useRef<Partial<Record<SoundName, AudioPlayer>>>({});
  const enabledRef = useRef(true);
  const [soundsEnabled, setSoundsEnabledState] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function preload() {
      // Skip on simulator — native audio hardware unavailable, causes log spam
      if (!Constants.isDevice) return;

      const stored = await AsyncStorage.getItem('sounds_enabled');
      const enabled = stored !== 'false';
      enabledRef.current = enabled;
      if (mounted) setSoundsEnabledState(enabled);
      if (!enabled || !mounted) return;

      await setAudioModeAsync({ playsInSilentMode: false });
      if (!mounted) return;

      for (const [name, file] of Object.entries(SOUND_FILES) as [SoundName, any][]) {
        try {
          players.current[name] = createAudioPlayer(file);
        } catch {}
      }
    }

    preload();
    return () => {
      mounted = false;
      Object.values(players.current).forEach(p => p?.remove());
    };
  }, []);

  const play = useCallback(async (name: SoundName) => {
    if (!enabledRef.current) return;
    try {
      const player = players.current[name];
      if (!player) return;
      await player.seekTo(0);
      player.play();
    } catch {}
  }, []);

  // Updates the live ref (so play() reflects it immediately, not just after restart)
  // alongside the persisted setting and the state that drives the settings toggle UI.
  const setSoundsEnabled = useCallback(async (enabled: boolean) => {
    enabledRef.current = enabled;
    setSoundsEnabledState(enabled);
    await AsyncStorage.setItem('sounds_enabled', enabled ? 'true' : 'false');
  }, []);

  return { play, soundsEnabled, setSoundsEnabled };
}
