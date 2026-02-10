import type { WaveformType, FrequencyConfig } from '@/lib/audio/FrequencyGenerator';

export type MixStyle = 'manual' | 'golden432';

interface MixLayer {
  power: number;
  gain: number;
  pan: number;
  detuneCents: number;
  modulationRateHz: number;
  modulationDepth: number;
}

const GOLDEN_RATIO = 1.61803398875;
const GOLDEN_432_LAYERS: MixLayer[] = [
  { power: -3, gain: 0.2, pan: -0.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: -2, gain: 0.12, pan: -0.7, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: -1, gain: 0.38, pan: -0.48, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 0, gain: 1, pan: 0, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 0, gain: 0.42, pan: -0.12, detuneCents: -2.2, modulationRateHz: 0, modulationDepth: 0 },
  { power: 0, gain: 0.42, pan: 0.12, detuneCents: 2.2, modulationRateHz: 0, modulationDepth: 0 },
  { power: 1, gain: 0.28, pan: 0.48, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 2, gain: 0.08, pan: 0.74, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 3, gain: 0.16, pan: 0.86, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: -4, gain: 0.09, pan: -0.9, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 }
];

function roundHz(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeToRange(value: number, min = 48, max = 2200) {
  let normalized = value;
  while (normalized < min) {
    normalized *= 2;
  }
  while (normalized > max) {
    normalized /= 2;
  }
  return normalized;
}

export function buildFrequencyMix(options: {
  mixStyle: MixStyle;
  selectedFrequencies: number[];
  waveform: WaveformType;
  volume: number;
}): FrequencyConfig[] {
  const { mixStyle, selectedFrequencies, waveform, volume } = options;

  if (mixStyle === 'manual') {
    return selectedFrequencies.map((frequency) => ({
      frequency,
      volume,
      waveform
    }));
  }

  const baseFrequencies = selectedFrequencies;
  if (baseFrequencies.length === 0) {
    return [];
  }
  const spacing = Math.max(1, baseFrequencies.length - 1);
  const groupScale = 1 / Math.sqrt(baseFrequencies.length);

  return baseFrequencies.flatMap((baseFrequency, baseIndex) => {
    const baseSpread = ((baseIndex / spacing) * 2 - 1) * 0.18;

    return GOLDEN_432_LAYERS.map((layer) => {
      const ladderFrequency = normalizeToRange(baseFrequency * GOLDEN_RATIO ** layer.power);
      return {
        frequency: roundHz(ladderFrequency),
        volume: clamp(0.01, volume * layer.gain * groupScale, 0.95),
        waveform,
        pan: clamp(-1, layer.pan + baseSpread, 1),
        detuneCents: layer.detuneCents,
        modulationRateHz: layer.modulationRateHz,
        modulationDepth: layer.modulationDepth
      };
    });
  });
}

export function frequenciesForStorage(mixStyle: MixStyle, selectedFrequencies: number[], voices: FrequencyConfig[]) {
  if (mixStyle === 'manual') {
    return selectedFrequencies;
  }

  return voices.map((voice) => roundHz(voice.frequency));
}
