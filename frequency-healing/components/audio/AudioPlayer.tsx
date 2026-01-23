'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { formatFrequencyList } from '@/lib/utils/helpers';

interface AudioPlayerProps {
  title: string;
  audioUrl?: string | null;
  frequencies: number[];
  onPlay?: () => void;
}

export default function AudioPlayer({ title, audioUrl, frequencies, onPlay }: AudioPlayerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-ink/60">{formatFrequencyList(frequencies)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? 'Hide player' : 'Open player'}
        </Button>
      </div>
      {isOpen ? (
        <div className="mt-4">
          {audioUrl ? (
            <audio controls className="w-full" onPlay={onPlay}>
              <source src={audioUrl} />
            </audio>
          ) : (
            <p className="text-sm text-ink/60">Audio file not yet generated for this composition.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
