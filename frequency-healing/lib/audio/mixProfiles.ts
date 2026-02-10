import type { WaveformType, FrequencyConfig } from '@/lib/audio/FrequencyGenerator';
import {
  clamp as clampValue,
  frequencyKey,
  normalizeFrequency,
  type BinauralConfig
} from '@/lib/audio/audioConfig';

export type MixStyle = 'manual' | 'golden432';

interface MixLayer {
  power: number;
  gain: number;
  pan: number;
  attackSeconds: number;
  releaseSeconds: number;
  detuneCents: number;
  modulationRateHz: number;
  modulationDepth: number;
}

const GOLDEN_RATIO = 1.61803398875;
const GOLDEN_432_LAYERS: MixLayer[] = [
  { power: -4, gain: 0.24, pan: -0.12, attackSeconds: 4.5, releaseSeconds: 2.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: -3, gain: 0.36, pan: -0.94, attackSeconds: 4.8, releaseSeconds: 2.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: -2, gain: 0.34, pan: 0.94, attackSeconds: 5.2, releaseSeconds: 2.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: -1, gain: 0.42, pan: -0.88, attackSeconds: 5.5, releaseSeconds: 3.1, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 0, gain: 1, pan: 0, attackSeconds: 6.2, releaseSeconds: 3.2, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 0, gain: 0.34, pan: -0.08, attackSeconds: 5.8, releaseSeconds: 3.2, detuneCents: -2.2, modulationRateHz: 0, modulationDepth: 0 },
  { power: 0, gain: 0.34, pan: 0.08, attackSeconds: 5.8, releaseSeconds: 3.2, detuneCents: 2.2, modulationRateHz: 0, modulationDepth: 0 },
  { power: 1, gain: 0.26, pan: 0.88, attackSeconds: 5.2, releaseSeconds: 2.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 2, gain: 0.14, pan: -0.94, attackSeconds: 4.8, releaseSeconds: 2.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 },
  { power: 3, gain: 0.12, pan: 0.97, attackSeconds: 4.2, releaseSeconds: 2.8, detuneCents: 0, modulationRateHz: 0, modulationDepth: 0 }
];

function roundHz(value: number) {
  return Math.round(value * 100) / 100;
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
  frequencyVolumes?: Record<string, number>;
  binaural?: BinauralConfig;
}): FrequencyConfig[] {
  const { mixStyle, selectedFrequencies, waveform, volume, frequencyVolumes = {}, binaural } = options;

  const baseFrequencies = selectedFrequencies.map((value) => normalizeFrequency(value));
  if (baseFrequencies.length === 0) {
    return [];
  }

  const getVoiceGain = (frequency: number) => {
    const key = frequencyKey(frequency);
    const explicit = frequencyVolumes[key];
    if (typeof explicit === 'number' && Number.isFinite(explicit)) {
      return clampValue(0.01, explicit, 1);
    }
    const fallback = frequencyVolumes[String(Math.round(frequency))];
    if (typeof fallback === 'number' && Number.isFinite(fallback)) {
      return clampValue(0.01, fallback, 1);
    }
    return 1;
  };

  if (binaural?.enabled) {
    const beatOffset = clampValue(0.05, binaural.beatHz / 2, 20);
    const panSpread = clampValue(0.2, binaural.panSpread, 1);

    return baseFrequencies.flatMap((frequency) => {
      const voiceGain = getVoiceGain(frequency);
      const baseGain = clampValue(0.01, volume * voiceGain, 0.95);
      return [
        {
          frequency: roundHz(Math.max(20, frequency - beatOffset)),
          volume: clampValue(0.01, baseGain * 0.65, 0.95),
          waveform,
          pan: -panSpread
        },
        {
          frequency: roundHz(frequency + beatOffset),
          volume: clampValue(0.01, baseGain * 0.65, 0.95),
          waveform,
          pan: panSpread
        }
      ];
    });
  }

  if (mixStyle === 'manual') {
    return baseFrequencies.map((frequency) => ({
      frequency,
      volume: clampValue(0.01, volume * getVoiceGain(frequency), 0.95),
      waveform
    }));
  }

  const spacing = Math.max(1, baseFrequencies.length - 1);
  const groupScale = 1 / Math.sqrt(baseFrequencies.length);

  return baseFrequencies.flatMap((baseFrequency, baseIndex) => {
    const baseSpread = ((baseIndex / spacing) * 2 - 1) * 0.18;
    const voiceGain = getVoiceGain(baseFrequency);

    return GOLDEN_432_LAYERS.map((layer) => {
      const ladderFrequency = normalizeToRange(baseFrequency * GOLDEN_RATIO ** layer.power);
      return {
        frequency: roundHz(ladderFrequency),
        volume: clampValue(0.01, volume * layer.gain * groupScale * voiceGain, 0.95),
        waveform,
        pan: clampValue(-1, layer.pan + baseSpread, 1),
        attackSeconds: layer.attackSeconds,
        releaseSeconds: layer.releaseSeconds,
        detuneCents: layer.detuneCents,
        modulationRateHz: layer.modulationRateHz,
        modulationDepth: layer.modulationDepth
      };
    });
  });
}

export function frequenciesForStorage(mixStyle: MixStyle, selectedFrequencies: number[], voices: FrequencyConfig[]) {
  if (selectedFrequencies.length > 0) {
    return Array.from(new Set(selectedFrequencies.map((frequency) => roundHz(normalizeFrequency(frequency)))));
  }

  if (mixStyle === 'manual') {
    return selectedFrequencies.map((frequency) => roundHz(normalizeFrequency(frequency)));
  }

  return voices.map((voice) => roundHz(voice.frequency));
}
