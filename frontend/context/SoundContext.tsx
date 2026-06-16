import React, { createContext, useContext } from 'react';
import { useSounds, SoundName } from '../hooks/useSounds';

type SoundContextValue = { play: (name: SoundName) => void };

const SoundContext = createContext<SoundContextValue>({ play: () => {} });

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { play } = useSounds();
  return <SoundContext.Provider value={{ play }}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
