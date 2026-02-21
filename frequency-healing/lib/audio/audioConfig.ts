import type { Json } from '@/lib/supabase/types';

export const MIN_CUSTOM_FREQUENCY_HZ = 20;
export const MAX_CUSTOM_FREQUENCY_HZ = 2000;
export const MAX_AUDIO_STEPS = 16;

export type RhythmSubdivision = '4n' | '8n' | '16n' | '8t';
export type AutomationCurve = 'linear' | 'exponential' | 'easeInOut';
export type LfoWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface RhythmConfig {
  enabled: boolean;
  bpm: number;
  subdivision: RhythmSubdivision;
  steps: boolean[];
}

export interface ModulationConfig {
  enabled: boolean;
  rateHz: number;
  depthHz: number;
  waveform: LfoWaveform;
}

export interface SweepConfig {
  enabled: boolean;
  targetHz: number;
  durationSeconds: number;
  curve: AutomationCurve;
}

export interface BinauralConfig {
  enabled: boolean;
  beatHz: number;
  panSpread: number;
}

export interface VoiceBioprintRecommendationConfig {
  frequency: number;
  gain: number;
  score: number;
  reason: string;
  reasonKey?: string;
}

export interface VoiceBioprintConfig {
  enabled: boolean;
  disclaimerAccepted: boolean;
  lastCapturedAt: string | null;
  confidence: number;
  analysisDurationMs: number;
  profileId: string | null;
  recommendations: VoiceBioprintRecommendationConfig[];
}

export type SympatheticResonanceMode = 'harmonize' | 'cleanse';

export interface SympatheticResonanceConfig {
  enabled: boolean;
  mode: SympatheticResonanceMode;
  scanIntervalSeconds: number;
  confidenceThreshold: number;
  calibratedNoiseFloorDb: number | null;
  lastScanAt: string | null;
  lastConfidence: number;
  lastDominantFrequencies: number[];
}

export type AdaptiveJourneyIntent = 'sleep' | 'focus' | 'meditation' | 'creative';
export type AdaptiveJourneyBrainState = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

export interface AdaptiveJourneyStepConfig {
  state: AdaptiveJourneyBrainState;
  beatHz: number;
  minutes: number;
}

export interface AdaptiveBinauralJourneyConfig {
  enabled: boolean;
  intent: AdaptiveJourneyIntent;
  durationMinutes: number;
  micAdaptationEnabled: boolean;
  lastBreathBpm: number | null;
  lastAdaptiveOffsetHz: number;
  progress: number;
  currentState: AdaptiveJourneyBrainState;
  currentBeatHz: number;
  steps: AdaptiveJourneyStepConfig[];
}

export type BreathSyncMode = 'manual' | 'microphone';
export type BreathSyncPhase = 'inhale' | 'exhale';

export interface BreathSyncConfig {
  enabled: boolean;
  mode: BreathSyncMode;
  targetBpm: number;
  inhaleRatio: number;
  sensitivity: number;
  calibrationNoiseFloorDb: number | null;
  lastBreathBpm: number | null;
  coherenceScore: number;
  phase: BreathSyncPhase;
  phaseProgress: number;
  lastSampledAt: string | null;
}

export interface IntentionImprintConfig {
  enabled: boolean;
  disclaimerAccepted: boolean;
  intentionText: string;
  extractedKeywords: string[];
  mappedFrequencies: number[];
  mappingConfidence: number;
  modulationRateHz: number;
  modulationDepthHz: number;
  ritualIntensity: number;
  certificateSeed: string | null;
  lastImprintedAt: string | null;
}

export interface HarmonicFieldConfig {
  enabled: boolean;
  presetId: string;
  intensity: number;
  includeInterference: boolean;
  spatialMotionEnabled: boolean;
  motionSpeed: number;
  lastFieldAt: string | null;
  lastLayerFrequencies: number[];
  lastInterferenceFrequencies: number[];
}

export interface InnovationConfig {
  voiceBioprint: VoiceBioprintConfig;
  sympatheticResonance: SympatheticResonanceConfig;
  adaptiveBinauralJourney: AdaptiveBinauralJourneyConfig;
  breathSync: BreathSyncConfig;
  intentionImprint: IntentionImprintConfig;
  harmonicField: HarmonicFieldConfig;
}

export interface AudioConfigShape {
  version: 2;
  selectedFrequencies: number[];
  frequencyVolumes: Record<string, number>;
  rhythm: RhythmConfig;
  modulation: ModulationConfig;
  sweep: SweepConfig;
  binaural: BinauralConfig;
  innovation: InnovationConfig;
}

const DEFAULT_STEPS = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
const VOICE_BIOPRINT_REASON_TO_KEY: Record<string, string> = {
  'Adds low-end grounding texture': 'addsLowEndGroundingTexture',
  'Supports low-mid stability band': 'supportsLowMidStabilityBand',
  'Reinforces lower vocal fundamentals': 'reinforcesLowerVocalFundamentals',
  'Fills lower-mid transition band': 'fillsLowerMidTransitionBand',
  'Balances center vocal harmonics': 'balancesCenterVocalHarmonics',
  'Strengthens mid clarity region': 'strengthensMidClarityRegion',
  'Boosts upper-mid presence region': 'boostsUpperMidPresenceRegion',
  'Adds articulation-focused upper mids': 'addsArticulationFocusedUpperMids',
  'Adds higher overtone brightness': 'addsHigherOvertoneBrightness',
  'Supports upper overtone air band': 'supportsUpperOvertoneAirBand',
  'Balanced fallback for center harmonics': 'balancedFallbackCenterHarmonics',
  'Balanced fallback for vocal clarity': 'balancedFallbackVocalClarity',
  'Balanced fallback for upper-mid support': 'balancedFallbackUpperMidSupport',
  'Starter profile center balance': 'starterProfileCenterBalance',
  'Starter profile clarity support': 'starterProfileClaritySupport',
  'Starter profile upper-mid support': 'starterProfileUpperMidSupport',
  'Personalized recommendation': 'personalizedRecommendation'
};

const DEFAULT_CONFIG: AudioConfigShape = {
  version: 2,
  selectedFrequencies: [],
  frequencyVolumes: {},
  rhythm: {
    enabled: false,
    bpm: 72,
    subdivision: '16n',
    steps: DEFAULT_STEPS
  },
  modulation: {
    enabled: false,
    rateHz: 0.18,
    depthHz: 12,
    waveform: 'sine'
  },
  sweep: {
    enabled: false,
    targetHz: 528,
    durationSeconds: 18,
    curve: 'easeInOut'
  },
  binaural: {
    enabled: false,
    beatHz: 8,
    panSpread: 0.85
  },
  innovation: {
    voiceBioprint: {
      enabled: false,
      disclaimerAccepted: false,
      lastCapturedAt: null,
      confidence: 0,
      analysisDurationMs: 0,
      profileId: null,
      recommendations: []
    },
    sympatheticResonance: {
      enabled: false,
      mode: 'harmonize',
      scanIntervalSeconds: 5,
      confidenceThreshold: 0.35,
      calibratedNoiseFloorDb: null,
      lastScanAt: null,
      lastConfidence: 0,
      lastDominantFrequencies: []
    },
    adaptiveBinauralJourney: {
      enabled: false,
      intent: 'meditation',
      durationMinutes: 24,
      micAdaptationEnabled: false,
      lastBreathBpm: null,
      lastAdaptiveOffsetHz: 0,
      progress: 0,
      currentState: 'alpha',
      currentBeatHz: 8,
      steps: [
        { state: 'alpha', beatHz: 10, minutes: 6 },
        { state: 'theta', beatHz: 7, minutes: 10 },
        { state: 'theta', beatHz: 5.5, minutes: 5 },
        { state: 'delta', beatHz: 3.5, minutes: 3 }
      ]
    },
    breathSync: {
      enabled: false,
      mode: 'manual',
      targetBpm: 5.5,
      inhaleRatio: 0.45,
      sensitivity: 0.7,
      calibrationNoiseFloorDb: null,
      lastBreathBpm: null,
      coherenceScore: 0,
      phase: 'inhale',
      phaseProgress: 0,
      lastSampledAt: null
    },
    intentionImprint: {
      enabled: false,
      disclaimerAccepted: false,
      intentionText: '',
      extractedKeywords: [],
      mappedFrequencies: [],
      mappingConfidence: 0,
      modulationRateHz: 0.22,
      modulationDepthHz: 7.4,
      ritualIntensity: 0.45,
      certificateSeed: null,
      lastImprintedAt: null
    },
    harmonicField: {
      enabled: false,
      presetId: 'chakra_ladder',
      intensity: 0.72,
      includeInterference: true,
      spatialMotionEnabled: false,
      motionSpeed: 0.5,
      lastFieldAt: null,
      lastLayerFrequencies: [],
      lastInterferenceFrequencies: []
    }
  }
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asString<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  if (typeof value !== 'string') {
    return fallback;
  }
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function inferVoiceBioprintReasonKey(reason: string) {
  return VOICE_BIOPRINT_REASON_TO_KEY[reason] ?? null;
}

export function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeFrequency(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return clamp(MIN_CUSTOM_FREQUENCY_HZ, rounded, MAX_CUSTOM_FREQUENCY_HZ);
}

export function frequencyKey(value: number) {
  return normalizeFrequency(value).toFixed(2);
}

export function createDefaultAudioConfig(): AudioConfigShape {
  return {
    ...DEFAULT_CONFIG,
    selectedFrequencies: [...DEFAULT_CONFIG.selectedFrequencies],
    frequencyVolumes: { ...DEFAULT_CONFIG.frequencyVolumes },
    rhythm: {
      ...DEFAULT_CONFIG.rhythm,
      steps: [...DEFAULT_CONFIG.rhythm.steps]
    },
    modulation: { ...DEFAULT_CONFIG.modulation },
    sweep: { ...DEFAULT_CONFIG.sweep },
    binaural: { ...DEFAULT_CONFIG.binaural },
    innovation: {
      voiceBioprint: {
        ...DEFAULT_CONFIG.innovation.voiceBioprint,
        recommendations: [...DEFAULT_CONFIG.innovation.voiceBioprint.recommendations]
      },
      sympatheticResonance: {
        ...DEFAULT_CONFIG.innovation.sympatheticResonance,
        lastDominantFrequencies: [...DEFAULT_CONFIG.innovation.sympatheticResonance.lastDominantFrequencies]
      },
      adaptiveBinauralJourney: {
        ...DEFAULT_CONFIG.innovation.adaptiveBinauralJourney,
        steps: DEFAULT_CONFIG.innovation.adaptiveBinauralJourney.steps.map((entry) => ({ ...entry }))
      },
      breathSync: { ...DEFAULT_CONFIG.innovation.breathSync },
      intentionImprint: {
        ...DEFAULT_CONFIG.innovation.intentionImprint,
        extractedKeywords: [...DEFAULT_CONFIG.innovation.intentionImprint.extractedKeywords],
        mappedFrequencies: [...DEFAULT_CONFIG.innovation.intentionImprint.mappedFrequencies]
      },
      harmonicField: {
        ...DEFAULT_CONFIG.innovation.harmonicField,
        lastLayerFrequencies: [...DEFAULT_CONFIG.innovation.harmonicField.lastLayerFrequencies],
        lastInterferenceFrequencies: [...DEFAULT_CONFIG.innovation.harmonicField.lastInterferenceFrequencies]
      }
    }
  };
}

export function normalizeRhythmSteps(input: unknown) {
  if (!Array.isArray(input) || input.length === 0) {
    return [...DEFAULT_CONFIG.rhythm.steps];
  }

  const steps = input
    .slice(0, MAX_AUDIO_STEPS)
    .map((value) => Boolean(value));

  while (steps.length < MAX_AUDIO_STEPS) {
    steps.push(false);
  }

  if (!steps.some(Boolean)) {
    steps[0] = true;
  }

  return steps;
}

export function parseAudioConfig(raw: Json | null | undefined): AudioConfigShape {
  const config = createDefaultAudioConfig();
  const object = asObject(raw);

  if (!object) {
    return config;
  }

  const rawFrequencies = Array.isArray(object.selectedFrequencies) ? object.selectedFrequencies : [];
  const selectedFrequencies = rawFrequencies
    .map((value) => (typeof value === 'number' ? normalizeFrequency(value) : null))
    .filter((value): value is number => value !== null);

  const frequencyVolumes: Record<string, number> = {};
  const rawVolumes = asObject(object.frequencyVolumes);
  if (rawVolumes) {
    for (const [key, value] of Object.entries(rawVolumes)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        frequencyVolumes[key] = clamp(0.01, value, 1);
      }
    }
  }

  const rhythm = asObject(object.rhythm);
  const modulation = asObject(object.modulation);
  const sweep = asObject(object.sweep);
  const binaural = asObject(object.binaural);
  const innovation = asObject(object.innovation);
  const voiceBioprint = asObject(innovation?.voiceBioprint);
  const sympatheticResonance = asObject(innovation?.sympatheticResonance);
  const adaptiveBinauralJourney = asObject(innovation?.adaptiveBinauralJourney);
  const breathSync = asObject(innovation?.breathSync);
  const intentionImprint = asObject(innovation?.intentionImprint);
  const harmonicField = asObject(innovation?.harmonicField);
  const rawRecommendations = Array.isArray(voiceBioprint?.recommendations) ? voiceBioprint?.recommendations : [];
  const rawDominantFrequencies = Array.isArray(sympatheticResonance?.lastDominantFrequencies)
    ? sympatheticResonance?.lastDominantFrequencies
    : [];
  const rawJourneySteps = Array.isArray(adaptiveBinauralJourney?.steps) ? adaptiveBinauralJourney?.steps : [];
  const rawHarmonicLayers = Array.isArray(harmonicField?.lastLayerFrequencies)
    ? harmonicField?.lastLayerFrequencies
    : [];
  const rawHarmonicInterference = Array.isArray(harmonicField?.lastInterferenceFrequencies)
    ? harmonicField?.lastInterferenceFrequencies
    : [];
  const rawIntentionKeywords = Array.isArray(intentionImprint?.extractedKeywords)
    ? intentionImprint?.extractedKeywords
    : [];
  const rawIntentionFrequencies = Array.isArray(intentionImprint?.mappedFrequencies)
    ? intentionImprint?.mappedFrequencies
    : [];
  const recommendations = rawRecommendations
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const reason = typeof entry.reason === 'string' ? entry.reason : 'Personalized recommendation';
      const explicitReasonKey = typeof entry.reasonKey === 'string' ? entry.reasonKey : null;
      return {
        frequency: normalizeFrequency(asNumber(entry.frequency, 432)),
        gain: clamp(0.05, asNumber(entry.gain, 0.55), 1),
        score: clamp(0, asNumber(entry.score, 0), 1),
        reason,
        reasonKey: explicitReasonKey ?? inferVoiceBioprintReasonKey(reason) ?? undefined
      };
    })
    .slice(0, 6);
  const lastDominantFrequencies = rawDominantFrequencies
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? normalizeFrequency(entry) : null))
    .filter((value): value is number => value !== null)
    .slice(0, 8);
  const journeySteps = rawJourneySteps
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      state: asString(entry.state, ['delta', 'theta', 'alpha', 'beta', 'gamma'], 'alpha'),
      beatHz: clamp(0.5, asNumber(entry.beatHz, 8), 40),
      minutes: clamp(1, asNumber(entry.minutes, 4), 40)
    }))
    .slice(0, 8);
  const lastLayerFrequencies = rawHarmonicLayers
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? normalizeFrequency(entry) : null))
    .filter((value): value is number => value !== null)
    .slice(0, 24);
  const lastInterferenceFrequencies = rawHarmonicInterference
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? clamp(0.1, entry, 400) : null))
    .filter((value): value is number => value !== null)
    .slice(0, 24);
  const extractedKeywords = rawIntentionKeywords
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 12);
  const mappedFrequencies = rawIntentionFrequencies
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? normalizeFrequency(entry) : null))
    .filter((value): value is number => value !== null)
    .slice(0, 8);

  return {
    version: 2,
    selectedFrequencies,
    frequencyVolumes,
    rhythm: {
      enabled: asBoolean(rhythm?.enabled, config.rhythm.enabled),
      bpm: clamp(35, asNumber(rhythm?.bpm, config.rhythm.bpm), 180),
      subdivision: asString(rhythm?.subdivision, ['4n', '8n', '16n', '8t'], config.rhythm.subdivision),
      steps: normalizeRhythmSteps(rhythm?.steps)
    },
    modulation: {
      enabled: asBoolean(modulation?.enabled, config.modulation.enabled),
      rateHz: clamp(0.01, asNumber(modulation?.rateHz, config.modulation.rateHz), 24),
      depthHz: clamp(0.1, asNumber(modulation?.depthHz, config.modulation.depthHz), 220),
      waveform: asString(modulation?.waveform, ['sine', 'triangle', 'square', 'sawtooth'], config.modulation.waveform)
    },
    sweep: {
      enabled: asBoolean(sweep?.enabled, config.sweep.enabled),
      targetHz: normalizeFrequency(asNumber(sweep?.targetHz, config.sweep.targetHz)),
      durationSeconds: clamp(1, asNumber(sweep?.durationSeconds, config.sweep.durationSeconds), 180),
      curve: asString(sweep?.curve, ['linear', 'exponential', 'easeInOut'], config.sweep.curve)
    },
    binaural: {
      enabled: asBoolean(binaural?.enabled, config.binaural.enabled),
      beatHz: clamp(0.1, asNumber(binaural?.beatHz, config.binaural.beatHz), 40),
      panSpread: clamp(0.2, asNumber(binaural?.panSpread, config.binaural.panSpread), 1)
    },
    innovation: {
      voiceBioprint: {
        enabled: asBoolean(voiceBioprint?.enabled, config.innovation.voiceBioprint.enabled),
        disclaimerAccepted: asBoolean(
          voiceBioprint?.disclaimerAccepted,
          config.innovation.voiceBioprint.disclaimerAccepted
        ),
        lastCapturedAt:
          typeof voiceBioprint?.lastCapturedAt === 'string'
            ? voiceBioprint.lastCapturedAt
            : config.innovation.voiceBioprint.lastCapturedAt,
        confidence: clamp(0, asNumber(voiceBioprint?.confidence, config.innovation.voiceBioprint.confidence), 1),
        analysisDurationMs: clamp(
          0,
          asNumber(voiceBioprint?.analysisDurationMs, config.innovation.voiceBioprint.analysisDurationMs),
          60000
        ),
        profileId:
          typeof voiceBioprint?.profileId === 'string'
            ? voiceBioprint.profileId
            : config.innovation.voiceBioprint.profileId,
        recommendations
      },
      sympatheticResonance: {
        enabled: asBoolean(
          sympatheticResonance?.enabled,
          config.innovation.sympatheticResonance.enabled
        ),
        mode: asString(
          sympatheticResonance?.mode,
          ['harmonize', 'cleanse'],
          config.innovation.sympatheticResonance.mode
        ),
        scanIntervalSeconds: clamp(
          2,
          asNumber(
            sympatheticResonance?.scanIntervalSeconds,
            config.innovation.sympatheticResonance.scanIntervalSeconds
          ),
          30
        ),
        confidenceThreshold: clamp(
          0.05,
          asNumber(
            sympatheticResonance?.confidenceThreshold,
            config.innovation.sympatheticResonance.confidenceThreshold
          ),
          0.98
        ),
        calibratedNoiseFloorDb:
          typeof sympatheticResonance?.calibratedNoiseFloorDb === 'number' &&
          Number.isFinite(sympatheticResonance.calibratedNoiseFloorDb)
            ? clamp(-120, sympatheticResonance.calibratedNoiseFloorDb, 0)
            : config.innovation.sympatheticResonance.calibratedNoiseFloorDb,
        lastScanAt:
          typeof sympatheticResonance?.lastScanAt === 'string'
            ? sympatheticResonance.lastScanAt
            : config.innovation.sympatheticResonance.lastScanAt,
        lastConfidence: clamp(
          0,
          asNumber(
            sympatheticResonance?.lastConfidence,
            config.innovation.sympatheticResonance.lastConfidence
          ),
          1
        ),
        lastDominantFrequencies
      },
      adaptiveBinauralJourney: {
        enabled: asBoolean(
          adaptiveBinauralJourney?.enabled,
          config.innovation.adaptiveBinauralJourney.enabled
        ),
        intent: asString(
          adaptiveBinauralJourney?.intent,
          ['sleep', 'focus', 'meditation', 'creative'],
          config.innovation.adaptiveBinauralJourney.intent
        ),
        durationMinutes: clamp(
          8,
          asNumber(
            adaptiveBinauralJourney?.durationMinutes,
            config.innovation.adaptiveBinauralJourney.durationMinutes
          ),
          60
        ),
        micAdaptationEnabled: asBoolean(
          adaptiveBinauralJourney?.micAdaptationEnabled,
          config.innovation.adaptiveBinauralJourney.micAdaptationEnabled
        ),
        lastBreathBpm:
          typeof adaptiveBinauralJourney?.lastBreathBpm === 'number' &&
          Number.isFinite(adaptiveBinauralJourney.lastBreathBpm)
            ? clamp(2, adaptiveBinauralJourney.lastBreathBpm, 30)
            : config.innovation.adaptiveBinauralJourney.lastBreathBpm,
        lastAdaptiveOffsetHz: clamp(
          -4,
          asNumber(
            adaptiveBinauralJourney?.lastAdaptiveOffsetHz,
            config.innovation.adaptiveBinauralJourney.lastAdaptiveOffsetHz
          ),
          4
        ),
        progress: clamp(
          0,
          asNumber(adaptiveBinauralJourney?.progress, config.innovation.adaptiveBinauralJourney.progress),
          1
        ),
        currentState: asString(
          adaptiveBinauralJourney?.currentState,
          ['delta', 'theta', 'alpha', 'beta', 'gamma'],
          config.innovation.adaptiveBinauralJourney.currentState
        ),
        currentBeatHz: clamp(
          0.5,
          asNumber(adaptiveBinauralJourney?.currentBeatHz, config.innovation.adaptiveBinauralJourney.currentBeatHz),
          40
        ),
        steps:
          journeySteps.length > 0
            ? journeySteps
            : config.innovation.adaptiveBinauralJourney.steps.map((entry) => ({ ...entry }))
      },
      breathSync: {
        enabled: asBoolean(breathSync?.enabled, config.innovation.breathSync.enabled),
        mode: asString(breathSync?.mode, ['manual', 'microphone'], config.innovation.breathSync.mode),
        targetBpm: clamp(3, asNumber(breathSync?.targetBpm, config.innovation.breathSync.targetBpm), 9),
        inhaleRatio: clamp(
          0.25,
          asNumber(breathSync?.inhaleRatio, config.innovation.breathSync.inhaleRatio),
          0.75
        ),
        sensitivity: clamp(0.1, asNumber(breathSync?.sensitivity, config.innovation.breathSync.sensitivity), 1),
        calibrationNoiseFloorDb:
          typeof breathSync?.calibrationNoiseFloorDb === 'number' && Number.isFinite(breathSync.calibrationNoiseFloorDb)
            ? clamp(-120, breathSync.calibrationNoiseFloorDb, 0)
            : config.innovation.breathSync.calibrationNoiseFloorDb,
        lastBreathBpm:
          typeof breathSync?.lastBreathBpm === 'number' && Number.isFinite(breathSync.lastBreathBpm)
            ? clamp(2, breathSync.lastBreathBpm, 30)
            : config.innovation.breathSync.lastBreathBpm,
        coherenceScore: clamp(
          0,
          asNumber(breathSync?.coherenceScore, config.innovation.breathSync.coherenceScore),
          1
        ),
        phase: asString(breathSync?.phase, ['inhale', 'exhale'], config.innovation.breathSync.phase),
        phaseProgress: clamp(
          0,
          asNumber(breathSync?.phaseProgress, config.innovation.breathSync.phaseProgress),
          1
        ),
        lastSampledAt:
          typeof breathSync?.lastSampledAt === 'string'
            ? breathSync.lastSampledAt
            : config.innovation.breathSync.lastSampledAt
      },
      intentionImprint: {
        enabled: asBoolean(intentionImprint?.enabled, config.innovation.intentionImprint.enabled),
        disclaimerAccepted: asBoolean(
          intentionImprint?.disclaimerAccepted,
          config.innovation.intentionImprint.disclaimerAccepted
        ),
        intentionText:
          typeof intentionImprint?.intentionText === 'string'
            ? intentionImprint.intentionText.slice(0, 500)
            : config.innovation.intentionImprint.intentionText,
        extractedKeywords,
        mappedFrequencies,
        mappingConfidence: clamp(
          0,
          asNumber(intentionImprint?.mappingConfidence, config.innovation.intentionImprint.mappingConfidence),
          1
        ),
        modulationRateHz: clamp(
          0.05,
          asNumber(intentionImprint?.modulationRateHz, config.innovation.intentionImprint.modulationRateHz),
          8
        ),
        modulationDepthHz: clamp(
          0.5,
          asNumber(intentionImprint?.modulationDepthHz, config.innovation.intentionImprint.modulationDepthHz),
          60
        ),
        ritualIntensity: clamp(
          0.1,
          asNumber(intentionImprint?.ritualIntensity, config.innovation.intentionImprint.ritualIntensity),
          1
        ),
        certificateSeed:
          typeof intentionImprint?.certificateSeed === 'string'
            ? intentionImprint.certificateSeed
            : config.innovation.intentionImprint.certificateSeed,
        lastImprintedAt:
          typeof intentionImprint?.lastImprintedAt === 'string'
            ? intentionImprint.lastImprintedAt
            : config.innovation.intentionImprint.lastImprintedAt
      },
      harmonicField: {
        enabled: asBoolean(harmonicField?.enabled, config.innovation.harmonicField.enabled),
        presetId:
          typeof harmonicField?.presetId === 'string' && harmonicField.presetId.trim().length > 0
            ? harmonicField.presetId
            : config.innovation.harmonicField.presetId,
        intensity: clamp(0.2, asNumber(harmonicField?.intensity, config.innovation.harmonicField.intensity), 1),
        includeInterference: asBoolean(
          harmonicField?.includeInterference,
          config.innovation.harmonicField.includeInterference
        ),
        spatialMotionEnabled: asBoolean(
          harmonicField?.spatialMotionEnabled,
          config.innovation.harmonicField.spatialMotionEnabled
        ),
        motionSpeed: clamp(
          0.1,
          asNumber(harmonicField?.motionSpeed, config.innovation.harmonicField.motionSpeed),
          1
        ),
        lastFieldAt:
          typeof harmonicField?.lastFieldAt === 'string'
            ? harmonicField.lastFieldAt
            : config.innovation.harmonicField.lastFieldAt,
        lastLayerFrequencies,
        lastInterferenceFrequencies
      }
    }
  };
}
