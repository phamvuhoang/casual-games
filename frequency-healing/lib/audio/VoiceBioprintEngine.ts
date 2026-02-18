import type { SpectrumSnapshot } from '@/lib/audio/MicrophoneAnalysisService';

export interface VoiceBioprintRecommendation {
  frequency: number;
  gain: number;
  score: number;
  reason: string;
}

export interface VoiceBioprintProfile {
  capturedAt: string;
  confidence: number;
  dominantFrequencies: number[];
  portrait: number[];
  bandEnergy: {
    low: number;
    mid: number;
    upperMid: number;
    high: number;
  };
  noiseFloorDb: number;
  peakDb: number;
  frameCount: number;
  captureDurationMs: number;
  analysisDurationMs: number;
  recommendations: VoiceBioprintRecommendation[];
}

interface FrequencyTarget {
  frequency: number;
  label: string;
  reason: string;
}

const TARGETS: FrequencyTarget[] = [
  { frequency: 174, label: 'grounding', reason: 'Adds low-end grounding texture' },
  { frequency: 285, label: 'stability', reason: 'Supports low-mid stability band' },
  { frequency: 396, label: 'root', reason: 'Reinforces lower vocal fundamentals' },
  { frequency: 417, label: 'flow', reason: 'Fills lower-mid transition band' },
  { frequency: 432, label: 'balance', reason: 'Balances center vocal harmonics' },
  { frequency: 528, label: 'clarity', reason: 'Strengthens mid clarity region' },
  { frequency: 639, label: 'presence', reason: 'Boosts upper-mid presence region' },
  { frequency: 741, label: 'focus', reason: 'Adds articulation-focused upper mids' },
  { frequency: 852, label: 'brightness', reason: 'Adds higher overtone brightness' },
  { frequency: 963, label: 'air', reason: 'Supports upper overtone air band' }
];

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toHz(bin: number, sampleRate: number, fftSize: number) {
  return (bin * sampleRate) / fftSize;
}

function dbToLinear(value: number) {
  return 10 ** (value / 20);
}

function linearToScore(value: number, min: number, max: number) {
  if (max <= min) {
    return 0;
  }
  return clamp(0, (value - min) / (max - min), 1);
}

function averageBandLevel(snapshot: SpectrumSnapshot, fromHz: number, toHz: number) {
  const startBin = Math.max(0, Math.floor((fromHz * snapshot.fftSize) / snapshot.sampleRate));
  const endBin = Math.min(
    snapshot.averageBins.length - 1,
    Math.ceil((toHz * snapshot.fftSize) / snapshot.sampleRate)
  );

  if (endBin <= startBin) {
    return 0;
  }

  let sum = 0;
  let count = 0;
  for (let index = startBin; index <= endBin; index += 1) {
    const db = snapshot.averageBins[index];
    if (!Number.isFinite(db)) {
      continue;
    }
    sum += dbToLinear(db);
    count += 1;
  }

  return count > 0 ? sum / count : 0;
}

function findDominantFrequencies(snapshot: SpectrumSnapshot, maxCount = 4) {
  const peaks: Array<{ frequency: number; db: number }> = [];
  const minHz = 60;
  const maxHz = 1400;

  for (let index = 2; index < snapshot.averageBins.length - 2; index += 1) {
    const hz = toHz(index, snapshot.sampleRate, snapshot.fftSize);
    if (hz < minHz || hz > maxHz) {
      continue;
    }

    const current = snapshot.averageBins[index];
    const prev = snapshot.averageBins[index - 1];
    const next = snapshot.averageBins[index + 1];
    if (current <= prev || current <= next) {
      continue;
    }

    peaks.push({ frequency: Math.round(hz * 100) / 100, db: current });
  }

  return peaks
    .sort((a, b) => b.db - a.db)
    .slice(0, maxCount)
    .map((peak) => peak.frequency);
}

function buildPortrait(snapshot: SpectrumSnapshot) {
  const bandCount = 24;
  const maxHz = 2400;
  const binsPerBand = Math.max(
    1,
    Math.floor(((maxHz * snapshot.fftSize) / snapshot.sampleRate) / bandCount)
  );

  const values: number[] = [];
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const start = bandIndex * binsPerBand;
    const end = Math.min(snapshot.averageBins.length - 1, start + binsPerBand - 1);

    let sum = 0;
    let count = 0;
    for (let index = start; index <= end; index += 1) {
      const db = snapshot.averageBins[index];
      if (!Number.isFinite(db)) {
        continue;
      }
      sum += dbToLinear(db);
      count += 1;
    }

    values.push(count > 0 ? sum / count : 0);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value) => Number(linearToScore(value, min, max).toFixed(3)));
}

function recommendFrequencies(snapshot: SpectrumSnapshot) {
  const targetScores = TARGETS.map((target) => {
    const centerBin = Math.round((target.frequency * snapshot.fftSize) / snapshot.sampleRate);
    const low = Math.max(0, centerBin - 1);
    const high = Math.min(snapshot.averageBins.length - 1, centerBin + 1);

    let sumDb = 0;
    let count = 0;
    for (let index = low; index <= high; index += 1) {
      const db = snapshot.averageBins[index];
      if (!Number.isFinite(db)) {
        continue;
      }
      sumDb += db;
      count += 1;
    }

    const centerDb = count > 0 ? sumDb / count : -130;
    return { ...target, centerDb };
  });

  const globalDbAverage =
    targetScores.reduce((sum, item) => sum + item.centerDb, 0) / Math.max(1, targetScores.length);

  const ranked = targetScores
    .map((target) => {
      const deficitDb = globalDbAverage - target.centerDb;
      const score = clamp(0, deficitDb / 18, 1);
      const gain = clamp(0.35, 0.45 + score * 0.4, 0.85);
      return {
        frequency: target.frequency,
        gain: Number(gain.toFixed(2)),
        score: Number(score.toFixed(2)),
        reason: target.reason
      } satisfies VoiceBioprintRecommendation;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (ranked.every((item) => item.score <= 0.12)) {
    return [
      { frequency: 432, gain: 0.62, score: 0.4, reason: 'Balanced fallback for center harmonics' },
      { frequency: 528, gain: 0.58, score: 0.38, reason: 'Balanced fallback for vocal clarity' },
      { frequency: 639, gain: 0.5, score: 0.32, reason: 'Balanced fallback for upper-mid support' }
    ] satisfies VoiceBioprintRecommendation[];
  }

  return ranked;
}

function resolveConfidence(snapshot: SpectrumSnapshot, portrait: number[]) {
  const dynamicRange = clamp(0, snapshot.peakDb - snapshot.noiseFloorDb, 42);
  const dynamicRangeScore = dynamicRange / 42;
  const frameScore = clamp(0, snapshot.frameCount / 100, 1);
  const portraitSpread = clamp(0, Math.max(...portrait) - Math.min(...portrait), 1);

  const combined = dynamicRangeScore * 0.45 + frameScore * 0.3 + portraitSpread * 0.25;
  return Number(clamp(0.2, combined, 0.98).toFixed(2));
}

export function analyzeVoiceBioprint(snapshot: SpectrumSnapshot) {
  const analysisStart = performance.now();
  const portrait = buildPortrait(snapshot);
  const recommendations = recommendFrequencies(snapshot);

  const profile = {
    capturedAt: new Date().toISOString(),
    confidence: resolveConfidence(snapshot, portrait),
    dominantFrequencies: findDominantFrequencies(snapshot),
    portrait,
    bandEnergy: {
      low: Number(averageBandLevel(snapshot, 80, 220).toFixed(4)),
      mid: Number(averageBandLevel(snapshot, 220, 600).toFixed(4)),
      upperMid: Number(averageBandLevel(snapshot, 600, 1400).toFixed(4)),
      high: Number(averageBandLevel(snapshot, 1400, 3200).toFixed(4))
    },
    noiseFloorDb: Number(snapshot.noiseFloorDb.toFixed(2)),
    peakDb: Number(snapshot.peakDb.toFixed(2)),
    frameCount: snapshot.frameCount,
    captureDurationMs: snapshot.captureDurationMs,
    analysisDurationMs: Math.round(performance.now() - analysisStart),
    recommendations
  } satisfies VoiceBioprintProfile;

  return profile;
}

export function createFallbackVoiceBioprintProfile() {
  return {
    capturedAt: new Date().toISOString(),
    confidence: 0.35,
    dominantFrequencies: [220, 440, 880],
    portrait: [0.22, 0.28, 0.3, 0.35, 0.46, 0.56, 0.66, 0.74, 0.61, 0.54, 0.47, 0.38, 0.32, 0.36, 0.42, 0.48, 0.52, 0.58, 0.63, 0.54, 0.48, 0.4, 0.3, 0.24],
    bandEnergy: {
      low: 0.19,
      mid: 0.24,
      upperMid: 0.22,
      high: 0.15
    },
    noiseFloorDb: -74,
    peakDb: -26,
    frameCount: 0,
    captureDurationMs: 0,
    analysisDurationMs: 0,
    recommendations: [
      { frequency: 432, gain: 0.6, score: 0.4, reason: 'Starter profile center balance' },
      { frequency: 528, gain: 0.56, score: 0.35, reason: 'Starter profile clarity support' },
      { frequency: 639, gain: 0.48, score: 0.3, reason: 'Starter profile upper-mid support' }
    ]
  } satisfies VoiceBioprintProfile;
}

