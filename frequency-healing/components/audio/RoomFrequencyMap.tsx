'use client';

interface RoomFrequencyMapProps {
  levels: number[];
}

export default function RoomFrequencyMap({ levels }: RoomFrequencyMapProps) {
  if (levels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/70 p-3 text-xs text-ink/60">
        Run room scan to generate a live frequency map.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Room frequency map</p>
      <div className="mt-2 flex h-16 items-end gap-[3px] rounded-xl bg-gradient-to-r from-slate-50 via-white to-slate-50 px-2 py-1">
        {levels.map((value, index) => (
          <div
            key={`room-band-${index}`}
            className="flex-1 rounded-sm bg-gradient-to-t from-lagoon/70 to-teal-300/80"
            style={{ height: `${Math.max(5, Math.round(value * 100))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

