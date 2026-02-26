import type { WaveformType } from '@/lib/audio/FrequencyGenerator';
import {
  clamp,
  frequencyKey,
  normalizeFrequency,
  normalizeRhythmSteps,
  type BinauralConfig,
  type ModulationConfig,
  type RhythmConfig,
  type SweepConfig
} from '@/lib/audio/audioConfig';
import type { MixStyle } from '@/lib/audio/mixProfiles';

const TRACE_ANCHOR_FREQUENCIES = [174, 285, 396, 417, 432, 528, 639, 741, 852] as const;
const RELEASE_FREQUENCY_HINTS = [396, 432, 528, 639, 741] as const;
const EPSILON = 0.000001;

export interface SomaticTracePoint {
  x: number;
  y: number;
  t: number;
  pressure?: number;
}

export interface SomaticTraceOverlayPoint {
  x: number;
  y: number;
  energy: number;
}

export interface SomaticTraceMetrics {
  durationMs: number;
  sampleCount: number;
  distance: number;
  meanSpeed: number;
  speedVariance: number;
  speedVarianceRatio: number;
  curvature: number;
  jitter: number;
  pauseRatio: number;
  directionChanges: number;
  directionChangeRatio: number;
  complexityScore: number;
  tensionScore: number;
  coherenceScore: number;
  centroidX: number;
  centroidY: number;
}

export interface SomaticTraceAnalysis {
  metrics: SomaticTraceMetrics;
  overlayPoints: SomaticTraceOverlayPoint[];
}

export type SomaticTracePhase = 'mirror' | 'release' | 'complete';

export interface SomaticTracePhaseConfig {
  rhythm: RhythmConfig;
  modulation: ModulationConfig;
  sweep: SweepConfig;
  binaural: BinauralConfig;
}

export interface SomaticTraceSession {
  id: string;
  createdAt: string;
  metrics: SomaticTraceMetrics;
  overlayPoints: SomaticTraceOverlayPoint[];
  selectedFrequencies: number[];
  frequencyVolumes: Record<string, number>;
  mixStyle: MixStyle;
  waveform: WaveformType;
  mirror: SomaticTracePhaseConfig;
  release: SomaticTracePhaseConfig;
  phaseDurationsMs: {
    mirror: number;
    release: number;
    total: number;
  };
}

export interface SomaticTraceOverlayState {
  phase: SomaticTracePhase;
  phaseProgress: number;
  overallProgress: number;
  tension: number;
  coherence: number;
  points: SomaticTraceOverlayPoint[];
}

export interface SomaticTraceRuntime {
  phase: SomaticTracePhase;
  phaseProgress: number;
  overallProgress: number;
  rhythm: RhythmConfig;
  modulation: ModulationConfig;
  sweep: SweepConfig;
  binaural: BinauralConfig;
  overlay: SomaticTraceOverlayState;
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[], avg: number) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => {
    const delta = value - avg;
    return sum + delta * delta;
  }, 0) / values.length;
}

function angleBetween(
  prev: SomaticTracePoint,
  current: SomaticTracePoint,
  next: SomaticTracePoint
) {
  const ax = current.x - prev.x;
  const ay = current.y - prev.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;

  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA <= EPSILON || magB <= EPSILON) {
    return 0;
  }

  const dot = (ax * bx + ay * by) / (magA * magB);
  const clampedDot = Math.min(1, Math.max(-1, dot));
  return Math.acos(clampedDot);
}

function normalizePoints(points: SomaticTracePoint[]) {
  return points
    .map((point) => ({
      x: clamp(0, point.x, 1),
      y: clamp(0, point.y, 1),
      t: point.t,
      pressure: typeof point.pressure === 'number' ? clamp(0, point.pressure, 1) : undefined
    }))
    .sort((left, right) => left.t - right.t);
}

function downsampleOverlayPoints(
  points: SomaticTracePoint[],
  speeds: number[],
  meanSpeed: number,
  maxPoints = 260
): SomaticTraceOverlayPoint[] {
  if (points.length === 0) {
    return [];
  }

  const safeMeanSpeed = Math.max(EPSILON, meanSpeed);
  const stride = Math.max(1, Math.ceil(points.length / maxPoints));
  const output: SomaticTraceOverlayPoint[] = [];

  for (let index = 0; index < points.length; index += stride) {
    const point = points[index];
    const speed = speeds[Math.max(0, index - 1)] ?? safeMeanSpeed;
    const energy = clamp(0.06, speed / (safeMeanSpeed * 2.2), 1);
    output.push({
      x: point.x,
      y: point.y,
      energy: Number(energy.toFixed(4))
    });
  }

  const tail = points[points.length - 1];
  if (output.length === 0 || output[output.length - 1].x !== tail.x || output[output.length - 1].y !== tail.y) {
    const lastSpeed = speeds[speeds.length - 1] ?? safeMeanSpeed;
    output.push({
      x: tail.x,
      y: tail.y,
      energy: Number(clamp(0.06, lastSpeed / (safeMeanSpeed * 2.2), 1).toFixed(4))
    });
  }

  return output;
}

function createMirrorSteps(directionRatio: number, pauseRatio: number, jitter: number) {
  const steps = Array.from({ length: 16 }, (_, index) => {
    const downbeat = index % 4 === 0;
    const directionPulse = Math.sin((index + 1) * (2.4 + directionRatio * 4.6)) * 0.5 + 0.5;
    const holdBias = pauseRatio * 0.24;
    const chaosBias = jitter * 0.28 + directionRatio * 0.2;
    return downbeat || directionPulse > 0.72 - chaosBias + holdBias;
  });

  return normalizeRhythmSteps(steps);
}

function createReleaseSteps(tension: number) {
  const steps = [
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false
  ];

  if (tension > 0.58) {
    steps[6] = true;
    steps[14] = true;
  }

  return normalizeRhythmSteps(steps);
}

function blendRhythmSteps(from: boolean[], to: boolean[], blend: number) {
  const output = from.map((entry, index) => {
    const threshold = (index + 1) / (from.length + 1);
    return blend >= threshold ? to[index] : entry;
  });

  return normalizeRhythmSteps(output);
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function interpolateRhythm(from: RhythmConfig, to: RhythmConfig, progress: number): RhythmConfig {
  const clampedProgress = clamp(0, progress, 1);
  return {
    enabled: from.enabled || to.enabled,
    bpm: Number(lerp(from.bpm, to.bpm, clampedProgress).toFixed(2)),
    subdivision: clampedProgress < 0.6 ? from.subdivision : to.subdivision,
    steps: blendRhythmSteps(from.steps, to.steps, clampedProgress)
  };
}

function interpolateModulation(from: ModulationConfig, to: ModulationConfig, progress: number): ModulationConfig {
  const clampedProgress = clamp(0, progress, 1);
  return {
    enabled: from.enabled || to.enabled,
    rateHz: Number(lerp(from.rateHz, to.rateHz, clampedProgress).toFixed(3)),
    depthHz: Number(lerp(from.depthHz, to.depthHz, clampedProgress).toFixed(3)),
    waveform: clampedProgress < 0.5 ? from.waveform : to.waveform
  };
}

function interpolateSweep(from: SweepConfig, to: SweepConfig, progress: number): SweepConfig {
  const clampedProgress = clamp(0, progress, 1);
  return {
    enabled: from.enabled || to.enabled,
    targetHz: normalizeFrequency(lerp(from.targetHz, to.targetHz, clampedProgress)),
    durationSeconds: Number(lerp(from.durationSeconds, to.durationSeconds, clampedProgress).toFixed(3)),
    curve: clampedProgress < 0.65 ? from.curve : to.curve
  };
}

function interpolateBinaural(from: BinauralConfig, to: BinauralConfig, progress: number): BinauralConfig {
  const clampedProgress = clamp(0, progress, 1);
  return {
    enabled: from.enabled || to.enabled,
    beatHz: Number(lerp(from.beatHz, to.beatHz, clampedProgress).toFixed(3)),
    panSpread: Number(lerp(from.panSpread, to.panSpread, clampedProgress).toFixed(3))
  };
}

export function analyzeSomaticTrace(points: SomaticTracePoint[]): SomaticTraceAnalysis {
  const normalizedPoints = normalizePoints(points);

  if (normalizedPoints.length < 3) {
    const fallbackMetrics: SomaticTraceMetrics = {
      durationMs: 0,
      sampleCount: normalizedPoints.length,
      distance: 0,
      meanSpeed: 0,
      speedVariance: 0,
      speedVarianceRatio: 0,
      curvature: 0,
      jitter: 0,
      pauseRatio: 0,
      directionChanges: 0,
      directionChangeRatio: 0,
      complexityScore: 0,
      tensionScore: 0.35,
      coherenceScore: 0.72,
      centroidX: 0.5,
      centroidY: 0.5
    };

    return {
      metrics: fallbackMetrics,
      overlayPoints: normalizedPoints.map((point) => ({ x: point.x, y: point.y, energy: 0.25 }))
    };
  }

  const distances: number[] = [];
  const speeds: number[] = [];
  const turns: number[] = [];
  const jitterValues: number[] = [];

  let pauseDurationMs = 0;
  let directionChanges = 0;
  let totalDistance = 0;

  let centroidXAccumulator = 0;
  let centroidYAccumulator = 0;
  for (const point of normalizedPoints) {
    centroidXAccumulator += point.x;
    centroidYAccumulator += point.y;
  }

  for (let index = 1; index < normalizedPoints.length; index += 1) {
    const previous = normalizedPoints[index - 1];
    const current = normalizedPoints[index];
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const deltaMs = Math.max(1, current.t - previous.t);
    const speed = distance / (deltaMs / 1000);

    distances.push(distance);
    speeds.push(speed);
    totalDistance += distance;
  }

  const meanSpeed = mean(speeds);
  const speedVariance = variance(speeds, meanSpeed);
  const speedVarianceRatio = speedVariance / Math.max(meanSpeed * meanSpeed, EPSILON);
  const pauseSpeedThreshold = meanSpeed * 0.42;

  for (let index = 1; index < normalizedPoints.length - 1; index += 1) {
    const previous = normalizedPoints[index - 1];
    const current = normalizedPoints[index];
    const next = normalizedPoints[index + 1];

    const turn = angleBetween(previous, current, next);
    turns.push(turn / Math.PI);

    if (turn > Math.PI * 0.35) {
      directionChanges += 1;
    }

    const midpointX = (previous.x + next.x) * 0.5;
    const midpointY = (previous.y + next.y) * 0.5;
    jitterValues.push(Math.hypot(current.x - midpointX, current.y - midpointY));

    const segmentSpeed = speeds[index] ?? meanSpeed;
    const deltaMs = Math.max(1, next.t - current.t);
    if (segmentSpeed < pauseSpeedThreshold) {
      pauseDurationMs += deltaMs;
    }
  }

  const durationMs = Math.max(0, normalizedPoints[normalizedPoints.length - 1].t - normalizedPoints[0].t);
  const directionChangeRatio = directionChanges / Math.max(1, normalizedPoints.length - 2);
  const curvature = clamp(0, mean(turns), 1);

  const averageDistance = totalDistance / Math.max(1, distances.length);
  const jitterMagnitude = mean(jitterValues) / Math.max(EPSILON, averageDistance * 1.6);
  const jitter = clamp(0, jitterMagnitude, 1);
  const pauseRatio = clamp(0, pauseDurationMs / Math.max(1, durationMs), 1);

  const speedVarianceNormalized = clamp(0, speedVarianceRatio / 4, 1);
  const directionNormalized = clamp(0, directionChangeRatio * 2.8, 1);

  const complexityScore = clamp(
    0,
    speedVarianceNormalized * 0.28 +
      curvature * 0.22 +
      jitter * 0.2 +
      directionNormalized * 0.18 +
      pauseRatio * 0.12,
    1
  );

  const tensionScore = clamp(
    0,
    speedVarianceNormalized * 0.26 +
      jitter * 0.26 +
      pauseRatio * 0.2 +
      directionNormalized * 0.16 +
      curvature * 0.12,
    1
  );

  const coherenceScore = clamp(
    0.04,
    (1 - tensionScore) * 0.7 + (1 - pauseRatio) * 0.12 + (1 - jitter) * 0.1 + (1 - directionNormalized) * 0.08,
    0.98
  );

  const metrics: SomaticTraceMetrics = {
    durationMs,
    sampleCount: normalizedPoints.length,
    distance: Number(totalDistance.toFixed(6)),
    meanSpeed: Number(meanSpeed.toFixed(6)),
    speedVariance: Number(speedVariance.toFixed(6)),
    speedVarianceRatio: Number(speedVarianceRatio.toFixed(6)),
    curvature: Number(curvature.toFixed(6)),
    jitter: Number(jitter.toFixed(6)),
    pauseRatio: Number(pauseRatio.toFixed(6)),
    directionChanges,
    directionChangeRatio: Number(directionChangeRatio.toFixed(6)),
    complexityScore: Number(complexityScore.toFixed(6)),
    tensionScore: Number(tensionScore.toFixed(6)),
    coherenceScore: Number(coherenceScore.toFixed(6)),
    centroidX: Number((centroidXAccumulator / normalizedPoints.length).toFixed(6)),
    centroidY: Number((centroidYAccumulator / normalizedPoints.length).toFixed(6))
  };

  return {
    metrics,
    overlayPoints: downsampleOverlayPoints(normalizedPoints, speeds, meanSpeed)
  };
}

function buildFrequencies(metrics: SomaticTraceMetrics) {
  const tensionIndex = Math.round(clamp(0, metrics.tensionScore * (TRACE_ANCHOR_FREQUENCIES.length - 1), TRACE_ANCHOR_FREQUENCIES.length - 1));
  const coherenceIndex = Math.round(
    clamp(0, metrics.coherenceScore * (RELEASE_FREQUENCY_HINTS.length - 1), RELEASE_FREQUENCY_HINTS.length - 1)
  );

  const anchor = TRACE_ANCHOR_FREQUENCIES[tensionIndex];
  const releaseAnchor = RELEASE_FREQUENCY_HINTS[coherenceIndex];
  const liftFactor = 1 + (0.5 - metrics.centroidY) * 0.36;
  const spreadFactor = 1.2 + metrics.curvature * 0.32 + metrics.directionChangeRatio * 0.24;

  const pool = [
    anchor,
    anchor * spreadFactor,
    releaseAnchor,
    anchor * 2,
    releaseAnchor * 1.5,
    anchor * liftFactor
  ];

  const desiredCount = metrics.tensionScore > 0.66 ? 5 : metrics.tensionScore > 0.34 ? 4 : 3;

  const unique = Array.from(
    new Set(
      pool
        .map((entry) => normalizeFrequency(entry))
        .filter((entry) => Number.isFinite(entry))
    )
  );

  return unique.slice(0, desiredCount);
}

function buildFrequencyVolumes(frequencies: number[], metrics: SomaticTraceMetrics) {
  const base = clamp(0.35, 0.7 + metrics.coherenceScore * 0.2, 0.94);
  return Object.fromEntries(
    frequencies.map((frequency, index) => {
      const taper = index * 0.12;
      const value = clamp(0.2, base - taper + metrics.tensionScore * 0.08, 1);
      return [frequencyKey(frequency), Number(value.toFixed(3))];
    })
  );
}

export function buildSomaticTraceSession(analysis: SomaticTraceAnalysis): SomaticTraceSession {
  const { metrics } = analysis;

  const selectedFrequencies = buildFrequencies(metrics);
  const frequencyVolumes = buildFrequencyVolumes(selectedFrequencies, metrics);

  const mirrorBpm = Number(clamp(52, 64 + metrics.tensionScore * 38 + metrics.directionChangeRatio * 20, 124).toFixed(2));
  const releaseBpm = Number(clamp(42, mirrorBpm * (0.58 + metrics.coherenceScore * 0.18), 76).toFixed(2));

  const mirrorDurationMs = Math.round(clamp(11000, metrics.durationMs * 0.55 + metrics.tensionScore * 6500, 24000));
  const releaseDurationMs = Math.round(clamp(16000, metrics.durationMs * 0.82 + metrics.coherenceScore * 8500, 36000));

  const mirror: SomaticTracePhaseConfig = {
    rhythm: {
      enabled: true,
      bpm: mirrorBpm,
      subdivision: metrics.directionChangeRatio > 0.22 ? '16n' : '8n',
      steps: createMirrorSteps(metrics.directionChangeRatio, metrics.pauseRatio, metrics.jitter)
    },
    modulation: {
      enabled: true,
      rateHz: Number(clamp(0.08, 0.2 + metrics.jitter * 1.5 + metrics.speedVarianceRatio * 0.18, 2.8).toFixed(3)),
      depthHz: Number(clamp(3, 8 + metrics.tensionScore * 30 + metrics.curvature * 12, 64).toFixed(3)),
      waveform: metrics.directionChangeRatio > 0.2 ? 'triangle' : 'sine'
    },
    sweep: {
      enabled: true,
      targetHz: selectedFrequencies[Math.min(selectedFrequencies.length - 1, 1)] ?? 528,
      durationSeconds: Number((mirrorDurationMs / 1000).toFixed(3)),
      curve: metrics.pauseRatio > 0.24 ? 'linear' : 'easeInOut'
    },
    binaural: {
      enabled: true,
      beatHz: Number(clamp(4.5, 7 + metrics.tensionScore * 8, 15).toFixed(3)),
      panSpread: Number(clamp(0.55, 0.82 + metrics.jitter * 0.18, 1).toFixed(3))
    }
  };

  const releaseTarget = selectedFrequencies[Math.min(selectedFrequencies.length - 1, 2)] ?? 432;
  const release: SomaticTracePhaseConfig = {
    rhythm: {
      enabled: true,
      bpm: releaseBpm,
      subdivision: '8n',
      steps: createReleaseSteps(metrics.tensionScore)
    },
    modulation: {
      enabled: true,
      rateHz: Number(clamp(0.05, 0.08 + (1 - metrics.tensionScore) * 0.26, 0.9).toFixed(3)),
      depthHz: Number(clamp(1.2, 2 + metrics.coherenceScore * 6.2, 12).toFixed(3)),
      waveform: 'sine'
    },
    sweep: {
      enabled: true,
      targetHz: normalizeFrequency(releaseTarget),
      durationSeconds: Number((releaseDurationMs / 1000).toFixed(3)),
      curve: 'easeInOut'
    },
    binaural: {
      enabled: true,
      beatHz: Number(clamp(2.4, 3.2 + metrics.coherenceScore * 3.1, 7.5).toFixed(3)),
      panSpread: Number(clamp(0.36, 0.46 + metrics.coherenceScore * 0.24, 0.8).toFixed(3))
    }
  };

  return {
    id: `somatic-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    metrics,
    overlayPoints: analysis.overlayPoints,
    selectedFrequencies,
    frequencyVolumes,
    mixStyle: metrics.complexityScore > 0.56 ? 'golden432' : 'manual',
    waveform: metrics.tensionScore > 0.65 ? 'triangle' : 'sine',
    mirror,
    release,
    phaseDurationsMs: {
      mirror: mirrorDurationMs,
      release: releaseDurationMs,
      total: mirrorDurationMs + releaseDurationMs
    }
  };
}

export function resolveSomaticTraceRuntime(session: SomaticTraceSession, elapsedMs: number): SomaticTraceRuntime {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const mirrorDuration = Math.max(1, session.phaseDurationsMs.mirror);
  const releaseDuration = Math.max(1, session.phaseDurationsMs.release);
  const totalDuration = Math.max(1, session.phaseDurationsMs.total);

  let phase: SomaticTracePhase;
  let phaseProgress: number;

  if (safeElapsedMs < mirrorDuration) {
    phase = 'mirror';
    phaseProgress = safeElapsedMs / mirrorDuration;
  } else if (safeElapsedMs < mirrorDuration + releaseDuration) {
    phase = 'release';
    phaseProgress = (safeElapsedMs - mirrorDuration) / releaseDuration;
  } else {
    phase = 'complete';
    phaseProgress = 1;
  }

  const overallProgress = clamp(0, safeElapsedMs / totalDuration, 1);

  const blend = phase === 'mirror'
    ? clamp(0, (phaseProgress - 0.65) / 0.35, 0.3)
    : phase === 'release'
      ? phaseProgress
      : 1;

  const rhythm = interpolateRhythm(session.mirror.rhythm, session.release.rhythm, blend);
  const modulation = interpolateModulation(session.mirror.modulation, session.release.modulation, blend);
  const sweep = interpolateSweep(session.mirror.sweep, session.release.sweep, blend);
  const binaural = interpolateBinaural(session.mirror.binaural, session.release.binaural, blend);

  const releaseProgress = phase === 'release' ? phaseProgress : phase === 'complete' ? 1 : 0;

  return {
    phase,
    phaseProgress: Number(clamp(0, phaseProgress, 1).toFixed(4)),
    overallProgress: Number(overallProgress.toFixed(4)),
    rhythm,
    modulation,
    sweep,
    binaural,
    overlay: {
      phase,
      phaseProgress: Number(clamp(0, phaseProgress, 1).toFixed(4)),
      overallProgress: Number(overallProgress.toFixed(4)),
      tension: Number(clamp(0, session.metrics.tensionScore * (1 - releaseProgress * 0.85), 1).toFixed(4)),
      coherence: Number(clamp(0.05, session.metrics.coherenceScore + releaseProgress * 0.24, 1).toFixed(4)),
      points: session.overlayPoints
    }
  };
}
