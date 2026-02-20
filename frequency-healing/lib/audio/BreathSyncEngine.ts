import { clamp, type BreathSyncMode, type BreathSyncPhase } from '@/lib/audio/audioConfig';

export interface BreathSyncRuntimeFrame {
  phase: BreathSyncPhase;
  phaseProgress: number;
  breathBpm: number;
  targetBpm: number;
  coherenceScore: number;
  modulationDepthScale: number;
  gainScale: number;
  tempoScale: number;
}

export interface BreathSyncSamplePoint {
  capturedAt: string;
  source: BreathSyncMode;
  breathBpm: number;
  confidence: number;
  coherenceScore: number;
  phase: BreathSyncPhase;
}

export interface BreathSyncSessionSummary {
  sampleCount: number;
  averageBreathBpm: number;
  coherenceScore: number;
  peakCoherenceScore: number;
  timeInCoherencePct: number;
}

function normalizeCyclePosition(elapsedSeconds: number, cycleSeconds: number) {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(cycleSeconds) || cycleSeconds <= 0) {
    return 0;
  }
  const position = elapsedSeconds % cycleSeconds;
  return position < 0 ? position + cycleSeconds : position;
}

export function calculateBreathCoherenceScore(options: {
  breathBpm: number;
  targetBpm: number;
  confidence?: number;
  sensitivity?: number;
}) {
  const breathBpm = clamp(2, options.breathBpm, 30);
  const targetBpm = clamp(3, options.targetBpm, 9);
  const confidence = clamp(0, options.confidence ?? 1, 1);
  const sensitivity = clamp(0.1, options.sensitivity ?? 0.7, 1);
  const driftRatio = Math.abs(breathBpm - targetBpm) / targetBpm;
  const alignment = clamp(0, 1 - driftRatio / 0.7, 1);
  const confidenceWeight = 0.2 + sensitivity * 0.35;
  return Number(clamp(0, alignment * (1 - confidenceWeight) + confidence * confidenceWeight, 1).toFixed(3));
}

export function buildBreathSyncRuntimeFrame(options: {
  elapsedSeconds: number;
  breathBpm: number;
  targetBpm: number;
  inhaleRatio: number;
  confidence?: number;
  sensitivity?: number;
}) {
  const breathBpm = clamp(2, options.breathBpm, 30);
  const targetBpm = clamp(3, options.targetBpm, 9);
  const inhaleRatio = clamp(0.25, options.inhaleRatio, 0.75);
  const cycleSeconds = 60 / breathBpm;
  const cyclePosition = normalizeCyclePosition(options.elapsedSeconds, cycleSeconds);
  const cycleProgress = clamp(0, cyclePosition / cycleSeconds, 1);
  const inhaleWindow = inhaleRatio;

  let phase: BreathSyncPhase = 'exhale';
  let phaseProgress = 0;

  if (cycleProgress < inhaleWindow) {
    phase = 'inhale';
    phaseProgress = inhaleWindow > 0 ? cycleProgress / inhaleWindow : 0;
  } else {
    phase = 'exhale';
    phaseProgress = inhaleWindow < 1 ? (cycleProgress - inhaleWindow) / (1 - inhaleWindow) : 0;
  }

  const coherenceScore = calculateBreathCoherenceScore({
    breathBpm,
    targetBpm,
    confidence: options.confidence ?? 1,
    sensitivity: options.sensitivity ?? 0.7
  });
  const phaseArc = phase === 'inhale' ? phaseProgress : 1 - phaseProgress;
  const gainScale = Number(clamp(0.82, 0.9 + phaseArc * (0.1 + coherenceScore * 0.12), 1.2).toFixed(3));
  const modulationDepthScale = Number(clamp(0.45, 0.62 + coherenceScore * 0.72, 1.5).toFixed(3));
  const tempoScale = Number(clamp(0.86, 0.92 + coherenceScore * 0.14, 1.1).toFixed(3));

  return {
    phase,
    phaseProgress: Number(clamp(0, phaseProgress, 1).toFixed(3)),
    breathBpm: Number(breathBpm.toFixed(2)),
    targetBpm: Number(targetBpm.toFixed(2)),
    coherenceScore,
    modulationDepthScale,
    gainScale,
    tempoScale
  } satisfies BreathSyncRuntimeFrame;
}

export function createBreathSyncSamplePoint(options: {
  source: BreathSyncMode;
  frame: BreathSyncRuntimeFrame;
  confidence?: number;
}) {
  return {
    capturedAt: new Date().toISOString(),
    source: options.source,
    breathBpm: options.frame.breathBpm,
    confidence: Number(clamp(0, options.confidence ?? 1, 1).toFixed(3)),
    coherenceScore: options.frame.coherenceScore,
    phase: options.frame.phase
  } satisfies BreathSyncSamplePoint;
}

export function summarizeBreathSyncSession(samples: BreathSyncSamplePoint[]) {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      averageBreathBpm: 0,
      coherenceScore: 0,
      peakCoherenceScore: 0,
      timeInCoherencePct: 0
    } satisfies BreathSyncSessionSummary;
  }

  const averageBreathBpm =
    samples.reduce((sum, sample) => sum + sample.breathBpm, 0) / Math.max(1, samples.length);
  const coherenceScore =
    samples.reduce((sum, sample) => sum + sample.coherenceScore, 0) / Math.max(1, samples.length);
  const peakCoherenceScore = samples.reduce((peak, sample) => Math.max(peak, sample.coherenceScore), 0);
  const coherentCount = samples.filter((sample) => sample.coherenceScore >= 0.7).length;
  const timeInCoherencePct = coherentCount / Math.max(1, samples.length);

  return {
    sampleCount: samples.length,
    averageBreathBpm: Number(averageBreathBpm.toFixed(2)),
    coherenceScore: Number(coherenceScore.toFixed(3)),
    peakCoherenceScore: Number(peakCoherenceScore.toFixed(3)),
    timeInCoherencePct: Number(timeInCoherencePct.toFixed(3))
  } satisfies BreathSyncSessionSummary;
}
