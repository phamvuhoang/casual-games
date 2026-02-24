'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import { renderBackgroundFrame, type AudioSnapshot, type BackgroundAnimationId } from '@/components/background/animationLibrary';
import Button from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { buildBreathSyncRuntimeFrame, type BreathSyncRuntimeFrame } from '@/lib/audio/BreathSyncEngine';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import { FrequencyGenerator, type FrequencyConfig } from '@/lib/audio/FrequencyGenerator';
import { MicrophoneAnalysisService } from '@/lib/audio/MicrophoneAnalysisService';
import { createLayersForType, type VisualizationLayerConfig } from '@/lib/visualization/config';
import { isAndroidDevice, isIOSDevice } from '@/lib/utils/platform';

type BreathVisualizationGameProps = {
  prompt: string;
  allowMicHint: string;
  startLabel: string;
  retryLabel: string;
  startingLabel: string;
  listeningLabel: string;
  micDeniedMessage: string;
  micUnavailableMessage: string;
  phaseInhaleLabel: string;
  phaseExhaleLabel: string;
  breathRateLabel: string;
  coherenceLabel: string;
  rhythmLabel: string;
  frequencyLabel: string;
  sessionReadyTitle: string;
  sessionReadyBody: string;
  sessionCtaLabel: string;
};

type GameStage = 'idle' | 'starting' | 'active' | 'error';

const TARGET_BPM = 5.5;
const INHALE_RATIO = 0.45;
const BREATH_SENSITIVITY = 0.72;
const CTA_REVEAL_MS = 75_000;
const RUNTIME_TICK_MS = 320;
const BREATH_SAMPLE_INTERVAL_MS = 22_000;

const BREATH_FIELD_STACK: FrequencyConfig[] = [
  {
    frequency: 528,
    volume: 0.42,
    waveform: 'sine',
    attackSeconds: 0.22,
    releaseSeconds: 0.36
  },
  {
    frequency: 432,
    volume: 0.22,
    waveform: 'triangle',
    detuneCents: -4,
    attackSeconds: 0.24,
    releaseSeconds: 0.42
  },
  {
    frequency: 639,
    volume: 0.16,
    waveform: 'sine',
    detuneCents: 6,
    attackSeconds: 0.24,
    releaseSeconds: 0.46
  }
];

const RHYTHM_STEPS = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];

function createInitialRuntime() {
  return buildBreathSyncRuntimeFrame({
    elapsedSeconds: 0,
    breathBpm: TARGET_BPM,
    targetBpm: TARGET_BPM,
    inhaleRatio: INHALE_RATIO,
    confidence: 0.65,
    sensitivity: BREATH_SENSITIVITY
  });
}

function detectLowPower() {
  if (typeof window === 'undefined') {
    return false;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactViewport = window.matchMedia('(max-width: 900px)').matches;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return reducedMotion || compactViewport || lowCores;
}

export default function BreathVisualizationGame({
  prompt,
  allowMicHint,
  startLabel,
  retryLabel,
  startingLabel,
  listeningLabel,
  micDeniedMessage,
  micUnavailableMessage,
  phaseInhaleLabel,
  phaseExhaleLabel,
  breathRateLabel,
  coherenceLabel,
  rhythmLabel,
  frequencyLabel,
  sessionReadyTitle,
  sessionReadyBody,
  sessionCtaLabel
}: BreathVisualizationGameProps) {
  const [stage, setStage] = useState<GameStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [runtime, setRuntime] = useState<BreathSyncRuntimeFrame>(() => createInitialRuntime());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showSessionCta, setShowSessionCta] = useState(false);
  const [isSamplingBreath, setIsSamplingBreath] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const seedRef = useRef(Math.random() * 1000 + (Date.now() % 1000));
  const audioDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const audioSnapshotRef = useRef<AudioSnapshot>({ energy: 0.08, bass: 0.08, mid: 0.08, treble: 0.08 });

  const generatorRef = useRef(new FrequencyGenerator());
  const liveMicRef = useRef(new MicrophoneAnalysisService());
  const breathSamplerRef = useRef(new MicrophoneAnalysisService());
  const runtimeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleInFlightRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);
  const breathBpmRef = useRef(TARGET_BPM);
  const confidenceRef = useRef(0.65);
  const isMountedRef = useRef(true);

  const layers = useMemo<VisualizationLayerConfig[]>(() => {
    const sourceLayers = createLayersForType('multi-layer');
    return sourceLayers.map((layer, index) => ({
      ...layer,
      colorA: index === 0 ? '#6a92c2' : '#8f7adb',
      colorB: index === 0 ? '#b9ccc4' : '#eee0d1',
      colorC: '#172034',
      intensity: Math.min(1.2, layer.intensity + 0.12),
      opacity: index === 0 ? 0.9 : 0.75
    }));
  }, []);

  const backgroundAnimation = useMemo<BackgroundAnimationId>(() => {
    if (stage !== 'active') {
      return 'gradient_flow';
    }
    if (runtime.coherenceScore >= 0.72) {
      return 'starlit_bloom';
    }
    return runtime.phase === 'inhale' ? 'aurora_veil' : 'ripple_pulse';
  }, [runtime.coherenceScore, runtime.phase, stage]);

  const resetSessionState = useCallback(() => {
    sessionStartRef.current = null;
    breathBpmRef.current = TARGET_BPM;
    confidenceRef.current = 0.65;
    setRuntime(createInitialRuntime());
    setElapsedSeconds(0);
    setShowSessionCta(false);
    setIsSamplingBreath(false);
  }, []);

  const clearTimers = useCallback(() => {
    if (runtimeTimerRef.current) {
      clearInterval(runtimeTimerRef.current);
      runtimeTimerRef.current = null;
    }
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
  }, []);

  const sampleBreath = useCallback(async () => {
    if (!sessionStartRef.current || sampleInFlightRef.current) {
      return;
    }

    sampleInFlightRef.current = true;
    if (isMountedRef.current) {
      setIsSamplingBreath(true);
    }

    try {
      const pattern = await breathSamplerRef.current.captureAmplitudePattern({
        durationMs: 6500,
        sampleIntervalMs: 95,
        fftSize: 1024
      });

      const confidenceThreshold = 0.18;
      if (
        typeof pattern.estimatedBreathBpm === 'number' &&
        Number.isFinite(pattern.estimatedBreathBpm) &&
        pattern.confidence >= confidenceThreshold
      ) {
        breathBpmRef.current = pattern.estimatedBreathBpm;
        confidenceRef.current = pattern.confidence;
      } else {
        confidenceRef.current = Math.max(0.16, confidenceRef.current * 0.9);
      }
    } catch (error) {
      console.warn('Breath sampling failed.', error);
    } finally {
      await breathSamplerRef.current.stop();
      sampleInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsSamplingBreath(false);
      }
    }
  }, []);

  const startExperience = useCallback(async () => {
    if (stage === 'starting') {
      return;
    }

    clearTimers();
    resetSessionState();
    setErrorMessage(null);
    setStage('starting');

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('MICROPHONE_UNAVAILABLE');
      }

      const liveAnalyser = await liveMicRef.current.start({
        fftSize: 2048,
        smoothingTimeConstant: 0.75
      });

      const shouldEnableBridge = isIOSDevice() || isAndroidDevice();
      await generatorRef.current.initialize(DEFAULT_EFFECTS, {
        enableAudioBridge: shouldEnableBridge
      });
      generatorRef.current.setMasterVolume(0.44);
      generatorRef.current.setRhythmPattern({
        enabled: false,
        bpm: 66,
        subdivision: '16n',
        steps: RHYTHM_STEPS
      });
      generatorRef.current.setAutomation({
        modulation: {
          enabled: true,
          rateHz: 0.09,
          depthHz: 2.6,
          waveform: 'sine'
        },
        sweep: {
          enabled: false,
          targetHz: 528,
          durationSeconds: 18,
          curve: 'easeInOut'
        }
      });
      generatorRef.current.play(BREATH_FIELD_STACK);

      sessionStartRef.current = performance.now();
      setAnalyser(liveAnalyser);
      setStage('active');

      const initial = createInitialRuntime();
      setRuntime(initial);
      generatorRef.current.applyBreathControl({
        phase: initial.phase,
        phaseProgress: initial.phaseProgress,
        coherenceScore: initial.coherenceScore,
        gainScale: initial.gainScale
      });

      void sampleBreath();
      sampleTimerRef.current = setInterval(() => {
        void sampleBreath();
      }, BREATH_SAMPLE_INTERVAL_MS);

      runtimeTimerRef.current = setInterval(() => {
        if (!sessionStartRef.current) {
          return;
        }

        const elapsed = Math.max(0, (performance.now() - sessionStartRef.current) / 1000);
        const frame = buildBreathSyncRuntimeFrame({
          elapsedSeconds: elapsed,
          breathBpm: breathBpmRef.current,
          targetBpm: TARGET_BPM,
          inhaleRatio: INHALE_RATIO,
          confidence: confidenceRef.current,
          sensitivity: BREATH_SENSITIVITY
        });

        setRuntime(frame);
        setElapsedSeconds(Math.floor(elapsed));
        if (elapsed * 1000 >= CTA_REVEAL_MS) {
          setShowSessionCta(true);
        }

        generatorRef.current.applyBreathControl({
          phase: frame.phase,
          phaseProgress: frame.phaseProgress,
          coherenceScore: frame.coherenceScore,
          gainScale: frame.gainScale
        });
      }, RUNTIME_TICK_MS);
    } catch (error) {
      clearTimers();
      resetSessionState();
      generatorRef.current.stop();
      setAnalyser(null);
      await liveMicRef.current.stop();
      await breathSamplerRef.current.stop();

      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setErrorMessage(micDeniedMessage);
      } else if (error instanceof Error && error.message === 'MICROPHONE_UNAVAILABLE') {
        setErrorMessage(micUnavailableMessage);
      } else {
        setErrorMessage(micUnavailableMessage);
      }
      setStage('error');
    }
  }, [clearTimers, micDeniedMessage, micUnavailableMessage, resetSessionState, sampleBreath, stage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const refresh = () => {
      setIsLowPower(detectLowPower());
    };

    refresh();
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimers();
      sampleInFlightRef.current = false;
      sessionStartRef.current = null;
      generatorRef.current.stop();
      generatorRef.current.dispose();
      void liveMicRef.current.stop();
      void breathSamplerRef.current.stop();
    };
  }, [clearTimers]);

  useEffect(() => {
    const canvas = backgroundCanvasRef.current;
    const host = containerRef.current;
    if (!canvas || !host) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const ratio = isLowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
    };

    const getAudioSnapshot = (time: number): AudioSnapshot => {
      if (!analyser) {
        const drift = 0.06 + Math.sin(time * 0.0006) * 0.02;
        return {
          energy: drift,
          bass: 0.07 + Math.sin(time * 0.00042) * 0.02,
          mid: 0.06 + Math.cos(time * 0.00052) * 0.02,
          treble: 0.06 + Math.sin(time * 0.00048 + 0.9) * 0.02
        };
      }

      if (!audioDataRef.current || audioDataRef.current.length !== analyser.frequencyBinCount) {
        audioDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }

      analyser.getByteFrequencyData(audioDataRef.current);
      const values = audioDataRef.current;
      const count = values.length;
      const bassEnd = Math.max(1, Math.floor(count * 0.12));
      const midEnd = Math.max(bassEnd + 1, Math.floor(count * 0.46));

      let bass = 0;
      let mid = 0;
      let treble = 0;

      for (let index = 0; index < bassEnd; index += 1) {
        bass += values[index];
      }
      for (let index = bassEnd; index < midEnd; index += 1) {
        mid += values[index];
      }
      for (let index = midEnd; index < count; index += 1) {
        treble += values[index];
      }

      const bassNorm = bass / Math.max(1, bassEnd) / 255;
      const midNorm = mid / Math.max(1, midEnd - bassEnd) / 255;
      const trebleNorm = treble / Math.max(1, count - midEnd) / 255;
      const energy = bassNorm * 0.45 + midNorm * 0.35 + trebleNorm * 0.2;

      const prev = audioSnapshotRef.current;
      return {
        energy: prev.energy * 0.86 + energy * 0.14,
        bass: prev.bass * 0.82 + bassNorm * 0.18,
        mid: prev.mid * 0.84 + midNorm * 0.16,
        treble: prev.treble * 0.84 + trebleNorm * 0.16
      };
    };

    const render = (time: number) => {
      const rect = host.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const previousTime = lastTimeRef.current || time;
      const delta = Math.max(8, Math.min(42, time - previousTime));
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
        animationId: backgroundAnimation,
        lowPower: isLowPower,
        seed: seedRef.current
      });

      frameRef.current = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    frameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [analyser, backgroundAnimation, isLowPower]);

  const phaseLabel = runtime.phase === 'inhale' ? phaseInhaleLabel : phaseExhaleLabel;
  const sessionMinutes = Math.floor(elapsedSeconds / 60);
  const sessionSeconds = elapsedSeconds % 60;

  return (
    <section
      ref={containerRef}
      className="relative isolate overflow-hidden rounded-[2.4rem] border border-white/45 bg-gradient-to-b from-mist/72 via-white/58 to-dawn/62 shadow-halo"
    >
      <canvas ref={backgroundCanvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(106,146,194,0.24),transparent_42%),radial-gradient(circle_at_78%_14%,rgba(238,224,209,0.34),transparent_48%),radial-gradient(circle_at_68%_78%,rgba(185,204,196,0.3),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/8" />

      <div className="relative z-10 flex min-h-[70vh] flex-col gap-4 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/60">{frequencyLabel}</p>
          <h2 className="mt-2 text-[1.9rem] font-semibold leading-tight sm:text-[2.55rem]">{prompt}</h2>
          <p className="mt-2 text-sm text-ink/72 sm:text-base">{allowMicHint}</p>
        </div>

        <WaveformVisualizer
          analyser={analyser}
          type="multi-layer"
          layers={layers}
          isActive={stage === 'active'}
          breathGuide={
            stage === 'active'
              ? {
                  phase: runtime.phase,
                  phaseProgress: runtime.phaseProgress,
                  coherenceScore: runtime.coherenceScore,
                  breathBpm: runtime.breathBpm,
                  targetBpm: runtime.targetBpm
                }
              : null
          }
          className="h-[54vh] min-h-[340px] border-white/25 bg-black/14 md:h-[58vh]"
        />

        <div className="grid gap-3 rounded-3xl border border-white/45 bg-white/60 p-4 text-center backdrop-blur-sm sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink/58">{breathRateLabel}</p>
            <p className="mt-1 text-xl font-semibold text-ink/92">{runtime.breathBpm.toFixed(1)} BPM</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink/58">{coherenceLabel}</p>
            <p className="mt-1 text-xl font-semibold text-ink/92">{Math.round(runtime.coherenceScore * 100)}%</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink/58">{rhythmLabel}</p>
            <p className="mt-1 text-xl font-semibold text-ink/92">{phaseLabel}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pb-1">
          {stage === 'idle' || stage === 'error' ? (
            <Button onClick={() => void startExperience()} size="lg">
              {stage === 'error' ? retryLabel : startLabel}
            </Button>
          ) : null}

          {stage === 'starting' ? <p className="text-sm text-ink/76">{startingLabel}</p> : null}

          {stage === 'active' ? (
            <p className="text-sm text-ink/76">
              {listeningLabel}
              {isSamplingBreath ? ' • …' : ''}
            </p>
          ) : null}

          {stage === 'active' ? (
            <p className="text-xs uppercase tracking-[0.2em] text-ink/58">
              {String(sessionMinutes).padStart(2, '0')}:{String(sessionSeconds).padStart(2, '0')}
            </p>
          ) : null}

          {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}
        </div>

        {showSessionCta && stage === 'active' ? (
          <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/50 bg-white/66 p-5 text-center backdrop-blur-sm">
            <p className="text-base font-semibold text-ink/92">{sessionReadyTitle}</p>
            <p className="mt-2 text-sm text-ink/72">{sessionReadyBody}</p>
            <div className="mt-4">
              <Button asChild size="lg">
                <Link href="/create">{sessionCtaLabel}</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
