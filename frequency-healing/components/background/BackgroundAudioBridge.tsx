'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type BackgroundAudioBridgeValue = {
  analyser: AnalyserNode | null;
  setAnalyser: (value: AnalyserNode | null) => void;
};

const BackgroundAudioBridgeContext = createContext<BackgroundAudioBridgeValue | null>(null);

export function BackgroundAudioProvider({ children }: { children: ReactNode }) {
  const [analyser, setAnalyserState] = useState<AnalyserNode | null>(null);

  const setAnalyser = useCallback((value: AnalyserNode | null) => {
    setAnalyserState(value);
  }, []);

  const value = useMemo(
    () => ({
      analyser,
      setAnalyser
    }),
    [analyser, setAnalyser]
  );

  return <BackgroundAudioBridgeContext.Provider value={value}>{children}</BackgroundAudioBridgeContext.Provider>;
}

export function useBackgroundAudioBridge() {
  const context = useContext(BackgroundAudioBridgeContext);
  if (!context) {
    throw new Error('useBackgroundAudioBridge must be used inside BackgroundAudioProvider.');
  }
  return context;
}
