import type { FrequencyConfig, WaveformType } from '@/lib/audio/FrequencyGenerator';
import { clamp, normalizeFrequency } from '@/lib/audio/audioConfig';
import { SOLFEGGIO_HARMONIC_PRESETS } from '@/lib/utils/constants';

export type HarmonicFieldPresetId = (typeof SOLFEGGIO_HARMONIC_PRESETS)[number]['id'];

export interface HarmonicFieldPreset {
  id: HarmonicFieldPresetId;
  name: string;
  description: string;
  frequencies: number[];
}

export interface HarmonicFieldBundle {
  preset: HarmonicFieldPreset;
  voices: FrequencyConfig[];
  layerFrequencies: number[];
  interferenceFrequencies: number[];
}

export interface HarmonicFieldBuildOptions {
  presetId: string;
  intensity: number;
  includeInterference: boolean;
  spatialMotionEnabled: boolean;
  motionSpeed: number;
  waveform: WaveformType;
  masterVolume: number;
}

const BASE_PANS = [-0.88, -0.56, -0.22, 0.22, 0.56, 0.88];

function normalizeToAudible(value: number, min = 48, max = 1800) {
  let next = value;
  while (next < min) {
    next *= 2;
  }
  while (next > max) {
    next /= 2;
  }
  return normalizeFrequency(next);
}

function dedupeNumbers(values: number[]) {
  return Array.from(new Set(values.map((value) => normalizeFrequency(value))));
}

function asPreset(entry: (typeof SOLFEGGIO_HARMONIC_PRESETS)[number]): HarmonicFieldPreset {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    frequencies: entry.frequencies.map((frequency) => normalizeFrequency(frequency))
  };
}

function buildInterferencePairs(baseFrequencies: number[], limit = 8) {
  const pairs: Array<{ beatHz: number; carrierHz: number; sideAHz: number; sideBHz: number }> = [];
  for (let left = 0; left < baseFrequencies.length; left += 1) {
    for (let right = left + 1; right < baseFrequencies.length; right += 1) {
      const low = baseFrequencies[left];
      const high = baseFrequencies[right];
      const beatHz = Math.abs(high - low);
      if (beatHz < 1 || beatHz > 220) {
        continue;
      }
      const carrierHz = normalizeToAudible((low + high) / 2);
      const sideOffset = clamp(0.35, beatHz * 0.33, 16);
      const sideAHz = normalizeFrequency(carrierHz - sideOffset);
      const sideBHz = normalizeFrequency(carrierHz + sideOffset);
      if (Math.abs(sideBHz - sideAHz) < 0.1) {
        continue;
      }
      pairs.push({
        beatHz: Number(beatHz.toFixed(2)),
        carrierHz,
        sideAHz,
        sideBHz
      });
    }
  }

  return pairs
    .sort((a, b) => a.beatHz - b.beatHz)
    .slice(0, limit);
}

function applySafetyScale(voices: FrequencyConfig[], ceiling = 1.25) {
  const energy = voices.reduce((sum, voice) => sum + clamp(0, voice.volume, 0.95), 0);
  if (energy <= ceiling || energy <= 0) {
    return voices;
  }
  const scale = ceiling / energy;
  return voices.map((voice) => ({
    ...voice,
    volume: Number(clamp(0.005, voice.volume * scale, 0.95).toFixed(4))
  }));
}

export function getSolfeggioHarmonicPresets() {
  return SOLFEGGIO_HARMONIC_PRESETS.map((entry) => asPreset(entry));
}

export function getSolfeggioHarmonicPreset(presetId: string) {
  const preset =
    SOLFEGGIO_HARMONIC_PRESETS.find((entry) => entry.id === presetId) ?? SOLFEGGIO_HARMONIC_PRESETS[0];
  return asPreset(preset);
}

export function buildSolfeggioHarmonicField(options: HarmonicFieldBuildOptions): HarmonicFieldBundle {
  const preset = getSolfeggioHarmonicPreset(options.presetId);
  const intensity = clamp(0.2, options.intensity, 1);
  const motionSpeed = clamp(0.1, options.motionSpeed, 1);
  const masterVolume = clamp(0.05, options.masterVolume, 1);
  const baseFrequencies = dedupeNumbers(preset.frequencies);
  const groupScale = 1 / Math.sqrt(Math.max(1, baseFrequencies.length + 1));
  const voices: FrequencyConfig[] = [];

  baseFrequencies.forEach((frequency, index) => {
    const pan = BASE_PANS[index % BASE_PANS.length];
    const gainBase = clamp(0.01, masterVolume * intensity * groupScale * (0.74 - index * 0.06), 0.22);
    const motionRate = clamp(0.05, 0.08 + motionSpeed * 0.42 + index * 0.03, 1.2);
    const motionDepth = clamp(0.05, 0.12 + motionSpeed * 0.24, 0.42);

    voices.push({
      frequency,
      volume: gainBase,
      waveform: options.waveform,
      pan,
      attackSeconds: 2.4,
      releaseSeconds: 3.3,
      detuneCents: options.spatialMotionEnabled ? (index % 2 === 0 ? -2 : 2) : 0,
      modulationRateHz: options.spatialMotionEnabled ? motionRate : undefined,
      modulationDepth: options.spatialMotionEnabled ? motionDepth : undefined
    });

    if (options.spatialMotionEnabled) {
      voices.push({
        frequency: normalizeFrequency(frequency + (index % 2 === 0 ? 0.11 : -0.11)),
        volume: clamp(0.005, gainBase * 0.58, 0.18),
        waveform: options.waveform,
        pan: clamp(-1, -pan * 0.85, 1),
        attackSeconds: 2.2,
        releaseSeconds: 3.1,
        detuneCents: index % 2 === 0 ? 4 : -4,
        modulationRateHz: clamp(0.05, motionRate * 0.72, 1.1),
        modulationDepth: clamp(0.04, motionDepth * 0.75, 0.35)
      });
    }

    if (intensity >= 0.72) {
      const octave = normalizeToAudible(frequency * 2);
      if (octave !== frequency) {
        voices.push({
          frequency: octave,
          volume: clamp(0.005, gainBase * 0.42, 0.12),
          waveform: 'sine',
          pan: clamp(-1, pan * 0.65, 1),
          attackSeconds: 3,
          releaseSeconds: 3.9
        });
      }
    }
  });

  const pairs = options.includeInterference ? buildInterferencePairs(baseFrequencies) : [];
  pairs.forEach((pair, index) => {
    const gain = clamp(0.005, masterVolume * intensity * groupScale * (0.16 - index * 0.012), 0.08);
    const modulationRateHz = clamp(0.08, pair.beatHz / 8, 6);
    const modulationDepth = clamp(0.04, 0.1 + intensity * 0.22, 0.38);
    const pan = index % 2 === 0 ? -0.3 : 0.3;

    voices.push({
      frequency: pair.carrierHz,
      volume: gain,
      waveform: 'sine',
      pan,
      attackSeconds: 1.6,
      releaseSeconds: 2.6,
      detuneCents: index % 2 === 0 ? -3 : 3,
      modulationRateHz,
      modulationDepth
    });

    if (options.spatialMotionEnabled) {
      voices.push({
        frequency: pair.sideAHz,
        volume: clamp(0.004, gain * 0.55, 0.05),
        waveform: 'sine',
        pan: -0.55,
        attackSeconds: 1.5,
        releaseSeconds: 2.4,
        modulationRateHz: clamp(0.08, modulationRateHz * 0.7, 4.2),
        modulationDepth: clamp(0.03, modulationDepth * 0.65, 0.22)
      });
      voices.push({
        frequency: pair.sideBHz,
        volume: clamp(0.004, gain * 0.55, 0.05),
        waveform: 'sine',
        pan: 0.55,
        attackSeconds: 1.5,
        releaseSeconds: 2.4,
        modulationRateHz: clamp(0.08, modulationRateHz * 0.7, 4.2),
        modulationDepth: clamp(0.03, modulationDepth * 0.65, 0.22)
      });
    }
  });

  const safeVoices = applySafetyScale(voices);
  const layerFrequencies = dedupeNumbers(safeVoices.map((voice) => voice.frequency));
  const interferenceFrequencies = pairs.map((pair) => Number(pair.beatHz.toFixed(2)));

  return {
    preset,
    voices: safeVoices,
    layerFrequencies,
    interferenceFrequencies
  };
}
