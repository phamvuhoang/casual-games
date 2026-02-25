'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import ThreeVisualizer from '@/components/audio/ThreeVisualizer';
import SceneStackEditor from '@/components/ecstatic/SceneStackEditor';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { FrequencyGenerator, type FrequencyConfig } from '@/lib/audio/FrequencyGenerator';
import { MicrophoneAnalysisService } from '@/lib/audio/MicrophoneAnalysisService';
import { analyzeRoomSpectrum } from '@/lib/audio/SympatheticResonanceEngine';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import { recommendEcstaticAction } from '@/lib/ecstatic/recommendation';
import {
  getNextPhase,
  initialEcstaticSnapshot,
  pickSceneForPhase,
  resolveOverallProgress
} from '@/lib/ecstatic/session';
import { appendEcstaticHistory, clearEcstaticDraft, loadEcstaticDraft } from '@/lib/ecstatic/storage';
import {
  buildSceneRuntime,
  buildPhasePlanTimeline,
  defaultSceneTransition,
  getEcstaticScene,
  getEcstaticScenePack,
  getEcstaticScenes,
  getEcstaticTemplate,
  sceneChangeEvent
} from '@/lib/ecstatic/templates';
import type {
  EcstaticAction,
  EcstaticLiveMetrics,
  EcstaticPhase,
  EcstaticPhaseEvent,
  EcstaticRecommendation,
  EcstaticSceneChangeEvent,
  EcstaticSceneId,
  EcstaticSessionSetupDraft,
  EcstaticSignalSample,
  EcstaticTransitionType
} from '@/lib/ecstatic/types';
import { formatDuration } from '@/lib/utils/helpers';

const ENERGY_SAMPLE_MS = 2200;
const BREATH_SAMPLE_MS = 22000;
const ROOM_SAMPLE_MS = 26000;
const TICK_MS = 500;
const ACTION_COOLDOWN_SECONDS = 8;

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function patternForPhase(phase: EcstaticPhase) {
  if (phase === 'arrival') {
    return [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, true];
  }
  if (phase === 'grounding') {
    return [true, false, true, false, true, false, false, true, true, false, true, false, true, false, false, true];
  }
  if (phase === 'build') {
    return [true, true, false, true, true, false, true, false, true, true, false, true, true, false, true, false];
  }
  if (phase === 'peak') {
    return [true, true, true, false, true, true, false, true, true, true, false, true, true, false, true, true];
  }
  if (phase === 'release') {
    return [true, false, true, false, false, true, false, false, true, false, true, false, false, true, false, false];
  }
  return [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];
}

function modulationForPhase(phase: EcstaticPhase) {
  if (phase === 'peak') {
    return { enabled: true, rateHz: 0.35, depthHz: 8, waveform: 'triangle' as const };
  }
  if (phase === 'build') {
    return { enabled: true, rateHz: 0.24, depthHz: 5.5, waveform: 'sine' as const };
  }
  if (phase === 'release') {
    return { enabled: true, rateHz: 0.14, depthHz: 2.8, waveform: 'sine' as const };
  }
  if (phase === 'integration') {
    return { enabled: true, rateHz: 0.09, depthHz: 1.6, waveform: 'triangle' as const };
  }
  return { enabled: true, rateHz: 0.12, depthHz: 2.6, waveform: 'sine' as const };
}

function voicesForFrequencies(frequencies: number[]): FrequencyConfig[] {
  if (frequencies.length === 0) {
    return [];
  }
  const scale = 1 / Math.sqrt(frequencies.length);
  return frequencies.map((frequency, index) => ({
    frequency,
    volume: clamp(0.06, 0.34 * scale + (index % 2 === 0 ? 0.03 : 0), 0.32),
    waveform: index % 3 === 0 ? 'triangle' : 'sine',
    pan: index % 2 === 0 ? -0.24 : 0.24,
    attackSeconds: 0.9,
    releaseSeconds: 1.6
  }));
}

function actionLabel(action: EcstaticAction) {
  if (action === 'advance') return 'Advance';
  if (action === 'deepen') return 'Deepen';
  if (action === 'soften') return 'Soften';
  if (action === 'land') return 'Land';
  return 'Hold';
}

function hasWebglSupport() {
  if (typeof window === 'undefined') {
    return false;
  }
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
}

function resolveInitialSceneStack(draft: ReturnType<typeof loadEcstaticDraft>): EcstaticSceneId[] {
  if (!draft) {
    return [pickSceneForPhase('arrival', [])];
  }
  const packScenes = getEcstaticScenePack(draft.visualPack);
  if (packScenes.length > 0) {
    return [...new Set(packScenes)];
  }
  return [pickSceneForPhase('arrival', [])];
}

export default function EcstaticLiveStage() {
  const router = useRouter();
  const scenes = useMemo(() => getEcstaticScenes(), []);
  const [draft, setDraft] = useState<EcstaticSessionSetupDraft | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const template = useMemo(() => (draft ? getEcstaticTemplate(draft.templateId) : null), [draft]);
  const phaseTimeline = useMemo(
    () => (template && draft ? buildPhasePlanTimeline(template, draft.durationMinutes) : []),
    [draft, template]
  );
  const initialSceneStack = useMemo(() => resolveInitialSceneStack(draft), [draft]);

  const [sessionStarted, setSessionStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [currentPhase, setCurrentPhase] = useState<EcstaticPhase>('arrival');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [phaseElapsedSeconds, setPhaseElapsedSeconds] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.42);
  const [sceneIntensity, setSceneIntensity] = useState(1);
  const [sceneSpeed, setSceneSpeed] = useState(1);
  const [sceneTransition, setSceneTransition] = useState<EcstaticTransitionType>(defaultSceneTransition());
  const [activeSceneId, setActiveSceneId] = useState<EcstaticSceneId>(initialSceneStack[0] ?? 'kinetic_mandala');
  const [sceneStack, setSceneStack] = useState<EcstaticSceneId[]>(initialSceneStack);
  const [phaseEvents, setPhaseEvents] = useState<EcstaticPhaseEvent[]>([]);
  const [samples, setSamples] = useState<EcstaticSignalSample[]>([]);
  const [sceneChanges, setSceneChanges] = useState<EcstaticSceneChangeEvent[]>([]);
  const [canRenderThree, setCanRenderThree] = useState(false);
  const [recommendation, setRecommendation] = useState<EcstaticRecommendation>({
    action: 'hold',
    confidence: 0.52,
    reasons: ['Start session to receive live recommendations']
  });
  const [metrics, setMetrics] = useState<EcstaticLiveMetrics>({
    energy: 0.1,
    bass: 0.08,
    breathBpm: null,
    breathConfidence: 0,
    roomConfidence: 0.32
  });

  const generatorRef = useRef(new FrequencyGenerator());
  const breathMicRef = useRef(new MicrophoneAnalysisService());
  const roomMicRef = useRef(new MicrophoneAnalysisService());
  const energyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionSnapshotRef = useRef<ReturnType<typeof initialEcstaticSnapshot> | null>(null);
  const lastActionAtRef = useRef(0);
  const sampleInFlightRef = useRef(false);
  const roomInFlightRef = useRef(false);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const phaseDurationSeconds = useMemo(() => {
    const item = phaseTimeline.find((entry) => entry.phase === currentPhase);
    return item?.seconds ?? 1;
  }, [currentPhase, phaseTimeline]);

  const phaseProgress = clamp(0, phaseElapsedSeconds / Math.max(1, phaseDurationSeconds), 1);
  const overallProgress = useMemo(() => {
    if (!template || !draft) {
      return 0;
    }
    return resolveOverallProgress({
      phase: currentPhase,
      phaseProgress,
      template,
      durationMinutes: draft.durationMinutes
    });
  }, [currentPhase, draft, phaseProgress, template]);

  const activeSceneRuntime = useMemo(
    () =>
      buildSceneRuntime({
        sceneId: activeSceneId,
        intensityScale: sceneIntensity,
        speedScale: sceneSpeed
      }),
    [activeSceneId, sceneIntensity, sceneSpeed]
  );

  const phaseBpm = template?.targetBpm[currentPhase] ?? 72;
  const phaseFrequencies = template?.baseFrequencies[currentPhase] ?? [432, 528];
  const shouldEnableBridge = false;
  const useThreeRenderer = activeSceneRuntime.mode === 'three' && canRenderThree;

  const playPhaseAudio = useCallback(async () => {
    const generator = generatorRef.current;
    if (!initializedRef.current) {
      await generator.initialize(DEFAULT_EFFECTS, { enableAudioBridge: shouldEnableBridge });
      initializedRef.current = true;
    }

    generator.setMasterVolume(masterVolume);
    generator.setRhythmPattern({
      enabled: true,
      bpm: phaseBpm,
      subdivision: '16n',
      steps: patternForPhase(currentPhase)
    });
    generator.setAutomation({
      modulation: modulationForPhase(currentPhase),
      sweep: {
        enabled: false,
        targetHz: 528,
        durationSeconds: 18,
        curve: 'easeInOut'
      }
    });

    const voices = voicesForFrequencies(phaseFrequencies);
    generator.play(voices);
    setAnalyser(generator.getAnalyser());
  }, [currentPhase, masterVolume, phaseBpm, phaseFrequencies, shouldEnableBridge]);

  const stopRuntimeTimers = useCallback(() => {
    if (energyTimerRef.current) {
      clearInterval(energyTimerRef.current);
      energyTimerRef.current = null;
    }
    if (breathTimerRef.current) {
      clearInterval(breathTimerRef.current);
      breathTimerRef.current = null;
    }
    if (roomTimerRef.current) {
      clearInterval(roomTimerRef.current);
      roomTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  const runBreathSample = useCallback(async () => {
    if (sampleInFlightRef.current || !sessionStarted || isPaused) {
      return;
    }
    sampleInFlightRef.current = true;
    try {
      const result = await breathMicRef.current.captureAmplitudePattern({
        durationMs: 6200,
        sampleIntervalMs: 90,
        fftSize: 1024
      });

      if (!mountedRef.current) {
        return;
      }

      setMetrics((prev) => ({
        ...prev,
        breathBpm: typeof result.estimatedBreathBpm === 'number' ? result.estimatedBreathBpm : prev.breathBpm,
        breathConfidence: result.confidence
      }));
    } catch (error) {
      console.warn('Ecstatic breath sample failed.', error);
    } finally {
      await breathMicRef.current.stop();
      sampleInFlightRef.current = false;
    }
  }, [isPaused, sessionStarted]);

  const runRoomSample = useCallback(async () => {
    if (roomInFlightRef.current || !sessionStarted || isPaused) {
      return;
    }
    roomInFlightRef.current = true;
    try {
      const spectrum = await roomMicRef.current.captureSpectrum({
        durationMs: 1300,
        fftSize: 2048,
        smoothingTimeConstant: 0.72
      });
      const room = analyzeRoomSpectrum(spectrum);
      if (!mountedRef.current) {
        return;
      }
      setMetrics((prev) => ({
        ...prev,
        roomConfidence: room.confidence
      }));
    } catch (error) {
      console.warn('Ecstatic room sample failed.', error);
    } finally {
      await roomMicRef.current.stop();
      roomInFlightRef.current = false;
    }
  }, [isPaused, sessionStarted]);

  const ingestSampleAndRecommendation = useCallback(
    (nextMetrics: EcstaticLiveMetrics) => {
      const nextRecommendation = recommendEcstaticAction(currentPhase, nextMetrics);
      setRecommendation(nextRecommendation);

      const now = Date.now();
      if (now - lastActionAtRef.current < ACTION_COOLDOWN_SECONDS * 1000) {
        return;
      }

      const sample: EcstaticSignalSample = {
        at: new Date().toISOString(),
        phase: currentPhase,
        energy: Number(nextMetrics.energy.toFixed(3)),
        bass: Number(nextMetrics.bass.toFixed(3)),
        breathBpm: nextMetrics.breathBpm,
        breathConfidence: Number(nextMetrics.breathConfidence.toFixed(3)),
        roomConfidence: Number(nextMetrics.roomConfidence.toFixed(3)),
        recommendation: nextRecommendation.action
      };
      setSamples((prev) => [sample, ...prev].slice(0, 420));
      lastActionAtRef.current = now;
    },
    [currentPhase]
  );

  const transitionPhase = useCallback(
    (nextPhase: EcstaticPhase, type: EcstaticPhaseEvent['type']) => {
      const nowIso = new Date().toISOString();
      setCurrentPhase(nextPhase);
      setPhaseElapsedSeconds(0);
      setPhaseEvents((prev) => [{ phase: nextPhase, at: nowIso, type }, ...prev]);

      const nextScene = pickSceneForPhase(nextPhase, sceneStack);
      if (nextScene !== activeSceneId) {
        setActiveSceneId(nextScene);
        setSceneChanges((prev) => [sceneChangeEvent(activeSceneId, nextScene, sceneTransition), ...prev]);
      }
    },
    [activeSceneId, sceneStack, sceneTransition]
  );

  const handleAdvance = useCallback(() => {
    const next = getNextPhase(currentPhase);
    if (next === currentPhase) {
      setStatusMessage('Already at final phase.');
      return;
    }
    transitionPhase(next, 'manual');
    setStatusMessage(`Phase advanced to ${next.toUpperCase()}.`);
  }, [currentPhase, transitionPhase]);

  const handleSoften = useCallback(() => {
    const nextVolume = clamp(0.18, masterVolume - 0.07, 0.8);
    const nextIntensity = clamp(0.5, sceneIntensity - 0.12, 1.8);
    const nextSpeed = clamp(0.5, sceneSpeed - 0.08, 1.8);
    setMasterVolume(nextVolume);
    setSceneIntensity(nextIntensity);
    setSceneSpeed(nextSpeed);
    generatorRef.current.setMasterVolume(nextVolume);
    setStatusMessage('Softening output and visual intensity.');
  }, [masterVolume, sceneIntensity, sceneSpeed]);

  const handleLand = useCallback(() => {
    if (currentPhase === 'integration') {
      setStatusMessage('Integration phase is already active.');
      return;
    }
    transitionPhase('integration', 'manual');
    setStatusMessage('Landing pathway activated.');
  }, [currentPhase, transitionPhase]);

  const handlePauseResume = useCallback(async () => {
    if (!sessionStarted) {
      return;
    }
    if (isPaused) {
      await playPhaseAudio();
      setIsPaused(false);
      setStatusMessage('Session resumed.');
      return;
    }
    generatorRef.current.stop();
    setIsPaused(true);
    setStatusMessage('Session paused.');
  }, [isPaused, playPhaseAudio, sessionStarted]);

  const handleActiveSceneChange = useCallback(
    (sceneId: EcstaticSceneId) => {
      if (sceneId === activeSceneId) {
        return;
      }
      setSceneChanges((prev) => [sceneChangeEvent(activeSceneId, sceneId, sceneTransition), ...prev]);
      setActiveSceneId(sceneId);
    },
    [activeSceneId, sceneTransition]
  );

  const handleStartSession = useCallback(async () => {
    if (!template || !draft) {
      return;
    }

    const seededStack = sceneStack.length > 0 ? [...new Set(sceneStack)] : initialSceneStack;
    setSceneStack(seededStack);
    const initialScene = seededStack[0] ?? pickSceneForPhase('arrival', seededStack);
    setActiveSceneId(initialScene);

    try {
      await playPhaseAudio();
    } catch (error) {
      console.error(error);
      setStatusMessage('Could not start audio. Check browser autoplay or audio output settings.');
      return;
    }

    const snapshot = initialEcstaticSnapshot({
      setup: draft,
      template
    });
    snapshot.sceneStack = seededStack;
    snapshot.activeSceneId = initialScene;
    sessionSnapshotRef.current = snapshot;

    setPhaseEvents(snapshot.phaseEvents);
    setSamples([]);
    setSceneChanges([]);
    setSessionElapsedSeconds(0);
    setPhaseElapsedSeconds(0);
    setCurrentPhase('arrival');
    setSessionStarted(true);
    setIsPaused(false);
    setStatusMessage('Live session started.');
  }, [draft, initialSceneStack, playPhaseAudio, sceneStack, template]);

  const handleCloseSession = useCallback(
    (status: 'completed' | 'abandoned') => {
      if (!sessionSnapshotRef.current) {
        router.push('/ecstatic/replay');
        return;
      }

      stopRuntimeTimers();
      generatorRef.current.stop();

      const snapshot = sessionSnapshotRef.current;
      snapshot.status = status;
      snapshot.endedAt = new Date().toISOString();
      snapshot.phaseEvents = phaseEvents.slice().reverse();
      snapshot.samples = samples.slice().reverse();
      snapshot.sceneChanges = sceneChanges.slice().reverse();
      snapshot.sceneIntensity = sceneIntensity;
      snapshot.sceneSpeed = sceneSpeed;
      snapshot.sceneTransition = sceneTransition;
      snapshot.activeSceneId = activeSceneId;
      snapshot.sceneStack = sceneStack;
      snapshot.audioConfig = {
        templateId: draft?.templateId,
        phase: currentPhase,
        bpm: phaseBpm,
        volume: masterVolume
      };
      snapshot.visualConfig = {
        activeSceneId,
        sceneIntensity,
        sceneSpeed,
        sceneTransition,
        mode: activeSceneRuntime.mode
      };

      appendEcstaticHistory(snapshot);
      clearEcstaticDraft();
      router.push('/ecstatic/replay');
    },
    [
      activeSceneId,
      activeSceneRuntime.mode,
      currentPhase,
      draft?.templateId,
      masterVolume,
      phaseBpm,
      phaseEvents,
      router,
      samples,
      sceneChanges,
      sceneIntensity,
      sceneSpeed,
      sceneStack,
      sceneTransition,
      stopRuntimeTimers
    ]
  );

  useEffect(() => {
    setDraft(loadEcstaticDraft());
    setIsDraftLoaded(true);
  }, []);

  useEffect(() => {
    setCanRenderThree(hasWebglSupport());
  }, []);

  useEffect(() => {
    if (!draft || sessionStarted) {
      return;
    }
    const nextStack = resolveInitialSceneStack(draft);
    setSceneStack(nextStack);
    setActiveSceneId((previous) => {
      if (nextStack.includes(previous)) {
        return previous;
      }
      return nextStack[0] ?? pickSceneForPhase('arrival', nextStack);
    });
  }, [draft, sessionStarted]);

  useEffect(() => {
    if (!sessionStarted || isPaused) {
      stopRuntimeTimers();
      return;
    }

    tickTimerRef.current = setInterval(() => {
      setSessionElapsedSeconds((prev) => prev + TICK_MS / 1000);
      setPhaseElapsedSeconds((prev) => prev + TICK_MS / 1000);
    }, TICK_MS);

    energyTimerRef.current = setInterval(() => {
      const analyserNode = generatorRef.current.getAnalyser();
      if (!analyserNode) {
        return;
      }

      const bins = new Uint8Array(analyserNode.frequencyBinCount);
      analyserNode.getByteFrequencyData(bins);
      const total = bins.reduce((sum, value) => sum + value, 0);
      const lowCount = Math.max(1, Math.floor(bins.length * 0.12));
      const low = bins.slice(0, lowCount).reduce((sum, value) => sum + value, 0);

      setMetrics((prev) => {
        const next = {
          ...prev,
          energy: total / (bins.length * 255),
          bass: low / (lowCount * 255)
        };
        ingestSampleAndRecommendation(next);
        return next;
      });
    }, ENERGY_SAMPLE_MS);

    breathTimerRef.current = setInterval(() => {
      void runBreathSample();
    }, BREATH_SAMPLE_MS);

    roomTimerRef.current = setInterval(() => {
      void runRoomSample();
    }, ROOM_SAMPLE_MS);

    return () => {
      stopRuntimeTimers();
    };
  }, [ingestSampleAndRecommendation, isPaused, runBreathSample, runRoomSample, sessionStarted, stopRuntimeTimers]);

  useEffect(() => {
    if (!sessionStarted || isPaused) {
      return;
    }
    void playPhaseAudio();
  }, [currentPhase, isPaused, phaseBpm, playPhaseAudio, sessionStarted]);

  useEffect(() => {
    if (phaseProgress < 1 || !sessionStarted || isPaused) {
      return;
    }

    if (draft?.automationLevel === 'manual') {
      setStatusMessage('Phase complete. Advance manually when ready.');
      return;
    }

    setRecommendation((prev) => ({
      ...prev,
      action: 'advance',
      confidence: Math.max(prev.confidence, 0.78),
      reasons: ['Phase duration reached; transition readiness is high.']
    }));

    if (draft?.automationLevel === 'adaptive-light') {
      setStatusMessage('Adaptive-light: ready to advance. Tap Advance to confirm.');
    }
  }, [draft?.automationLevel, isPaused, phaseProgress, sessionStarted]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopRuntimeTimers();
      generatorRef.current.dispose();
      void breathMicRef.current.stop();
      void roomMicRef.current.stop();
    };
  }, [stopRuntimeTimers]);

  useEffect(() => {
    if (!sessionStarted || isPaused) {
      return;
    }
    generatorRef.current.setMasterVolume(masterVolume);
  }, [isPaused, masterVolume, sessionStarted]);

  if (!isDraftLoaded) {
    return (
      <Card className="mx-auto mt-4 max-w-2xl text-center">
        <h1 className="text-2xl font-semibold">Loading Ecstatic session...</h1>
      </Card>
    );
  }

  if (!draft || !template) {
    return (
      <Card className="mx-auto mt-4 max-w-2xl text-center">
        <h1 className="text-2xl font-semibold">No Ecstatic setup found</h1>
        <p className="mt-2 text-sm text-ink/68">Start from the Ecstatic setup page to create a live session draft.</p>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push('/ecstatic')}>Open setup</Button>
        </div>
      </Card>
    );
  }

  const activeScene = getEcstaticScene(activeSceneId);

  return (
    <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/58">Live Conductor</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{template.name}</h1>
            <p className="mt-1 text-sm text-ink/68">{template.description}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white/78 px-3 py-2 text-sm text-ink/70">
            <p>
              Phase: <span className="font-semibold text-ink">{currentPhase.toUpperCase()}</span>
            </p>
            <p className="mt-1">
              Runtime: {formatDuration(Math.max(0, Math.round(sessionElapsedSeconds)))}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden p-4">
            {useThreeRenderer ? (
              <ThreeVisualizer analyser={analyser} isActive={sessionStarted && !isPaused} />
            ) : (
              <WaveformVisualizer
                analyser={analyser}
                type="multi-layer"
                layers={activeSceneRuntime.layers}
                isActive={sessionStarted && !isPaused}
              />
            )}
            <div className="mt-3 rounded-2xl border border-ink/10 bg-white/78 px-3 py-2 text-xs text-ink/65">
              Scene: <span className="font-semibold text-ink/80">{activeScene?.name ?? activeSceneId}</span> • Transition:{' '}
              <span className="font-semibold text-ink/80">{sceneTransition}</span>
            </div>
            {activeSceneRuntime.mode === 'three' && !canRenderThree ? (
              <p className="mt-2 text-xs text-ink/58">Three.js unavailable in this browser. Using waveform fallback.</p>
            ) : null}
          </Card>

          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-ink/10 bg-white/78 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-ink/55">Energy</p>
                <p className="mt-1 text-lg font-semibold">{Math.round(metrics.energy * 100)}%</p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/78 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-ink/55">Coherence</p>
                <p className="mt-1 text-lg font-semibold">{Math.round(((metrics.breathConfidence + metrics.roomConfidence) / 2) * 100)}%</p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/78 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-ink/55">Recommendation</p>
                <p className="mt-1 text-lg font-semibold">
                  {actionLabel(recommendation.action)} ({Math.round(recommendation.confidence * 100)}%)
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#4DAA57] via-[#F4A261] to-[#E63946]" style={{ width: `${Math.round(overallProgress * 100)}%` }} />
              </div>
              <p className="text-xs text-ink/62">Overall arc progress {Math.round(overallProgress * 100)}%</p>
              <div className="h-2 rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#72A1E5] to-[#A86ACD]" style={{ width: `${Math.round(phaseProgress * 100)}%` }} />
              </div>
              <p className="text-xs text-ink/62">
                Phase progress {Math.round(phaseProgress * 100)}% • target BPM {phaseBpm}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {!sessionStarted ? (
                <Button onClick={handleStartSession}>Start session</Button>
              ) : (
                <>
                  <Button onClick={handleAdvance} disabled={isPaused}>
                    Advance phase
                  </Button>
                  <Button variant="outline" onClick={handleSoften} disabled={isPaused}>
                    Soften
                  </Button>
                  <Button variant="outline" onClick={handleLand} disabled={isPaused}>
                    Land
                  </Button>
                  <Button variant="outline" onClick={handlePauseResume}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button variant="ghost" onClick={() => handleCloseSession('completed')}>
                    Complete
                  </Button>
                  <Button variant="ghost" onClick={() => handleCloseSession('abandoned')}>
                    Abandon
                  </Button>
                </>
              )}
            </div>
            {statusMessage ? <p className="mt-3 text-xs text-ink/62">{statusMessage}</p> : null}
            <ul className="mt-3 list-disc pl-5 text-xs text-ink/58">
              {recommendation.reasons.slice(0, 3).map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <SceneStackEditor
            scenes={scenes}
            stack={sceneStack}
            activeSceneId={activeSceneId}
            sceneIntensity={sceneIntensity}
            sceneSpeed={sceneSpeed}
            transition={sceneTransition}
            onActiveSceneChange={handleActiveSceneChange}
            onSceneIntensityChange={setSceneIntensity}
            onSceneSpeedChange={setSceneSpeed}
            onTransitionChange={setSceneTransition}
          />

          <Card className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/58">Session Telemetry</h2>
            <p className="mt-2 text-xs text-ink/62">
              Samples: {samples.length} • Phase events: {phaseEvents.length} • Scene changes: {sceneChanges.length}
            </p>
            <p className="mt-2 text-xs text-ink/62">
              Breath: {metrics.breathBpm ? `${metrics.breathBpm.toFixed(1)} bpm` : 'n/a'} • Room confidence:{' '}
              {Math.round(metrics.roomConfidence * 100)}%
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
