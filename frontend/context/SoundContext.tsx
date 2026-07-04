import React, { createContext, useContext } from 'react';
import { useSounds, SoundName } from '../hooks/useSounds';

type SoundContextValue = {
  play: (name: SoundName) => Promise<void>;
  soundsEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => Promise<void>;
};

const SoundContext = createContext<SoundContextValue>({
  play: async () => {},
  soundsEnabled: true,
  setSoundsEnabled: async () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { play, soundsEnabled, setSoundsEnabled } = useSounds();
  return (
    <SoundContext.Provider value={{ play, soundsEnabled, setSoundsEnabled }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
