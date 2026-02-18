'use client';

import Button from '@/components/ui/Button';
import type { VoiceBioprintProfile, VoiceBioprintRecommendation } from '@/lib/audio/VoiceBioprintEngine';

interface VoicePortraitCardProps {
  profile: VoiceBioprintProfile | null;
  recommendations: VoiceBioprintRecommendation[];
  onApply: () => void;
  disabled?: boolean;
}

export default function VoicePortraitCard({
  profile,
  recommendations,
  onApply,
  disabled = false
}: VoicePortraitCardProps) {
  if (!profile) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/70 p-3 text-xs text-ink/60">
        Capture a short voice sample to generate a personalized frequency portrait.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/82 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Frequency portrait</p>
        <p className="text-xs text-ink/60">Confidence: {Math.round(profile.confidence * 100)}%</p>
      </div>

      <div className="mt-3 flex h-16 items-end gap-[3px] rounded-xl bg-gradient-to-r from-white to-slate-50 px-2 py-1">
        {profile.portrait.map((value, index) => (
          <div key={`portrait-${index}`} className="flex-1 rounded-sm bg-lagoon/70" style={{ height: `${Math.max(6, Math.round(value * 100))}%` }} />
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {recommendations.length === 0 ? (
          <p className="text-xs text-ink/60">No recommendations were generated.</p>
        ) : (
          recommendations.map((item) => (
            <div key={`voice-rec-${item.frequency}`} className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink/85">{item.frequency} Hz</span>
                <span>{Math.round(item.gain * 100)}% gain</span>
              </div>
              <p className="mt-1 text-[11px] text-ink/55">{item.reason}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={onApply} disabled={disabled || recommendations.length === 0}>
          Apply recommendations
        </Button>
      </div>
    </div>
  );
}

