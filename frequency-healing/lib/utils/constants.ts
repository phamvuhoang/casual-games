export const PRESET_FREQUENCIES = [
  { id: 'root', name: 'Root Chakra', hz: 396, color: '#e76f51', intention: 'Release fear and guilt' },
  { id: 'sacral', name: 'Sacral Flow', hz: 417, color: '#f4a261', intention: 'Change and transformation' },
  { id: 'natural', name: 'Natural Tuning', hz: 432, color: '#2a9d8f', intention: 'Grounding and clarity' },
  { id: 'love', name: 'Love Frequency', hz: 528, color: '#e9c46a', intention: 'DNA repair and calm' },
  { id: 'heart', name: 'Heart Connection', hz: 639, color: '#8ab17d', intention: 'Relationships and harmony' },
  { id: 'intuition', name: 'Intuition Gate', hz: 852, color: '#3a6ea5', intention: 'Spiritual awareness' },
  { id: 'awakening', name: 'Awakening', hz: 963, color: '#457b9d', intention: 'Higher consciousness' }
];

export const WAVEFORMS = ['sine', 'triangle', 'square', 'sawtooth'] as const;
export const VISUALIZATION_TYPES = ['waveform', 'particles', 'mandala', 'orbital'] as const;
export const AMBIENT_SOUNDS = ['none', 'rain', 'ocean', 'forest', 'bells'] as const;
export const AUDIO_FORMATS = ['webm', 'wav', 'mp3'] as const;
export const MIX_STYLES = ['manual', 'golden432'] as const;

export const DEFAULT_DURATION = 300;
export const MAX_FREQUENCIES = 6;
const MP3_MAX_BYTES_FALLBACK = 20 * 1024 * 1024;
const mp3BytesEnv = Number(process.env.NEXT_PUBLIC_MP3_MAX_BYTES);
export const MP3_MAX_BYTES =
  Number.isFinite(mp3BytesEnv) && mp3BytesEnv > 0 ? mp3BytesEnv : MP3_MAX_BYTES_FALLBACK;
const MP3_ESTIMATE_SAMPLE_RATE = 44100;
const MP3_ESTIMATE_CHANNELS = 2;
const MP3_ESTIMATE_BYTES_PER_SAMPLE = 2;
export const MP3_ESTIMATED_MAX_SECONDS = Math.floor(
  MP3_MAX_BYTES / (MP3_ESTIMATE_SAMPLE_RATE * MP3_ESTIMATE_CHANNELS * MP3_ESTIMATE_BYTES_PER_SAMPLE)
);

export const AUDIO_BUCKET = 'frequency-audio';
export const VIDEO_BUCKET = 'frequency-video';
export const THUMBNAIL_BUCKET = 'frequency-thumbnails';
