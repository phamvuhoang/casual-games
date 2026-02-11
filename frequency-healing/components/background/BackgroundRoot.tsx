'use client';

import type { ReactNode } from 'react';
import { BackgroundAudioProvider } from '@/components/background/BackgroundAudioBridge';
import BackgroundStage from '@/components/background/BackgroundStage';

export default function BackgroundRoot({ children }: { children: ReactNode }) {
  return (
    <BackgroundAudioProvider>
      <BackgroundStage />
      <div className="relative z-10">{children}</div>
    </BackgroundAudioProvider>
  );
}
