import React, { createContext, useContext } from 'react';
import { useSounds, SoundName } from '../hooks/useSounds';

type SoundContextValue = { play: (name: SoundName) => Promise<void> };

const SoundContext = createContext<SoundContextValue>({ play: async () => {} });

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { play } = useSounds();
  return <SoundContext.Provider value={{ play }}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
