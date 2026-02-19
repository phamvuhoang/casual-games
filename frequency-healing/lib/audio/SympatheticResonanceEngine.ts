import type { FrequencyConfig, WaveformType } from '@/lib/audio/FrequencyGenerator';
import type { SpectrumSnapshot } from '@/lib/audio/MicrophoneAnalysisService';
import { normalizeFrequency, type SympatheticResonanceMode } from '@/lib/audio/audioConfig';

export interface RoomScanResult {
  capturedAt: string;
  dominantFrequencies: number[];
  spectrumMap: number[];
  confidence: number;
  noiseFloorDb: number;
  peakDb: number;
  dynamicRangeDb: number;
}

export interface RoomResponseTone {
  frequency: number;
  gain: number;
  mode: SympatheticResonanceMode;
}

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toHz(bin: number, sampleRate: number, fftSize: number) {
  return (bin * sampleRate) / fftSize;
}

function dbToLinear(value: number) {
  return 10 ** (value / 20);
}

function buildSpectrumMap(snapshot: SpectrumSnapshot) {
  const bandCount = 28;
  const maxHz = 3200;
  const maxBin = Math.min(
    snapshot.averageBins.length - 1,
    Math.floor((maxHz * snapshot.fftSize) / snapshot.sampleRate)
  );
  const binsPerBand = Math.max(1, Math.floor(maxBin / bandCount));

  const raw: number[] = [];
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const start = bandIndex * binsPerBand;
    const end = Math.min(maxBin, start + binsPerBand);
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
    raw.push(count > 0 ? sum / count : 0);
  }

  const min = Math.min(...raw);
  const max = Math.max(...raw);
  if (max <= min) {
    return raw.map(() => 0);
  }

  return raw.map((value) => Number(((value - min) / (max - min)).toFixed(3)));
}

function findDominantFrequencies(snapshot: SpectrumSnapshot, maxCount = 3) {
  const peaks: Array<{ frequency: number; db: number }> = [];
  const minHz = 45;
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
    .map((peak) => normalizeFrequency(peak.frequency));
}

export function analyzeRoomSpectrum(snapshot: SpectrumSnapshot) {
  const dominantFrequencies = findDominantFrequencies(snapshot, 3);
  const spectrumMap = buildSpectrumMap(snapshot);
  const dynamicRangeDb = clamp(0, snapshot.peakDb - snapshot.noiseFloorDb, 60);
  const frameScore = clamp(0, snapshot.frameCount / 60, 1);
  const rangeScore = dynamicRangeDb / 60;
  const peakPresenceScore = clamp(0, dominantFrequencies.length / 3, 1);
  const confidence = Number((frameScore * 0.3 + rangeScore * 0.45 + peakPresenceScore * 0.25).toFixed(2));

  return {
    capturedAt: new Date().toISOString(),
    dominantFrequencies,
    spectrumMap,
    confidence,
    noiseFloorDb: Number(snapshot.noiseFloorDb.toFixed(2)),
    peakDb: Number(snapshot.peakDb.toFixed(2)),
    dynamicRangeDb: Number(dynamicRangeDb.toFixed(2))
  } satisfies RoomScanResult;
}

export function buildRoomResponseTones(result: RoomScanResult, mode: SympatheticResonanceMode) {
  const tones: RoomResponseTone[] = [];

  if (mode === 'harmonize') {
    const ratios = [1.5, 2, 3];
    result.dominantFrequencies.forEach((frequency, frequencyIndex) => {
      ratios.forEach((ratio, ratioIndex) => {
        const nextFrequency = normalizeFrequency(frequency * ratio);
        if (nextFrequency < 60 || nextFrequency > 2000) {
          return;
        }
        const gainBase = 0.16 - frequencyIndex * 0.02 - ratioIndex * 0.02;
        const gain = clamp(0.05, gainBase * (0.7 + result.confidence * 0.5), 0.2);
        tones.push({
          frequency: nextFrequency,
          gain: Number(gain.toFixed(3)),
          mode
        });
      });
    });
  } else {
    const offsets = [-1.8, 0, 1.8];
    result.dominantFrequencies.forEach((frequency, frequencyIndex) => {
      offsets.forEach((offset, offsetIndex) => {
        const nextFrequency = normalizeFrequency(frequency + offset);
        const gainBase = 0.13 - frequencyIndex * 0.015 - offsetIndex * 0.01;
        const gain = clamp(0.04, gainBase * (0.65 + result.confidence * 0.35), 0.16);
        tones.push({
          frequency: nextFrequency,
          gain: Number(gain.toFixed(3)),
          mode
        });
      });
    });
  }

  const deduped = new Map<number, RoomResponseTone>();
  tones.forEach((tone) => {
    const key = normalizeFrequency(tone.frequency);
    const existing = deduped.get(key);
    if (!existing || tone.gain > existing.gain) {
      deduped.set(key, { ...tone, frequency: key });
    }
  });

  return Array.from(deduped.values())
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 8);
}

export function createRoomResponseVoices(options: {
  tones: RoomResponseTone[];
  mode: SympatheticResonanceMode;
  waveform: WaveformType;
  masterVolume: number;
  confidence: number;
  confidenceThreshold: number;
}): FrequencyConfig[] {
  const { tones, mode, waveform, masterVolume, confidence, confidenceThreshold } = options;
  if (tones.length === 0 || confidence < confidenceThreshold) {
    return [];
  }

  return tones.flatMap((tone, index) => {
    const baseVolume = clamp(0.01, tone.gain * masterVolume, 0.18);
    if (mode === 'harmonize') {
      return [
        {
          frequency: tone.frequency,
          volume: baseVolume,
          waveform,
          pan: index % 2 === 0 ? -0.35 : 0.35,
          attackSeconds: 1.4,
          releaseSeconds: 2.4
        }
      ];
    }

    return [
      {
        frequency: tone.frequency,
        volume: baseVolume * 0.85,
        waveform: 'sine',
        pan: index % 2 === 0 ? -0.45 : 0.45,
        detuneCents: -4,
        attackSeconds: 0.9,
        releaseSeconds: 1.9
      },
      {
        frequency: normalizeFrequency(tone.frequency + 0.9),
        volume: baseVolume * 0.65,
        waveform: 'sine',
        pan: index % 2 === 0 ? 0.45 : -0.45,
        detuneCents: 4,
        attackSeconds: 0.9,
        releaseSeconds: 1.9
      }
    ];
  });
}

