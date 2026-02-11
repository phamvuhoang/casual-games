'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BACKGROUND_ANIMATION_OPTIONS,
  renderBackgroundFrame,
  type AudioSnapshot,
  type BackgroundAnimationId
} from '@/components/background/animationLibrary';
import { useBackgroundAudioBridge } from '@/components/background/BackgroundAudioBridge';
import { cn } from '@/lib/utils/helpers';

type BackgroundMode = 'auto' | 'manual' | 'off';

type StoredBackgroundPreferences = {
  mode: BackgroundMode;
  animationId?: BackgroundAnimationId;
};

const STORAGE_KEY = 'frequency-healing:background-preferences';

function detectLowPower() {
  if (typeof window === 'undefined') {
    return false;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallViewport = window.matchMedia('(max-width: 900px)').matches;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return reducedMotion || smallViewport || lowCores;
}

function randomAnimation(exclude?: BackgroundAnimationId) {
  const pool = BACKGROUND_ANIMATION_OPTIONS.filter((item) => item.id !== exclude);
  const source = pool.length > 0 ? pool : BACKGROUND_ANIMATION_OPTIONS;
  return source[Math.floor(Math.random() * source.length)].id;
}

function isAnimationId(value: unknown): value is BackgroundAnimationId {
  return BACKGROUND_ANIMATION_OPTIONS.some((item) => item.id === value);
}

export default function BackgroundStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const audioDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const audioSnapshotRef = useRef<AudioSnapshot>({ energy: 0.08, bass: 0.08, mid: 0.08, treble: 0.08 });
  const seedRef = useRef(Math.random() * 1000 + Date.now() % 1000);

  const { analyser } = useBackgroundAudioBridge();

  const [mode, setMode] = useState<BackgroundMode>('auto');
  const [activeAnimation, setActiveAnimation] = useState<BackgroundAnimationId>(() => randomAnimation());
  const [manualAnimation, setManualAnimation] = useState<BackgroundAnimationId>('gradient_flow');
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);

  const activeAnimationMeta = useMemo(
    () => BACKGROUND_ANIMATION_OPTIONS.find((item) => item.id === activeAnimation) ?? BACKGROUND_ANIMATION_OPTIONS[0],
    [activeAnimation]
  );

  const isEnabled = mode !== 'off';
  const shouldAnimate = isEnabled && !prefersReducedMotion;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedRaw = window.localStorage.getItem(STORAGE_KEY);
    if (!storedRaw) {
      setActiveAnimation(randomAnimation());
      return;
    }

    try {
      const parsed = JSON.parse(storedRaw) as Partial<StoredBackgroundPreferences>;
      if (parsed.mode === 'off') {
        setMode('off');
        return;
      }

      if (parsed.mode === 'manual' && isAnimationId(parsed.animationId)) {
        setMode('manual');
        setManualAnimation(parsed.animationId);
        setActiveAnimation(parsed.animationId);
        return;
      }

      setMode('auto');
      setActiveAnimation(randomAnimation());
    } catch (_error) {
      setMode('auto');
      setActiveAnimation(randomAnimation());
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refresh = () => {
      setPrefersReducedMotion(media.matches);
      setIsLowPower(detectLowPower());
    };

    refresh();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', refresh);
      window.addEventListener('resize', refresh);
      return () => {
        media.removeEventListener('change', refresh);
        window.removeEventListener('resize', refresh);
      };
    }

    media.addListener(refresh);
    window.addEventListener('resize', refresh);
    return () => {
      media.removeListener(refresh);
      window.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: StoredBackgroundPreferences =
      mode === 'manual'
        ? {
            mode,
            animationId: manualAnimation
          }
        : { mode };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [manualAnimation, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = isLowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
    };

    const getAudioSnapshot = (time: number): AudioSnapshot => {
      if (!analyser) {
        const drift = 0.05 + Math.sin(time * 0.0007) * 0.02;
        return {
          energy: drift,
          bass: 0.06 + Math.sin(time * 0.0005) * 0.02,
          mid: 0.05 + Math.cos(time * 0.00055) * 0.02,
          treble: 0.05 + Math.sin(time * 0.00045 + 0.8) * 0.02
        };
      }

      if (!audioDataRef.current || audioDataRef.current.length !== analyser.frequencyBinCount) {
        audioDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }

      analyser.getByteFrequencyData(audioDataRef.current);
      const values = audioDataRef.current;
      const count = values.length;
      const bassEnd = Math.max(1, Math.floor(count * 0.12));
      const midEnd = Math.max(bassEnd + 1, Math.floor(count * 0.48));

      let bass = 0;
      let mid = 0;
      let treble = 0;

      for (let i = 0; i < bassEnd; i += 1) {
        bass += values[i];
      }
      for (let i = bassEnd; i < midEnd; i += 1) {
        mid += values[i];
      }
      for (let i = midEnd; i < count; i += 1) {
        treble += values[i];
      }

      const bassNorm = bass / Math.max(1, bassEnd) / 255;
      const midNorm = mid / Math.max(1, midEnd - bassEnd) / 255;
      const trebleNorm = treble / Math.max(1, count - midEnd) / 255;
      const energy = (bassNorm * 0.45 + midNorm * 0.35 + trebleNorm * 0.2) * 1.1;

      const prev = audioSnapshotRef.current;
      return {
        energy: prev.energy * 0.86 + energy * 0.14,
        bass: prev.bass * 0.82 + bassNorm * 0.18,
        mid: prev.mid * 0.84 + midNorm * 0.16,
        treble: prev.treble * 0.84 + trebleNorm * 0.16
      };
    };

    const renderFrame = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const previousTime = lastTimeRef.current || time;
      const delta = Math.min(42, Math.max(8, time - previousTime));
      lastTimeRef.current = time;

      const snapshot = getAudioSnapshot(time);
      audioSnapshotRef.current = snapshot;

      renderBackgroundFrame({
        ctx,
        width,
        height,
        time,
        delta,
        audio: snapshot,
        animationId: activeAnimation,
        lowPower: isLowPower,
        seed: seedRef.current
      });

      frameRef.current = requestAnimationFrame(renderFrame);
    };

    resize();
    window.addEventListener('resize', resize);

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (shouldAnimate) {
      frameRef.current = requestAnimationFrame(renderFrame);
    } else if (isEnabled) {
      renderBackgroundFrame({
        ctx,
        width: canvas.getBoundingClientRect().width,
        height: canvas.getBoundingClientRect().height,
        time: performance.now(),
        delta: 16,
        audio: audioSnapshotRef.current,
        animationId: activeAnimation,
        lowPower: isLowPower,
        seed: seedRef.current
      });
    } else {
      ctx.clearRect(0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [activeAnimation, analyser, isEnabled, isLowPower, shouldAnimate]);

  const handleModeToggle = (enabled: boolean) => {
    if (!enabled) {
      setMode('off');
      return;
    }

    if (mode === 'manual') {
      setActiveAnimation(manualAnimation);
      return;
    }

    setMode('auto');
    setActiveAnimation(randomAnimation(activeAnimation));
  };

  const handleSelectAnimation = (value: string) => {
    if (value === 'auto') {
      setMode('auto');
      setActiveAnimation(randomAnimation(activeAnimation));
      return;
    }

    if (!isAnimationId(value)) {
      return;
    }

    setMode('manual');
    setManualAnimation(value);
    setActiveAnimation(value);
  };

  const handleShuffle = () => {
    if (mode === 'manual') {
      const next = randomAnimation(manualAnimation);
      setManualAnimation(next);
      setActiveAnimation(next);
      return;
    }

    setMode('auto');
    setActiveAnimation(randomAnimation(activeAnimation));
  };

  const selectValue = mode === 'manual' ? manualAnimation : 'auto';

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <canvas
          ref={canvasRef}
          className={cn(
            'h-full w-full transition-opacity duration-[1200ms] ease-out',
            isEnabled ? 'opacity-[0.92]' : 'opacity-0'
          )}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.24),transparent_38%),radial-gradient(circle_at_82%_6%,rgba(194,165,140,0.13),transparent_34%),linear-gradient(180deg,rgba(8,10,18,0.06),rgba(8,10,18,0.28))]" />
      </div>

      <div className="fixed bottom-4 right-4 z-30">
        <button
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          className="ui-chip-shadow rounded-full border border-white/40 bg-white/82 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/80 backdrop-blur"
          aria-expanded={panelOpen}
          aria-controls="background-panel"
        >
          Atmosphere
        </button>

        {panelOpen ? (
          <div id="background-panel" className="ui-panel mt-3 w-[320px] rounded-3xl p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink/55">Background</p>
                <h3 className="mt-1 text-base font-semibold">Visual atmosphere</h3>
              </div>
              <label className="flex items-center gap-2 text-xs text-ink/70">
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(event) => handleModeToggle(event.target.checked)}
                  aria-label="Enable animated background"
                />
              </label>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-ink/55">Scene</span>
                <select
                  value={selectValue}
                  onChange={(event) => handleSelectAnimation(event.target.value)}
                  className="ui-field w-full"
                  disabled={!isEnabled}
                >
                  <option value="auto">Random every visit</option>
                  {BACKGROUND_ANIMATION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={handleShuffle}
                className="ui-field w-full text-left"
                disabled={!isEnabled}
              >
                Shuffle scene now
              </button>

              <p className="text-xs text-ink/60">
                {activeAnimationMeta.description}
                {activeAnimationMeta.isAudioReactive ? ' Audio-reactive when playback is active.' : ''}
              </p>

              {prefersReducedMotion ? (
                <p className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Reduced-motion preference detected. Animation is paused and shown as a still scene.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
