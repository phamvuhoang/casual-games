'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Button from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import LivingMirrorField, { type LivingMirrorMode } from '@/components/breath/LivingMirrorField';
import {
  buildBreathSyncRuntimeFrame,
  type BreathSyncRuntimeFrame
} from '@/lib/audio/BreathSyncEngine';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import { FrequencyGenerator, type FrequencyConfig } from '@/lib/audio/FrequencyGenerator';
import { MicrophoneAnalysisService } from '@/lib/audio/MicrophoneAnalysisService';
import { isAndroidDevice, isIOSDevice } from '@/lib/utils/platform';
import {
  analyzeSomaticTrace,
  buildSomaticTraceSession,
  resolveSomaticTraceRuntime,
  type SomaticTracePoint,
  type SomaticTraceSession
} from '@/lib/audio/SomaticTraceEngine';
import {
  renderBackgroundFrame,
  type AudioSnapshot,
  type BackgroundAnimationId
} from '@/components/background/animationLibrary';
import type {
  BreathGuideOverlayData,
  SomaticTraceOverlayData
} from '@/components/audio/visualizationSessionOverlay';

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
  stopControlLabel: string;
  stopControlHint: string;
  stopControlProgressHint: string;
  stopControlCompleting: string;
  sessionReadyTitle: string;
  sessionReadyBody: string;
  somaticSessionReadyTitle: string;
  somaticSessionReadyBody: string;
  sessionCtaLabel: string;
};

type GameStage = 'idle' | 'starting' | 'active' | 'error';

const TARGET_BPM = 5.5;
const INHALE_RATIO = 0.45;
const BREATH_SENSITIVITY = 0.72;
const CTA_REVEAL_MS = 75_000;
const RUNTIME_TICK_MS = 320;
const BREATH_SAMPLE_INTERVAL_MS = 22_000;
const HOLD_TO_STOP_MS = 1_250;
const HOLD_TO_STOP_TICK_MS = 16;

const SOMATIC_MIN_POINTS = 6;
const SOMATIC_MIN_DURATION_MS = 850;

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

const RHYTHM_STEPS = [
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
  true,
  false
];

function clampValue(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function toRelativeTrace(points: SomaticTracePoint[]) {
  if (points.length === 0) {
    return points;
  }

  const start = points[0].t;
  return points.map((point) => ({
    x: clampValue(0, point.x, 1),
    y: clampValue(0, point.y, 1),
    t: Math.max(0, point.t - start),
    pressure: typeof point.pressure === 'number' ? clampValue(0, point.pressure, 1) : undefined
  }));
}

function createFallbackSomaticSession(seed = Date.now()) {
  const points: SomaticTracePoint[] = [];
  const total = 96;

  for (let index = 0; index < total; index += 1) {
    const progress = index / Math.max(1, total - 1);
    const angle = progress * Math.PI * 4.8;
    const wobble = Math.sin(progress * 8 + (seed % 1000) * 0.001) * 0.02;
    const radius = 0.14 + progress * 0.2 + wobble;

    points.push({
      x: clampValue(0, 0.5 + Math.cos(angle) * radius, 1),
      y: clampValue(0, 0.5 + Math.sin(angle) * radius, 1),
      t: index * 48,
      pressure: clampValue(0, 0.5 + Math.sin(progress * 10) * 0.2, 1)
    });
  }

  const analysis = analyzeSomaticTrace(points);
  return buildSomaticTraceSession(analysis);
}

function lookupFrequencyGain(session: SomaticTraceSession, frequency: number, index: number) {
  const direct = session.frequencyVolumes[frequency.toString()];
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return clampValue(0.12, direct, 1);
  }

  const rounded = Number(frequency.toFixed(2));
  for (const [key, value] of Object.entries(session.frequencyVolumes)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }

    const parsed = Number(key);
    if (Number.isFinite(parsed) && Math.abs(parsed - rounded) < 0.05) {
      return clampValue(0.12, value, 1);
    }
  }

  return clampValue(0.14, 0.58 - index * 0.1 + session.metrics.coherenceScore * 0.18, 0.92);
}

function buildSomaticFrequencyStack(session: SomaticTraceSession): FrequencyConfig[] {
  const values = session.selectedFrequencies.length > 0 ? session.selectedFrequencies : [396, 432, 528];
  return values.map((frequency, index) => ({
    frequency,
    volume: lookupFrequencyGain(session, frequency, index),
    waveform: session.waveform,
    attackSeconds: clampValue(0.08, 0.18 + session.metrics.coherenceScore * 0.16, 0.42),
    releaseSeconds: clampValue(0.2, 0.34 + session.metrics.tensionScore * 0.28, 0.82),
    detuneCents: index % 2 === 0 ? 0 : (session.metrics.directionChangeRatio - 0.3) * 18
  }));
}

function buildTracePreviewOverlay(points: SomaticTracePoint[]): SomaticTraceOverlayData | null {
  if (points.length < 2) {
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const duration = Math.max(1, last.t - first.t);

  const stride = Math.max(1, Math.floor(points.length / 180));
  const previewPoints: Array<{ x: number; y: number; energy: number }> = [];
  let speedAccumulator = 0;
  let speedCount = 0;
  let turnAccumulator = 0;
  let turnCount = 0;

  for (let index = 0; index < points.length; index += stride) {
    const current = points[index];
    const previous = points[Math.max(0, index - 1)] ?? current;
    const dt = Math.max(1, current.t - previous.t);
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const speed = distance / dt;
    const pressure = typeof current.pressure === 'number' ? current.pressure : 0.5;

    speedAccumulator += speed;
    speedCount += 1;

    if (index > 0 && index < points.length - 1) {
      const next = points[index + 1] ?? current;
      const ax = current.x - previous.x;
      const ay = current.y - previous.y;
      const bx = next.x - current.x;
      const by = next.y - current.y;
      const magA = Math.hypot(ax, ay);
      const magB = Math.hypot(bx, by);
      if (magA > 0.00001 && magB > 0.00001) {
        const dot = clampValue(-1, (ax * bx + ay * by) / (magA * magB), 1);
        turnAccumulator += Math.acos(dot) / Math.PI;
        turnCount += 1;
      }
    }

    previewPoints.push({
      x: clampValue(0, current.x, 1),
      y: clampValue(0, current.y, 1),
      energy: clampValue(0.08, speed * 350 + pressure * 0.42, 1)
    });
  }

  const averageSpeed = speedAccumulator / Math.max(1, speedCount);
  const averageTurn = turnAccumulator / Math.max(1, turnCount);
  const tension = clampValue(0.14, averageSpeed * 210 + averageTurn * 0.72, 0.94);
  const coherence = clampValue(0.08, 1 - tension * 0.68, 0.96);
  const phaseProgress = clampValue(0, duration / 7000, 1);

  return {
    phase: 'mirror',
    phaseProgress,
    overallProgress: clampValue(0, phaseProgress * 0.42, 1),
    tension,
    coherence,
    points: previewPoints
  };
}

function formatSomaticPhase(phase: SomaticTraceOverlayData['phase']) {
  if (phase === 'mirror') {
    return 'MIRROR';
  }
  if (phase === 'release') {
    return 'RELEASE';
  }
  return 'COMPLETE';
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
  stopControlLabel,
  stopControlHint,
  stopControlProgressHint,
  stopControlCompleting,
  sessionReadyTitle,
  sessionReadyBody,
  somaticSessionReadyTitle,
  somaticSessionReadyBody,
  sessionCtaLabel
}: BreathVisualizationGameProps) {
  const [stage, setStage] = useState<GameStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [runtime, setRuntime] = useState<BreathSyncRuntimeFrame>(() => createInitialRuntime());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showSessionCta, setShowSessionCta] = useState(false);
  const [showSomaticSessionCta, setShowSomaticSessionCta] = useState(false);
  const [isSamplingBreath, setIsSamplingBreath] = useState(false);
  const [stopHoldProgress, setStopHoldProgress] = useState(0);
  const [isLowPower, setIsLowPower] = useState(false);

  const [mode, setMode] = useState<LivingMirrorMode>('breath');
  const [somaticSession, setSomaticSession] = useState<SomaticTraceSession | null>(null);
  const [somaticOverlay, setSomaticOverlay] = useState<SomaticTraceOverlayData | null>(null);
  const [tracePreviewOverlay, setTracePreviewOverlay] = useState<SomaticTraceOverlayData | null>(null);
  const [tracePointCount, setTracePointCount] = useState(0);
  const [isTracing, setIsTracing] = useState(false);
  const [somaticStatus, setSomaticStatus] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const fieldSurfaceRef = useRef<HTMLDivElement>(null);

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
  const stopHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sampleInFlightRef = useRef(false);
  const stopHoldStartRef = useRef<number | null>(null);
  const stopHoldTriggeredRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);

  const breathBpmRef = useRef(TARGET_BPM);
  const confidenceRef = useRef(0.65);
  const isMountedRef = useRef(true);

  const modeRef = useRef<LivingMirrorMode>(mode);
  const somaticSessionRef = useRef<SomaticTraceSession | null>(somaticSession);
  const somaticAudioPhaseRef = useRef<'mirror' | 'release' | null>(null);
  const somaticCompleteAppliedRef = useRef(false);
  const isTracingRef = useRef(false);

  const tracePointsRef = useRef<SomaticTracePoint[]>([]);
  const tracePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    somaticSessionRef.current = somaticSession;
  }, [somaticSession]);

  useEffect(() => {
    isTracingRef.current = isTracing;
  }, [isTracing]);

  const activeSomaticOverlay = useMemo(() => {
    if (stage === 'active' && mode === 'somatic' && somaticOverlay) {
      return somaticOverlay;
    }

    if (isTracing && tracePreviewOverlay) {
      return tracePreviewOverlay;
    }

    return somaticOverlay ?? tracePreviewOverlay;
  }, [isTracing, mode, somaticOverlay, stage, tracePreviewOverlay]);

  const backgroundAnimation = useMemo<BackgroundAnimationId>(() => {
    if (stage !== 'active') {
      return mode === 'somatic' ? 'ethereal_shadow' : 'gradient_flow';
    }

    if (mode === 'somatic') {
      if (!activeSomaticOverlay) {
        return 'aurora_veil';
      }

      if (activeSomaticOverlay.phase === 'mirror') {
        return activeSomaticOverlay.tension > 0.56 ? 'psychedelic_spiral' : 'aurora_veil';
      }

      if (activeSomaticOverlay.coherence >= 0.78) {
        return 'starlit_bloom';
      }

      return 'ripple_pulse';
    }

    if (runtime.coherenceScore >= 0.72) {
      return 'starlit_bloom';
    }

    return runtime.phase === 'inhale' ? 'aurora_veil' : 'ripple_pulse';
  }, [activeSomaticOverlay, mode, runtime.coherenceScore, runtime.phase, stage]);

  const ensureSomaticSession = useCallback(() => {
    if (somaticSessionRef.current) {
      return somaticSessionRef.current;
    }

    const fallback = createFallbackSomaticSession();
    somaticSessionRef.current = fallback;
    setSomaticSession(fallback);
    setSomaticOverlay(resolveSomaticTraceRuntime(fallback, 0).overlay);
    setSomaticStatus('Trace ready. Draw to personalize further.');
    return fallback;
  }, []);

  const applySomaticRuntimeAudio = useCallback(
    (session: SomaticTraceSession, phase: SomaticTraceOverlayData['phase'], force = false) => {
      const nextPhase = phase === 'mirror' ? 'mirror' : 'release';
      if (!force && somaticAudioPhaseRef.current === nextPhase) {
        return;
      }

      const phaseConfig = nextPhase === 'mirror' ? session.mirror : session.release;
      generatorRef.current.setRhythmPattern({
        ...phaseConfig.rhythm,
        steps: [...phaseConfig.rhythm.steps]
      });
      generatorRef.current.setAutomation({
        modulation: { ...phaseConfig.modulation },
        sweep: { ...phaseConfig.sweep }
      });
      somaticAudioPhaseRef.current = nextPhase;
    },
    []
  );

  const configurePlaybackForMode = useCallback(
    (nextMode: LivingMirrorMode) => {
      if (nextMode === 'breath') {
        somaticCompleteAppliedRef.current = false;
        somaticAudioPhaseRef.current = null;
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
        return;
      }

      const session = ensureSomaticSession();
      const previewRuntime = resolveSomaticTraceRuntime(session, 0);
      somaticCompleteAppliedRef.current = false;
      generatorRef.current.play(buildSomaticFrequencyStack(session));
      applySomaticRuntimeAudio(session, previewRuntime.phase, true);
      setSomaticOverlay(previewRuntime.overlay);
    },
    [applySomaticRuntimeAudio, ensureSomaticSession]
  );

  const resetSessionState = useCallback(() => {
    sessionStartRef.current = null;
    breathBpmRef.current = TARGET_BPM;
    confidenceRef.current = 0.65;
    setRuntime(createInitialRuntime());
    setElapsedSeconds(0);
    setShowSessionCta(false);
    setShowSomaticSessionCta(false);
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

  const clearStopHoldTimer = useCallback(() => {
    if (stopHoldTimerRef.current) {
      clearInterval(stopHoldTimerRef.current);
      stopHoldTimerRef.current = null;
    }
  }, []);

  const cancelStopHold = useCallback(
    (resetProgress = true) => {
      clearStopHoldTimer();
      stopHoldStartRef.current = null;
      stopHoldTriggeredRef.current = false;
      if (resetProgress) {
        setStopHoldProgress(0);
      }
    },
    [clearStopHoldTimer]
  );

  const stopExperience = useCallback(async () => {
    cancelStopHold();
    clearTimers();
    sampleInFlightRef.current = false;
    sessionStartRef.current = null;

    generatorRef.current.stop();
    setAnalyser(null);
    resetSessionState();
    setErrorMessage(null);
    setStage('idle');

    await Promise.all([liveMicRef.current.stop(), breathSamplerRef.current.stop()]);
    somaticAudioPhaseRef.current = null;
    somaticCompleteAppliedRef.current = false;

    if (modeRef.current === 'somatic' && somaticSessionRef.current) {
      setSomaticOverlay(resolveSomaticTraceRuntime(somaticSessionRef.current, 0).overlay);
    }
  }, [cancelStopHold, clearTimers, resetSessionState]);

  const beginStopHold = useCallback(() => {
    if (stage !== 'active' || stopHoldTimerRef.current) {
      return;
    }

    stopHoldTriggeredRef.current = false;
    stopHoldStartRef.current = performance.now();
    setStopHoldProgress(0);

    stopHoldTimerRef.current = setInterval(() => {
      if (!stopHoldStartRef.current) {
        return;
      }

      const progress = Math.min(1, (performance.now() - stopHoldStartRef.current) / HOLD_TO_STOP_MS);
      setStopHoldProgress(progress);

      if (progress >= 1 && !stopHoldTriggeredRef.current) {
        stopHoldTriggeredRef.current = true;
        clearStopHoldTimer();
        void stopExperience();
      }
    }, HOLD_TO_STOP_TICK_MS);
  }, [clearStopHoldTimer, stage, stopExperience]);

  const endStopHold = useCallback(() => {
    if (stopHoldTriggeredRef.current) {
      return;
    }
    cancelStopHold();
  }, [cancelStopHold]);

  const sampleBreath = useCallback(async () => {
    if (!sessionStartRef.current || sampleInFlightRef.current || modeRef.current !== 'breath') {
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

    cancelStopHold();
    clearTimers();
    resetSessionState();
    setErrorMessage(null);
    setStage('starting');

    const currentMode = modeRef.current;

    try {
      if (currentMode === 'breath') {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('MICROPHONE_UNAVAILABLE');
        }

        await liveMicRef.current.start({
          fftSize: 2048,
          smoothingTimeConstant: 0.75
        });
      } else {
        await liveMicRef.current.stop();
      }

      const shouldEnableBridge = isIOSDevice() || isAndroidDevice();
      await generatorRef.current.initialize(DEFAULT_EFFECTS, {
        enableAudioBridge: shouldEnableBridge
      });
      generatorRef.current.setMasterVolume(0.44);

      configurePlaybackForMode(currentMode);
      setAnalyser(generatorRef.current.getAnalyser());
      somaticCompleteAppliedRef.current = false;

      sessionStartRef.current = performance.now();
      setStage('active');

      if (currentMode === 'breath') {
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
      } else {
        const session = ensureSomaticSession();
        const initialRuntime = resolveSomaticTraceRuntime(session, 0);
        applySomaticRuntimeAudio(session, initialRuntime.phase, true);
        setSomaticOverlay(initialRuntime.overlay);
        setSomaticStatus('Mirror phase active');

        generatorRef.current.applyBreathControl({
          phase: 'inhale',
          phaseProgress: initialRuntime.phaseProgress,
          coherenceScore: initialRuntime.overlay.coherence,
          gainScale: clampValue(0.78, 0.9 + initialRuntime.overlay.coherence * 0.2, 1.24)
        });
      }

      runtimeTimerRef.current = setInterval(() => {
        if (!sessionStartRef.current) {
          return;
        }

        const elapsedMs = Math.max(0, performance.now() - sessionStartRef.current);

        if (modeRef.current === 'breath') {
          const elapsedSeconds = elapsedMs / 1000;
          const frame = buildBreathSyncRuntimeFrame({
            elapsedSeconds,
            breathBpm: breathBpmRef.current,
            targetBpm: TARGET_BPM,
            inhaleRatio: INHALE_RATIO,
            confidence: confidenceRef.current,
            sensitivity: BREATH_SENSITIVITY
          });

          setRuntime(frame);
          setElapsedSeconds(Math.floor(elapsedSeconds));

          generatorRef.current.applyBreathControl({
            phase: frame.phase,
            phaseProgress: frame.phaseProgress,
            coherenceScore: frame.coherenceScore,
            gainScale: frame.gainScale
          });

          if (elapsedMs >= CTA_REVEAL_MS) {
            setShowSessionCta(true);
          }
        } else {
          const session = ensureSomaticSession();
          const nextRuntime = resolveSomaticTraceRuntime(session, elapsedMs);
          applySomaticRuntimeAudio(session, nextRuntime.phase);

          if (nextRuntime.phase === 'complete') {
            if (!somaticCompleteAppliedRef.current) {
              somaticCompleteAppliedRef.current = true;
              setSomaticOverlay(nextRuntime.overlay);
              setElapsedSeconds(Math.floor(elapsedMs / 1000));

              const completeGain = clampValue(
                0.78,
                0.88 + nextRuntime.overlay.coherence * 0.22 - nextRuntime.overlay.tension * 0.14,
                1.24
              );

              generatorRef.current.applyBreathControl({
                phase: 'exhale',
                phaseProgress: 1,
                coherenceScore: nextRuntime.overlay.coherence,
                gainScale: completeGain
              });
              setSomaticStatus('Session complete');
              setShowSomaticSessionCta(true);
            }
          } else {
            somaticCompleteAppliedRef.current = false;
            setShowSomaticSessionCta(false);
            setSomaticOverlay(nextRuntime.overlay);
            setElapsedSeconds(Math.floor(elapsedMs / 1000));

            const phaseArc =
              nextRuntime.phase === 'mirror'
                ? nextRuntime.phaseProgress
                : nextRuntime.phase === 'release'
                  ? 1 - nextRuntime.phaseProgress
                  : 0;
            const gainScale = clampValue(
              0.78,
              0.88 + nextRuntime.overlay.coherence * 0.22 - nextRuntime.overlay.tension * 0.14 + phaseArc * 0.08,
              1.24
            );

            generatorRef.current.applyBreathControl({
              phase: nextRuntime.phase === 'release' ? 'exhale' : 'inhale',
              phaseProgress: nextRuntime.phaseProgress,
              coherenceScore: nextRuntime.overlay.coherence,
              gainScale
            });

            if (nextRuntime.phase === 'mirror') {
              setSomaticStatus('Mirror phase active');
            } else {
              setSomaticStatus('Release phase active');
            }
          }
        }
      }, RUNTIME_TICK_MS);
    } catch (error) {
      clearTimers();
      resetSessionState();
      generatorRef.current.stop();
      setAnalyser(null);
      await liveMicRef.current.stop();
      await breathSamplerRef.current.stop();

      if (currentMode === 'breath' && error instanceof DOMException && error.name === 'NotAllowedError') {
        setErrorMessage(micDeniedMessage);
      } else if (currentMode === 'breath' && error instanceof Error && error.message === 'MICROPHONE_UNAVAILABLE') {
        setErrorMessage(micUnavailableMessage);
      } else {
        setErrorMessage('Unable to start audio. Please retry.');
      }
      setStage('error');
    }
  }, [
    cancelStopHold,
    clearTimers,
    applySomaticRuntimeAudio,
    configurePlaybackForMode,
    ensureSomaticSession,
    micDeniedMessage,
    micUnavailableMessage,
    resetSessionState,
    sampleBreath,
    stage
  ]);

  useEffect(() => {
    if (stage !== 'active') {
      return;
    }

    if (mode === 'breath') {
      setShowSomaticSessionCta(false);
      configurePlaybackForMode('breath');
      const initial = createInitialRuntime();
      setRuntime(initial);
      generatorRef.current.applyBreathControl({
        phase: initial.phase,
        phaseProgress: initial.phaseProgress,
        coherenceScore: initial.coherenceScore,
        gainScale: initial.gainScale
      });
      void sampleBreath();

      if (sampleTimerRef.current) {
        clearInterval(sampleTimerRef.current);
      }
      sampleTimerRef.current = setInterval(() => {
        void sampleBreath();
      }, BREATH_SAMPLE_INTERVAL_MS);
      return;
    }

    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    setIsSamplingBreath(false);
    setShowSomaticSessionCta(false);

    configurePlaybackForMode('somatic');
    const session = ensureSomaticSession();
    const previewRuntime = resolveSomaticTraceRuntime(session, 0);
    somaticCompleteAppliedRef.current = false;
    setSomaticOverlay(previewRuntime.overlay);
    setSomaticStatus('Mirror phase active');
    sessionStartRef.current = performance.now();
  }, [configurePlaybackForMode, ensureSomaticSession, mode, sampleBreath, stage]);

  const toTracePoint = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const host = fieldSurfaceRef.current;
    if (!host) {
      return null;
    }

    const rect = host.getBoundingClientRect();
    const x = clampValue(0, (event.clientX - rect.left) / Math.max(1, rect.width), 1);
    const y = clampValue(0, (event.clientY - rect.top) / Math.max(1, rect.height), 1);

    return {
      x,
      y,
      t: performance.now(),
      pressure: Number.isFinite(event.pressure) ? clampValue(0, event.pressure, 1) : undefined
    } satisfies SomaticTracePoint;
  }, []);

  const finishTrace = useCallback(
    (event?: ReactPointerEvent<HTMLDivElement>) => {
      if (event && tracePointerIdRef.current !== null && event.currentTarget.releasePointerCapture) {
        try {
          event.currentTarget.releasePointerCapture(tracePointerIdRef.current);
        } catch {
          // no-op
        }
      }

      if (!isTracingRef.current) {
        tracePointerIdRef.current = null;
        return;
      }

      setIsTracing(false);
      isTracingRef.current = false;
      tracePointerIdRef.current = null;

      const captured = [...tracePointsRef.current];
      if (captured.length < SOMATIC_MIN_POINTS) {
        setSomaticStatus('Draw a little longer to map your trace.');
        return;
      }

      const relative = toRelativeTrace(captured);
      const durationMs = relative[relative.length - 1]?.t ?? 0;
      if (durationMs < SOMATIC_MIN_DURATION_MS) {
        setSomaticStatus('Keep tracing for at least a second to map your session.');
        return;
      }

      const analysis = analyzeSomaticTrace(relative);
      const session = buildSomaticTraceSession(analysis);
      const previewRuntime = resolveSomaticTraceRuntime(session, 0);

      setSomaticSession(session);
      somaticSessionRef.current = session;
      setSomaticOverlay(previewRuntime.overlay);
      setTracePreviewOverlay(previewRuntime.overlay);
      setSomaticStatus(
        `Mapped · Tension ${Math.round(session.metrics.tensionScore * 100)}% · Coherence ${Math.round(session.metrics.coherenceScore * 100)}%`
      );
      setShowSomaticSessionCta(false);

      if (stage === 'active') {
        configurePlaybackForMode('somatic');
        applySomaticRuntimeAudio(session, previewRuntime.phase, true);
        somaticCompleteAppliedRef.current = false;
        generatorRef.current.applyBreathControl({
          phase: 'inhale',
          phaseProgress: previewRuntime.phaseProgress,
          coherenceScore: previewRuntime.overlay.coherence,
          gainScale: clampValue(0.78, 0.88 + previewRuntime.overlay.coherence * 0.22, 1.24)
        });
        sessionStartRef.current = performance.now();
      }
    },
    [applySomaticRuntimeAudio, configurePlaybackForMode, stage]
  );

  const handleFieldPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      const point = toTracePoint(event);
      if (!point) {
        return;
      }

      setMode('somatic');
      modeRef.current = 'somatic';
      setErrorMessage(null);
      setSomaticStatus('Tracing live…');
      setShowSomaticSessionCta(false);

      tracePointsRef.current = [point];
      setTracePointCount(1);
      setTracePreviewOverlay(buildTracePreviewOverlay(tracePointsRef.current));

      tracePointerIdRef.current = event.pointerId;
      isTracingRef.current = true;
      setIsTracing(true);

      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
    },
    [toTracePoint]
  );

  const handleFieldPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isTracingRef.current || tracePointerIdRef.current !== event.pointerId) {
        return;
      }

      const point = toTracePoint(event);
      if (!point) {
        return;
      }

      const previous = tracePointsRef.current[tracePointsRef.current.length - 1];
      if (previous) {
        const deltaTime = point.t - previous.t;
        const deltaDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
        if (deltaTime < 8 && deltaDistance < 0.0025) {
          return;
        }
      }

      tracePointsRef.current.push(point);
      setTracePointCount(tracePointsRef.current.length);
      setTracePreviewOverlay(buildTracePreviewOverlay(tracePointsRef.current));

      event.preventDefault();
    },
    [toTracePoint]
  );

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
    const initialSession = ensureSomaticSession();
    setSomaticOverlay(resolveSomaticTraceRuntime(initialSession, 0).overlay);
  }, [ensureSomaticSession]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelStopHold();
      clearTimers();
      sampleInFlightRef.current = false;
      sessionStartRef.current = null;
      generatorRef.current.stop();
      generatorRef.current.dispose();
      void liveMicRef.current.stop();
      void breathSamplerRef.current.stop();
    };
  }, [cancelStopHold, clearTimers]);

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

  const breathPhaseLabel = runtime.phase === 'inhale' ? phaseInhaleLabel : phaseExhaleLabel;

  const sessionMinutes = Math.floor(elapsedSeconds / 60);
  const sessionSeconds = elapsedSeconds % 60;

  const stopHoldDegrees = Math.round(Math.max(0, Math.min(1, stopHoldProgress)) * 360);
  const stopHoldHintText =
    stopHoldProgress >= 1
      ? stopControlCompleting
      : stopHoldProgress > 0
        ? stopControlProgressHint
        : stopControlHint;

  const activeSomaticCoherence = Math.round((activeSomaticOverlay?.coherence ?? 0.72) * 100);
  const activeSomaticTension = Math.round((activeSomaticOverlay?.tension ?? 0.32) * 100);
  const activeSomaticPhase = activeSomaticOverlay ? formatSomaticPhase(activeSomaticOverlay.phase) : 'MIRROR';

  const primaryActionLabel =
    stage === 'error'
      ? retryLabel
      : mode === 'somatic'
        ? 'Start Somatic Field'
        : startLabel;

  const modeStatusText =
    mode === 'breath'
      ? `Breath ${breathPhaseLabel.toUpperCase()}`
      : `Somatic ${activeSomaticPhase}`;

  const activeSessionReadyTitle = mode === 'somatic' ? somaticSessionReadyTitle : sessionReadyTitle;
  const activeSessionReadyBody = mode === 'somatic' ? somaticSessionReadyBody : sessionReadyBody;
  const shouldShowSessionCta = stage === 'active' && (mode === 'somatic' ? showSomaticSessionCta : showSessionCta);
  const fieldTouchAction = mode === 'somatic' || isTracing ? 'none' : 'pan-y';

  const breathGuide: BreathGuideOverlayData | null =
    mode === 'breath' && stage === 'active'
      ? {
          phase: runtime.phase,
          phaseProgress: runtime.phaseProgress,
          coherenceScore: runtime.coherenceScore,
          breathBpm: runtime.breathBpm,
          targetBpm: runtime.targetBpm
        }
      : null;

  const fieldSomaticOverlay = mode === 'somatic' ? activeSomaticOverlay : isTracing ? tracePreviewOverlay : null;

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
          <p className="mt-2 text-sm text-ink/72 sm:text-base">
            {mode === 'breath'
              ? allowMicHint
              : 'Draw directly on the field to map your body-state trace. The scene shifts from mirror to release automatically.'}
          </p>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <div className="relative rounded-full border border-white/45 bg-white/62 p-1 shadow-[0_10px_26px_rgba(18,26,41,0.12)] backdrop-blur-sm">
            <span
              className="pointer-events-none absolute bottom-1 top-1 rounded-full bg-gradient-to-r from-[#7ab6c7] to-[#8ba9de] shadow-[0_8px_22px_rgba(47,86,136,0.35)] transition-all duration-300"
              style={{
                width: 'calc(50% - 4px)',
                left: mode === 'somatic' ? 'calc(50% + 2px)' : '2px'
              }}
            />
            <div className="relative grid grid-cols-2">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                  mode === 'breath' ? 'text-white' : 'text-ink/68'
                }`}
                onClick={() => setMode('breath')}
              >
                Breath Sync
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                  mode === 'somatic' ? 'text-white' : 'text-ink/68'
                }`}
                onClick={() => setMode('somatic')}
              >
                Somatic Trace
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] text-ink/62">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                mode === 'breath' ? 'bg-emerald-400/85' : 'bg-sky-400/85'
              } ${stage === 'active' ? 'animate-pulse' : ''}`}
            />
            <span>{modeStatusText}</span>
          </div>
        </div>

        <div
          ref={fieldSurfaceRef}
          className="relative select-none"
          style={{ touchAction: fieldTouchAction }}
          onPointerDown={handleFieldPointerDown}
          onPointerMove={handleFieldPointerMove}
          onPointerUp={finishTrace}
          onPointerCancel={finishTrace}
          onPointerLeave={(event) => {
            if (isTracingRef.current) {
              finishTrace(event);
            }
          }}
        >
          <LivingMirrorField
            analyser={analyser}
            isActive={stage === 'active'}
            mode={mode}
            breathGuide={breathGuide}
            somaticOverlay={fieldSomaticOverlay}
            tracePreview={isTracing ? tracePreviewOverlay : null}
          />

          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-white/28 bg-slate-950/42 px-3 py-2 text-xs text-white/86 backdrop-blur-sm md:bottom-5 md:text-[13px]">
            {mode === 'somatic'
              ? isTracing
                ? `Tracing... ${tracePointCount} points captured`
                : somaticStatus ?? 'Drag anywhere on the field to personalize your somatic map.'
              : stage === 'active'
                ? `${listeningLabel}${isSamplingBreath ? ' • sampling' : ''}`
                : 'Field idle. Press start to begin breath synchronization.'}
          </div>
        </div>

        <div className="grid gap-3 rounded-3xl border border-white/45 bg-white/60 p-4 text-center backdrop-blur-sm sm:grid-cols-3">
          {mode === 'breath' ? (
            <>
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
                <p className="mt-1 text-xl font-semibold text-ink/92">{breathPhaseLabel}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink/58">Trace Tension</p>
                <p className="mt-1 text-xl font-semibold text-ink/92">{activeSomaticTension}%</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink/58">{coherenceLabel}</p>
                <p className="mt-1 text-xl font-semibold text-ink/92">{activeSomaticCoherence}%</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink/58">Phase</p>
                <p className="mt-1 text-xl font-semibold text-ink/92">{activeSomaticPhase}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 pb-1">
          {stage === 'idle' || stage === 'error' ? (
            <Button onClick={() => void startExperience()} size="lg">
              {primaryActionLabel}
            </Button>
          ) : null}

          {stage === 'starting' ? <p className="text-sm text-ink/76">{startingLabel}</p> : null}

          {stage === 'active' ? (
            <p className="text-sm text-ink/76">
              {mode === 'breath' ? listeningLabel : 'Somatic field active'}
              {mode === 'breath' && isSamplingBreath ? ' • …' : ''}
            </p>
          ) : null}

          {stage === 'active' ? (
            <p className="text-xs uppercase tracking-[0.2em] text-ink/58">
              {String(sessionMinutes).padStart(2, '0')}:{String(sessionSeconds).padStart(2, '0')}
            </p>
          ) : null}

          {stage === 'active' ? (
            <div className="mt-1 flex w-full flex-col items-center gap-2">
              <button
                type="button"
                aria-label={stopControlLabel}
                onPointerDown={(event) => {
                  event.preventDefault();
                  if (event.currentTarget.setPointerCapture) {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }
                  beginStopHold();
                }}
                onPointerUp={endStopHold}
                onPointerLeave={endStopHold}
                onPointerCancel={endStopHold}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    beginStopHold();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    endStopHold();
                  }
                }}
                onBlur={endStopHold}
                className="group relative h-20 w-20 rounded-full transition duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagoon/60"
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(rgba(106,146,194,0.95) ${stopHoldDegrees}deg, rgba(23,32,52,0.16) ${stopHoldDegrees}deg)`
                  }}
                />
                <span className="absolute inset-[5px] flex items-center justify-center rounded-full border border-white/55 bg-white/88 text-[10px] font-semibold tracking-[0.14em] text-ink/78 shadow-[0_10px_24px_rgba(25,34,52,0.2)] backdrop-blur-sm">
                  {Math.round(stopHoldProgress * 100)}%
                </span>
              </button>
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink/62">{stopControlLabel}</p>
              <p className="text-xs text-ink/62">{stopHoldHintText}</p>
            </div>
          ) : null}

          {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}
        </div>

        {shouldShowSessionCta ? (
          <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/50 bg-white/66 p-5 text-center backdrop-blur-sm">
            <p className="text-base font-semibold text-ink/92">{activeSessionReadyTitle}</p>
            <p className="mt-2 text-sm text-ink/72">{activeSessionReadyBody}</p>
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
