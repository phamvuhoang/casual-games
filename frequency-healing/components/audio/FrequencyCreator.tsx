'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { track } from '@vercel/analytics';
import { usePathname, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import HelpPopover from '@/components/ui/HelpPopover';
import Modal from '@/components/ui/Modal';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import ThreeVisualizer from '@/components/audio/ThreeVisualizer';
import VoicePortraitCard from '@/components/audio/VoicePortraitCard';
import RoomFrequencyMap from '@/components/audio/RoomFrequencyMap';
import type { VisualizationSessionOverlayData } from '@/components/audio/visualizationSessionOverlay';
import { useBackgroundAudioBridge } from '@/components/background/BackgroundAudioBridge';
import { FrequencyGenerator, type FrequencyConfig } from '@/lib/audio/FrequencyGenerator';
import { MicrophoneAnalysisService } from '@/lib/audio/MicrophoneAnalysisService';
import {
  createAdaptiveJourneySteps,
  getAdaptiveJourneyTemplate,
  getAdaptiveJourneyTemplates,
  resolveJourneyRuntimePoint,
  stateVisualModifiers,
  suggestAdaptiveOffsetByBreath,
  type BrainState,
  type JourneyIntent
} from '@/lib/audio/AdaptiveBinauralJourney';
import {
  buildBreathSyncRuntimeFrame,
  createBreathSyncSamplePoint,
  summarizeBreathSyncSession,
  type BreathSyncRuntimeFrame,
  type BreathSyncSamplePoint
} from '@/lib/audio/BreathSyncEngine';
import {
  analyzeQuantumIntention,
  buildIntentionShareText,
  type IntentionLocale
} from '@/lib/audio/QuantumIntentionEngine';
import {
  analyzeRoomSpectrum,
  buildRoomResponseTones,
  createRoomResponseVoices,
  type RoomScanResult
} from '@/lib/audio/SympatheticResonanceEngine';
import {
  buildSolfeggioHarmonicField,
  getSolfeggioHarmonicPreset,
  getSolfeggioHarmonicPresets,
  type HarmonicFieldPresetId
} from '@/lib/audio/SolfeggioHarmonicFieldEngine';
import {
  analyzeVoiceBioprint,
  createFallbackVoiceBioprintProfile,
  type VoiceBioprintProfile
} from '@/lib/audio/VoiceBioprintEngine';
import {
  buildFrequencyMix,
  frequenciesForStorage,
  type MixStyle
} from '@/lib/audio/mixProfiles';
import { createDestinationAudioCapture, exportAudio } from '@/lib/audio/AudioExporter';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import {
  clamp,
  DEFAULT_SAMPLE_RATE_HZ,
  createDefaultAudioConfig,
  frequencyKey,
  MAX_CUSTOM_FREQUENCY_HZ,
  MIN_CUSTOM_FREQUENCY_HZ,
  normalizeFrequency,
  normalizeRhythmSteps,
  parseAudioConfig,
  resolveAdvancedFrequencyMaxHz,
  type AudioConfigShape,
  type AdaptiveBinauralJourneyConfig,
  type BinauralConfig,
  type BreathSyncConfig,
  type BreathSyncMode,
  type HarmonicFieldConfig,
  type IntentionImprintConfig,
  type ModulationConfig,
  type RhythmConfig,
  type SympatheticResonanceConfig,
  type SympatheticResonanceMode,
  type SweepConfig,
  type VoiceBioprintConfig
} from '@/lib/audio/audioConfig';
import {
  createDefaultVisualizationLayers,
  createLayersForType,
  createVisualizationLayer,
  normalizeVisualizationLayers,
  toVisualizationLayersPayload,
  type BaseVisualizationType,
  type LayerBlendMode,
  type VisualizationLayerConfig,
  type VisualizerType
} from '@/lib/visualization/config';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';
import type { Database, Json } from '@/lib/supabase/types';
import { Link } from '@/i18n/navigation';
import { captureVideo } from '@/lib/visualization/VideoCapture';
import { isAndroidDevice, isIOSDevice } from '@/lib/utils/platform';
import {
  AMBIENT_SOUNDS,
  AUDIO_BUCKET,
  AUDIO_FORMATS,
  DEFAULT_DURATION,
  MIX_STYLES,
  MP3_ESTIMATED_MAX_SECONDS,
  PRESET_FREQUENCIES,
  THUMBNAIL_BUCKET,
  VISUALIZATION_TYPES,
  VIDEO_BUCKET,
  WAVEFORMS
} from '@/lib/utils/constants';
import { createSlug } from '@/lib/utils/helpers';

const DEFAULT_VOLUME = 0.35;
const DRAFT_KEY = 'frequency-healing:draft';
const STUDIO_UNLOCK_KEY = 'frequency-healing:studio-unlocked';
const FIRST_VALUE_KEY = 'frequency-healing:first-value-reached';
const MAX_EXPORT_SECONDS = 300;
const SUPABASE_OBJECT_LIMIT_BYTES = 50 * 1024 * 1024;
const VIDEO_UPLOAD_TARGET_BYTES = 49 * 1024 * 1024;
const VIDEO_AUDIO_BITRATE_BPS = 96_000;
const MIN_VIDEO_BITRATE_BPS = 320_000;
const MAX_VIDEO_BITRATE_BPS = 2_200_000;
const THUMBNAIL_WIDTH = 640;
const MAX_PHASE2_FREQUENCIES = 12;

const BASE_LAYER_TYPES: BaseVisualizationType[] = [
  'waveform',
  'particles',
  'mandala',
  'spiral',
  'gradient',
  'ripple',
  'sacred_geometry'
];

const BLEND_MODES: LayerBlendMode[] = ['source-over', 'screen', 'overlay', 'lighter', 'multiply', 'soft-light'];
const JOURNEY_TEMPLATE_I18N_KEYS: Record<JourneyIntent, { title: string; description: string }> = {
  sleep: {
    title: 'journeyTemplates.sleep.title',
    description: 'journeyTemplates.sleep.description'
  },
  focus: {
    title: 'journeyTemplates.focus.title',
    description: 'journeyTemplates.focus.description'
  },
  meditation: {
    title: 'journeyTemplates.meditation.title',
    description: 'journeyTemplates.meditation.description'
  },
  creative: {
    title: 'journeyTemplates.creative.title',
    description: 'journeyTemplates.creative.description'
  }
};
const HARMONIC_PRESET_I18N_KEYS: Record<HarmonicFieldPresetId, { name: string; description: string }> = {
  chakra_ladder: {
    name: 'harmonicPresets.chakra_ladder.name',
    description: 'harmonicPresets.chakra_ladder.description'
  },
  heart_bridge: {
    name: 'harmonicPresets.heart_bridge.name',
    description: 'harmonicPresets.heart_bridge.description'
  },
  release_reset: {
    name: 'harmonicPresets.release_reset.name',
    description: 'harmonicPresets.release_reset.description'
  },
  clarity_focus: {
    name: 'harmonicPresets.clarity_focus.name',
    description: 'harmonicPresets.clarity_focus.description'
  },
  spiral_overtone: {
    name: 'harmonicPresets.spiral_overtone.name',
    description: 'harmonicPresets.spiral_overtone.description'
  },
  earth_sky: {
    name: 'harmonicPresets.earth_sky.name',
    description: 'harmonicPresets.earth_sky.description'
  }
};
type CompositionInsert = Database['public']['Tables']['compositions']['Insert'];

async function captureThumbnail(canvas: HTMLCanvasElement) {
  const sourceWidth = canvas.width || canvas.clientWidth;
  const sourceHeight = canvas.height || canvas.clientHeight;
  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const scale = THUMBNAIL_WIDTH / sourceWidth;
  const targetWidth = THUMBNAIL_WIDTH;
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const output = document.createElement('canvas');
  output.width = targetWidth;
  output.height = targetHeight;

  const ctx = output.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  return new Promise<Blob | null>((resolve) => {
    output.toBlob((blob) => resolve(blob), 'image/png');
  });
}

type DraftState = {
  selectedFrequencies: number[];
  frequencyVolumes: Record<string, number>;
  advancedFrequencyMode: boolean;
  mixStyle: MixStyle;
  waveform: (typeof WAVEFORMS)[number];
  volume: number;
  duration: number;
  visualizationType: VisualizerType;
  visualizationLayers: Json;
  ambientSound: (typeof AMBIENT_SOUNDS)[number];
  audioFormat: (typeof AUDIO_FORMATS)[number];
  includeVideo: boolean;
  showSessionInfoOverlay: boolean;
  title: string;
  description: string;
  isPublic: boolean;
  audioConfig: Json;
};

const POST_AUTH_FOCUS_VALUES = [
  'publishing',
  'frequency_stack',
  'advanced_tools',
  'voice_bioprint',
  'sympathetic_resonance',
  'adaptive_journey',
  'breath_sync',
  'intention_imprint',
  'harmonic_field'
] as const;

type PostAuthFocus = (typeof POST_AUTH_FOCUS_VALUES)[number];

function parsePostAuthFocus(value: string | null): PostAuthFocus | null {
  if (!value) {
    return null;
  }
  return (POST_AUTH_FOCUS_VALUES as readonly string[]).includes(value) ? (value as PostAuthFocus) : null;
}

function isValidFrequency(value: number, maxHz = MAX_CUSTOM_FREQUENCY_HZ) {
  return Number.isFinite(value) && value >= MIN_CUSTOM_FREQUENCY_HZ && value <= maxHz;
}

function dedupeFrequencies(values: number[], maxHz = MAX_CUSTOM_FREQUENCY_HZ) {
  const set = new Set<number>();
  const output: number[] = [];

  for (const value of values) {
    const normalized = normalizeFrequency(value, maxHz);
    if (!set.has(normalized)) {
      set.add(normalized);
      output.push(normalized);
    }
  }

  return output;
}

function randomizeSteps(length = 16) {
  const next = Array.from({ length }, () => Math.random() > 0.48);
  if (!next.some(Boolean)) {
    next[Math.floor(Math.random() * length)] = true;
  }
  return next;
}

function isBaseVisualizationType(type: VisualizerType): type is BaseVisualizationType {
  return BASE_LAYER_TYPES.includes(type as BaseVisualizationType);
}

export default function FrequencyCreator() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const intentionLocale: IntentionLocale = locale === 'ja' || locale === 'vi' ? locale : 'en';
  const tCreate = useTranslations('create');
  const tFrequencyCreator = useTranslations('create.frequencyCreator');
  const tFrequencyCreatorStatus = useTranslations('create.frequencyCreator.status');
  const localizedPresetMap = useMemo(() => {
    return tCreate.raw('presets') as Record<string, { name: string; intention: string }>;
  }, [tCreate]);
  const mixStyleLabels = useMemo<Record<MixStyle, string>>(
    () => ({
      manual: tFrequencyCreator('mixStyles.manual'),
      golden432: tFrequencyCreator('mixStyles.golden432')
    }),
    [tFrequencyCreator]
  );
  const defaultAudioConfig = useMemo(() => createDefaultAudioConfig(), []);

  const [selectedFrequencies, setSelectedFrequencies] = useState<number[]>([]);
  const [frequencyVolumes, setFrequencyVolumes] = useState<Record<string, number>>({});
  const [customFrequencyInput, setCustomFrequencyInput] = useState('');
  const [advancedFrequencyMode, setAdvancedFrequencyMode] = useState(false);
  const [audioSampleRate, setAudioSampleRate] = useState(DEFAULT_SAMPLE_RATE_HZ);
  const [mixStyle, setMixStyle] = useState<MixStyle>('golden432');
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState<(typeof WAVEFORMS)[number]>('sine');
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [rhythmConfig, setRhythmConfig] = useState<RhythmConfig>(defaultAudioConfig.rhythm);
  const [modulationConfig, setModulationConfig] = useState<ModulationConfig>(defaultAudioConfig.modulation);
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>(defaultAudioConfig.sweep);
  const [binauralConfig, setBinauralConfig] = useState<BinauralConfig>(defaultAudioConfig.binaural);
  const [visualizationType, setVisualizationType] = useState<VisualizerType>('sacred_geometry');
  const [visualizationLayers, setVisualizationLayers] = useState<VisualizationLayerConfig[]>(
    createDefaultVisualizationLayers()
  );
  const [layerToAdd, setLayerToAdd] = useState<BaseVisualizationType>('particles');
  const [ambientSound, setAmbientSound] = useState<(typeof AMBIENT_SOUNDS)[number]>('none');
  const [audioFormat, setAudioFormat] = useState<(typeof AUDIO_FORMATS)[number]>('webm');
  const [includeVideo, setIncludeVideo] = useState(false);
  const [showSessionInfoOverlay, setShowSessionInfoOverlay] = useState(false);
  const [showPublishingTools, setShowPublishingTools] = useState(false);
  const [showAdvancedSoundTools, setShowAdvancedSoundTools] = useState(false);
  const [isStudioUnlocked, setIsStudioUnlocked] = useState(false);
  const [hasReachedFirstValue, setHasReachedFirstValue] = useState(false);
  const [postAuthFocus, setPostAuthFocus] = useState<PostAuthFocus | null>(null);
  const [authModalFocus, setAuthModalFocus] = useState<PostAuthFocus>('publishing');
  const [handledPostAuthFocus, setHandledPostAuthFocus] = useState(false);
  const [liveVisualizationEnabled, setLiveVisualizationEnabled] = useState(true);
  const [showMobileLiveDock, setShowMobileLiveDock] = useState(true);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [title, setTitle] = useState(() => tFrequencyCreator('defaults.untitledSession'));
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [visualCanvas, setVisualCanvas] = useState<HTMLCanvasElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [origin, setOrigin] = useState('');
  const [savedCompositionId, setSavedCompositionId] = useState<string | null>(null);
  const [savedCompositionPublic, setSavedCompositionPublic] = useState<boolean | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [voiceBioprintConfig, setVoiceBioprintConfig] = useState<VoiceBioprintConfig>(
    defaultAudioConfig.innovation.voiceBioprint
  );
  const [sympatheticConfig, setSympatheticConfig] = useState<SympatheticResonanceConfig>(
    defaultAudioConfig.innovation.sympatheticResonance
  );
  const [adaptiveJourneyConfig, setAdaptiveJourneyConfig] = useState<AdaptiveBinauralJourneyConfig>(
    defaultAudioConfig.innovation.adaptiveBinauralJourney
  );
  const [breathSyncConfig, setBreathSyncConfig] = useState<BreathSyncConfig>(
    defaultAudioConfig.innovation.breathSync
  );
  const [intentionConfig, setIntentionConfig] = useState<IntentionImprintConfig>(
    defaultAudioConfig.innovation.intentionImprint
  );
  const [harmonicFieldConfig, setHarmonicFieldConfig] = useState<HarmonicFieldConfig>(
    defaultAudioConfig.innovation.harmonicField
  );
  const [voiceProfile, setVoiceProfile] = useState<VoiceBioprintProfile | null>(null);
  const [voiceProfileId, setVoiceProfileId] = useState<string | null>(null);
  const [isCapturingVoice, setIsCapturingVoice] = useState(false);
  const [voiceCaptureError, setVoiceCaptureError] = useState<string | null>(null);
  const [voiceTelemetry, setVoiceTelemetry] = useState<{
    captureMs: number;
    analysisMs: number;
    frameCount: number;
  } | null>(null);
  const [roomScanResult, setRoomScanResult] = useState<RoomScanResult | null>(null);
  const [roomResponseFrequencies, setRoomResponseFrequencies] = useState<number[]>([]);
  const [roomScanStatus, setRoomScanStatus] = useState<string | null>(null);
  const [isCalibratingRoom, setIsCalibratingRoom] = useState(false);
  const [isRoomMonitoring, setIsRoomMonitoring] = useState(false);
  const [journeyStatus, setJourneyStatus] = useState<string | null>(null);
  const [journeyHeadphonesConfirmed, setJourneyHeadphonesConfirmed] = useState(false);
  const [journeyRuntime, setJourneyRuntime] = useState<{
    state: BrainState;
    beatHz: number;
    progress: number;
    elapsedSeconds: number;
    durationSeconds: number;
    breathBpm: number | null;
    adaptiveOffsetHz: number;
  } | null>(null);
  const [isJourneyMicSampling, setIsJourneyMicSampling] = useState(false);
  const [breathSyncStatus, setBreathSyncStatus] = useState<string | null>(null);
  const [isBreathMonitoring, setIsBreathMonitoring] = useState(false);
  const [isBreathCalibrating, setIsBreathCalibrating] = useState(false);
  const [breathRuntime, setBreathRuntime] = useState<BreathSyncRuntimeFrame | null>(null);
  const [breathSamples, setBreathSamples] = useState<BreathSyncSamplePoint[]>([]);
  const [intentionStatus, setIntentionStatus] = useState<string | null>(null);
  const [intentionShareText, setIntentionShareText] = useState('');
  const [intentionDisclaimerModalOpen, setIntentionDisclaimerModalOpen] = useState(false);
  const [intentionEnableOnAcknowledge, setIntentionEnableOnAcknowledge] = useState(false);
  const frequencyStackRef = useRef<HTMLDivElement | null>(null);
  const advancedSoundRef = useRef<HTMLDivElement | null>(null);
  const liveSectionRef = useRef<HTMLDivElement | null>(null);
  const mobileLiveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roomScanLockRef = useRef(false);
  const journeyStartAtRef = useRef<number | null>(null);
  const journeyAdaptiveOffsetRef = useRef(0);
  const journeyLastBreathRef = useRef<number | null>(null);
  const breathSyncStartAtRef = useRef<number | null>(null);
  const breathLastBpmRef = useRef<number | null>(null);
  const breathLastConfidenceRef = useRef(0);
  const breathSampleGateRef = useRef<number>(0);
  const publishingToolsRef = useRef<HTMLDivElement | null>(null);
  const voiceBioprintRef = useRef<HTMLDivElement | null>(null);
  const sympatheticResonanceRef = useRef<HTMLDivElement | null>(null);
  const adaptiveJourneyRef = useRef<HTMLDivElement | null>(null);
  const breathSyncRef = useRef<HTMLDivElement | null>(null);
  const intentionImprintRef = useRef<HTMLDivElement | null>(null);
  const harmonicFieldRef = useRef<HTMLDivElement | null>(null);
  const mp3LimitSeconds = MP3_ESTIMATED_MAX_SECONDS;
  const showMp3Warning = audioFormat === 'mp3' && duration > mp3LimitSeconds;
  const maxSelectableFrequencies = mixStyle === 'golden432' ? MAX_PHASE2_FREQUENCIES : MAX_PHASE2_FREQUENCIES;
  const isGuest = !userId;
  const canAccessStudioControls = Boolean(userId) || isStudioUnlocked;
  const canUseAdvancedModules = Boolean(userId);
  const shouldShowAdvancedPreviews = isGuest && hasReachedFirstValue;

  const generator = useMemo(() => new FrequencyGenerator(), []);
  const micService = useMemo(() => new MicrophoneAnalysisService(), []);
  const roomMicService = useMemo(() => new MicrophoneAnalysisService(), []);
  const journeyMicService = useMemo(() => new MicrophoneAnalysisService(), []);
  const breathMicService = useMemo(() => new MicrophoneAnalysisService(), []);
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { setAnalyser: setBackgroundAnalyser } = useBackgroundAudioBridge();
  const harmonicPresets = useMemo(() => getSolfeggioHarmonicPresets(), []);
  const activeHarmonicPreset = useMemo(
    () => getSolfeggioHarmonicPreset(harmonicFieldConfig.presetId),
    [harmonicFieldConfig.presetId]
  );
  const harmonicFieldBundle = useMemo(
    () =>
      buildSolfeggioHarmonicField({
        presetId: harmonicFieldConfig.presetId,
        intensity: harmonicFieldConfig.intensity,
        includeInterference: harmonicFieldConfig.includeInterference,
        spatialMotionEnabled: harmonicFieldConfig.spatialMotionEnabled,
        motionSpeed: harmonicFieldConfig.motionSpeed,
        waveform,
        masterVolume: volume
      }),
    [
      harmonicFieldConfig.includeInterference,
      harmonicFieldConfig.intensity,
      harmonicFieldConfig.motionSpeed,
      harmonicFieldConfig.presetId,
      harmonicFieldConfig.spatialMotionEnabled,
      volume,
      waveform
    ]
  );
  const advancedFrequencyMaxHz = useMemo(
    () => resolveAdvancedFrequencyMaxHz(audioSampleRate),
    [audioSampleRate]
  );
  const activeFrequencyMaxHz = advancedFrequencyMode ? advancedFrequencyMaxHz : MAX_CUSTOM_FREQUENCY_HZ;
  const roundedActiveFrequencyMaxHz = Math.round(activeFrequencyMaxHz);
  const normalizeUserFrequency = useCallback(
    (value: number) => normalizeFrequency(value, activeFrequencyMaxHz),
    [activeFrequencyMaxHz]
  );
  const frequencyKeyForCurrentRange = useCallback(
    (value: number) => frequencyKey(value, activeFrequencyMaxHz),
    [activeFrequencyMaxHz]
  );

  const audioConfig = useMemo<AudioConfigShape>(
    () => ({
      version: 2,
      selectedFrequencies,
      frequencyVolumes,
      rhythm: rhythmConfig,
      modulation: modulationConfig,
      sweep: sweepConfig,
      binaural: binauralConfig,
      innovation: {
        voiceBioprint: {
          ...voiceBioprintConfig,
          profileId: voiceProfileId ?? voiceBioprintConfig.profileId
        },
        sympatheticResonance: {
          ...sympatheticConfig,
          lastDominantFrequencies: roomScanResult?.dominantFrequencies ?? sympatheticConfig.lastDominantFrequencies,
          lastConfidence: roomScanResult?.confidence ?? sympatheticConfig.lastConfidence,
          lastScanAt: roomScanResult?.capturedAt ?? sympatheticConfig.lastScanAt
        },
        adaptiveBinauralJourney: {
          ...adaptiveJourneyConfig,
          lastBreathBpm: journeyLastBreathRef.current ?? adaptiveJourneyConfig.lastBreathBpm,
          lastAdaptiveOffsetHz: journeyAdaptiveOffsetRef.current,
          progress: journeyRuntime?.progress ?? adaptiveJourneyConfig.progress,
          currentState: journeyRuntime?.state ?? adaptiveJourneyConfig.currentState,
          currentBeatHz: journeyRuntime?.beatHz ?? adaptiveJourneyConfig.currentBeatHz
        },
        breathSync: {
          ...breathSyncConfig,
          lastBreathBpm: breathRuntime?.breathBpm ?? breathLastBpmRef.current ?? breathSyncConfig.lastBreathBpm,
          coherenceScore: breathRuntime?.coherenceScore ?? breathSyncConfig.coherenceScore,
          phase: breathRuntime?.phase ?? breathSyncConfig.phase,
          phaseProgress: breathRuntime?.phaseProgress ?? breathSyncConfig.phaseProgress,
          lastSampledAt: breathSamples[0]?.capturedAt ?? breathSyncConfig.lastSampledAt
        },
        intentionImprint: {
          ...intentionConfig
        },
        harmonicField: {
          ...harmonicFieldConfig,
          lastLayerFrequencies: harmonicFieldConfig.enabled
            ? harmonicFieldBundle.layerFrequencies
            : harmonicFieldConfig.lastLayerFrequencies,
          lastInterferenceFrequencies: harmonicFieldConfig.enabled
            ? harmonicFieldBundle.interferenceFrequencies
            : harmonicFieldConfig.lastInterferenceFrequencies
        }
      }
    }),
    [
      binauralConfig,
      frequencyVolumes,
      modulationConfig,
      rhythmConfig,
      selectedFrequencies,
      sweepConfig,
      sympatheticConfig,
      roomScanResult,
      adaptiveJourneyConfig,
      breathSyncConfig,
      breathRuntime,
      breathSamples,
      intentionConfig,
      harmonicFieldConfig,
      harmonicFieldBundle,
      journeyRuntime,
      voiceBioprintConfig,
      voiceProfileId
    ]
  );

  const audioConfigJson = useMemo<Json>(
    () => ({
      version: audioConfig.version,
      selectedFrequencies: [...audioConfig.selectedFrequencies],
      frequencyVolumes: { ...audioConfig.frequencyVolumes },
      rhythm: { ...audioConfig.rhythm, steps: [...audioConfig.rhythm.steps] },
      modulation: { ...audioConfig.modulation },
      sweep: { ...audioConfig.sweep },
      binaural: { ...audioConfig.binaural },
      innovation: {
        voiceBioprint: {
          ...audioConfig.innovation.voiceBioprint,
          recommendations: audioConfig.innovation.voiceBioprint.recommendations.map((item) => ({ ...item }))
        },
        sympatheticResonance: {
          ...audioConfig.innovation.sympatheticResonance,
          lastDominantFrequencies: [...audioConfig.innovation.sympatheticResonance.lastDominantFrequencies]
        },
        adaptiveBinauralJourney: {
          ...audioConfig.innovation.adaptiveBinauralJourney,
          steps: audioConfig.innovation.adaptiveBinauralJourney.steps.map((entry) => ({ ...entry }))
        },
        breathSync: {
          ...audioConfig.innovation.breathSync
        },
        intentionImprint: {
          ...audioConfig.innovation.intentionImprint,
          extractedKeywords: [...audioConfig.innovation.intentionImprint.extractedKeywords],
          mappedFrequencies: [...audioConfig.innovation.intentionImprint.mappedFrequencies]
        },
        harmonicField: {
          ...audioConfig.innovation.harmonicField,
          lastLayerFrequencies: [...audioConfig.innovation.harmonicField.lastLayerFrequencies],
          lastInterferenceFrequencies: [...audioConfig.innovation.harmonicField.lastInterferenceFrequencies]
        }
      }
    }),
    [audioConfig]
  );

  const customFrequencyValue = Number(customFrequencyInput);
  const customFrequencyValid =
    customFrequencyInput.trim().length > 0 &&
    Number.isFinite(customFrequencyValue) &&
    isValidFrequency(customFrequencyValue, activeFrequencyMaxHz);

  const effectiveVisualizationLayers = useMemo(() => {
    let baseLayers: VisualizationLayerConfig[] = [];
    if (visualizationType === 'multi-layer') {
      baseLayers = visualizationLayers.length > 0 ? visualizationLayers : createDefaultVisualizationLayers();
    } else if (visualizationType === 'orbital') {
      baseLayers = [];
    } else {
      const layer = visualizationLayers.find((entry) => entry.type === visualizationType);
      baseLayers = layer ? [layer] : createLayersForType(visualizationType);
    }

    if (!adaptiveJourneyConfig.enabled || !isPlaying || !journeyRuntime || baseLayers.length === 0) {
      return baseLayers;
    }

    const modifier = stateVisualModifiers(journeyRuntime.state);
    return baseLayers.map((layer) => ({
      ...layer,
      intensity: clamp(0.1, layer.intensity * modifier.intensity, 1.5),
      speed: clamp(0.1, layer.speed * modifier.speed, 2.5)
    }));
  }, [adaptiveJourneyConfig.enabled, isPlaying, journeyRuntime, visualizationLayers, visualizationType]);

  const selectedFrequencySummary = useMemo(() => {
    if (selectedFrequencies.length === 0) {
      return tFrequencyCreator('summary.noTonesSelected');
    }

    const first = selectedFrequencies.slice(0, 3).map((value) => `${Math.round(value)}Hz`);
    const extra = selectedFrequencies.length - first.length;
    return `${first.join(' • ')}${extra > 0 ? ` +${extra}` : ''}`;
  }, [selectedFrequencies, tFrequencyCreator]);
  const savedCompositionPath = savedCompositionId ? `/composition/${savedCompositionId}` : null;
  const savedCompositionUrl = savedCompositionPath ? `${origin}${savedCompositionPath}` : null;
  const savedEmbedCode = useMemo(() => {
    if (!savedCompositionUrl) {
      return null;
    }
    return `<iframe src="${savedCompositionUrl}?embed=1" width="640" height="360" allow="autoplay" loading="lazy"></iframe>`;
  }, [savedCompositionUrl]);
  const journeyTemplates = useMemo(() => getAdaptiveJourneyTemplates(), []);
  const activeJourneyTemplate = useMemo(
    () => getAdaptiveJourneyTemplate(adaptiveJourneyConfig.intent),
    [adaptiveJourneyConfig.intent]
  );
  const journeyTemplateLabels = useMemo(
    () => ({
      sleep: {
        title: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.sleep.title),
        description: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.sleep.description)
      },
      focus: {
        title: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.focus.title),
        description: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.focus.description)
      },
      meditation: {
        title: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.meditation.title),
        description: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.meditation.description)
      },
      creative: {
        title: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.creative.title),
        description: tFrequencyCreator(JOURNEY_TEMPLATE_I18N_KEYS.creative.description)
      }
    }),
    [tFrequencyCreator]
  );
  const harmonicPresetLabels = useMemo(
    () => ({
      chakra_ladder: {
        name: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.chakra_ladder.name),
        description: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.chakra_ladder.description)
      },
      heart_bridge: {
        name: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.heart_bridge.name),
        description: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.heart_bridge.description)
      },
      release_reset: {
        name: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.release_reset.name),
        description: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.release_reset.description)
      },
      clarity_focus: {
        name: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.clarity_focus.name),
        description: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.clarity_focus.description)
      },
      spiral_overtone: {
        name: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.spiral_overtone.name),
        description: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.spiral_overtone.description)
      },
      earth_sky: {
        name: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.earth_sky.name),
        description: tFrequencyCreator(HARMONIC_PRESET_I18N_KEYS.earth_sky.description)
      }
    }),
    [tFrequencyCreator]
  );
  const advancedFeaturePreviews = useMemo(
    () => [
      {
        key: 'voice_bioprint' as const,
        title: tFrequencyCreator('ui.voiceBioprintBeta'),
        description: tFrequencyCreator('ui.voiceBioprintDescription')
      },
      {
        key: 'sympathetic_resonance' as const,
        title: tFrequencyCreator('ui.sympatheticResonanceTitle'),
        description: tFrequencyCreator('ui.sympatheticResonanceDescription')
      },
      {
        key: 'adaptive_journey' as const,
        title: tFrequencyCreator('ui.adaptiveBinauralJourney'),
        description: tFrequencyCreator('help.adaptiveJourneyText')
      },
      {
        key: 'breath_sync' as const,
        title: tFrequencyCreator('ui.breathSyncProtocol'),
        description: tFrequencyCreator('help.breathSyncText')
      },
      {
        key: 'intention_imprint' as const,
        title: tFrequencyCreator('ui.quantumIntentionImprintExperimental'),
        description: tFrequencyCreator('help.intentionImprintText')
      },
      {
        key: 'harmonic_field' as const,
        title: tFrequencyCreator('ui.solfeggioHarmonicField'),
        description: tFrequencyCreator('help.harmonicFieldText')
      }
    ],
    [tFrequencyCreator]
  );

  const advancedSoundSummary = useMemo(() => {
    const activeModules: string[] = [];
    if (rhythmConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.rhythm'));
    }
    if (modulationConfig.enabled || sweepConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.modSweep'));
    }
    if (binauralConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.binaural'));
    }
    if (sympatheticConfig.enabled) {
      activeModules.push(
        tFrequencyCreator('summaryModules.roomMode', {
          mode:
            sympatheticConfig.mode === 'cleanse'
              ? tFrequencyCreator('summaryModules.cleanse')
              : tFrequencyCreator('summaryModules.harmonize')
        })
      );
    }
    if (adaptiveJourneyConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.adaptiveJourney'));
    }
    if (breathSyncConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.breathSync'));
    }
    if (intentionConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.intentionImprint'));
    }
    if (harmonicFieldConfig.enabled) {
      activeModules.push(tFrequencyCreator('summaryModules.harmonicField'));
    }

    if (activeModules.length === 0) {
      return tFrequencyCreator('summary.allAdvancedModulesOff');
    }

    return tFrequencyCreator('summary.activeModules', {
      modules: activeModules.join(' • ')
    });
  }, [
    adaptiveJourneyConfig.enabled,
    binauralConfig.enabled,
    breathSyncConfig.enabled,
    harmonicFieldConfig.enabled,
    intentionConfig.enabled,
    modulationConfig.enabled,
    rhythmConfig.enabled,
    sweepConfig.enabled,
    sympatheticConfig.enabled,
    sympatheticConfig.mode,
    tFrequencyCreator
  ]);

  useEffect(() => {
    const sampleRate = generator.getSampleRate();
    if (typeof sampleRate === 'number' && Number.isFinite(sampleRate) && sampleRate > 0) {
      setAudioSampleRate(sampleRate);
    }
  }, [generator]);

  useEffect(() => {
    if (!advancedFrequencyMode) {
      return;
    }

    setSelectedFrequencies((prev) => dedupeFrequencies(prev, advancedFrequencyMaxHz));
    setSweepConfig((prev) => ({
      ...prev,
      targetHz: normalizeFrequency(prev.targetHz, advancedFrequencyMaxHz)
    }));
    setCustomFrequencyInput((prev) => {
      if (prev.trim().length === 0) {
        return prev;
      }

      const parsed = Number(prev);
      if (!Number.isFinite(parsed)) {
        return prev;
      }

      return String(normalizeFrequency(parsed, advancedFrequencyMaxHz));
    });
  }, [advancedFrequencyMaxHz, advancedFrequencyMode]);

  const sessionOverlayInfo = useMemo<VisualizationSessionOverlayData>(
    () => ({
      title,
      frequencies: selectedFrequencies.map((frequency) => ({
        frequency,
        gain: frequencyVolumes[frequencyKeyForCurrentRange(frequency)] ?? 1
      })),
      mixStyle,
      waveform,
      rhythm: rhythmConfig,
      modulation: modulationConfig,
      sweep: sweepConfig,
      binaural: binauralConfig
    }),
    [
      binauralConfig,
      activeFrequencyMaxHz,
      frequencyVolumes,
      frequencyKeyForCurrentRange,
      mixStyle,
      modulationConfig,
      rhythmConfig,
      selectedFrequencies,
      sweepConfig,
      title,
      waveform
    ]
  );

  const baseMixedVoices = useMemo(
    () =>
      buildFrequencyMix({
        mixStyle,
        selectedFrequencies,
        waveform,
        volume,
        frequencyVolumes,
        binaural: binauralConfig,
        maxFrequencyHz: activeFrequencyMaxHz
      }),
    [mixStyle, selectedFrequencies, waveform, volume, frequencyVolumes, binauralConfig, activeFrequencyMaxHz]
  );

  const roomResponseVoices = useMemo(
    () =>
      createRoomResponseVoices({
        tones: buildRoomResponseTones(
          roomScanResult ?? {
            capturedAt: new Date().toISOString(),
            dominantFrequencies: sympatheticConfig.lastDominantFrequencies,
            spectrumMap: [],
            confidence: sympatheticConfig.lastConfidence,
            noiseFloorDb: sympatheticConfig.calibratedNoiseFloorDb ?? -90,
            peakDb: -25,
            dynamicRangeDb: 0
          },
          sympatheticConfig.mode
        ),
        mode: sympatheticConfig.mode,
        waveform,
        masterVolume: volume,
        confidence: roomScanResult?.confidence ?? sympatheticConfig.lastConfidence,
        confidenceThreshold: sympatheticConfig.confidenceThreshold
      }),
    [
      roomScanResult,
      sympatheticConfig.lastDominantFrequencies,
      sympatheticConfig.lastConfidence,
      sympatheticConfig.calibratedNoiseFloorDb,
      sympatheticConfig.mode,
      sympatheticConfig.confidenceThreshold,
      waveform,
      volume
    ]
  );

  const harmonicFieldVoices = useMemo(() => harmonicFieldBundle.voices, [harmonicFieldBundle]);

  const intentionSupportVoices = useMemo<FrequencyConfig[]>(() => {
    if (!intentionConfig.enabled || intentionConfig.mappedFrequencies.length === 0) {
      return [];
    }

    const selectedSet = new Set(selectedFrequencies.map((frequency) => normalizeUserFrequency(frequency)));
    return intentionConfig.mappedFrequencies
      .map((frequency) => normalizeUserFrequency(frequency))
      .filter((frequency) => !selectedSet.has(frequency))
      .slice(0, 4)
      .map((frequency, index) => ({
        frequency,
        volume: clamp(0.01, volume * 0.16 * (1 + intentionConfig.mappingConfidence * 0.35), 0.16),
        waveform: 'sine' as const,
        pan: index % 2 === 0 ? -0.18 : 0.18,
        attackSeconds: 1.2,
        releaseSeconds: 2.2,
        modulationRateHz: clamp(0.05, intentionConfig.modulationRateHz + index * 0.03, 6),
        modulationDepth: clamp(0.05, intentionConfig.ritualIntensity * 0.25, 0.55)
      }));
  }, [
    intentionConfig.enabled,
    intentionConfig.mappedFrequencies,
    intentionConfig.mappingConfidence,
    intentionConfig.modulationRateHz,
    intentionConfig.ritualIntensity,
    normalizeUserFrequency,
    selectedFrequencies,
    volume
  ]);

  const preIntentionVoices = useMemo<FrequencyConfig[]>(
    () => [
      ...baseMixedVoices,
      ...(sympatheticConfig.enabled ? roomResponseVoices : []),
      ...(harmonicFieldConfig.enabled ? harmonicFieldVoices : []),
      ...(intentionConfig.enabled ? intentionSupportVoices : [])
    ],
    [
      baseMixedVoices,
      roomResponseVoices,
      sympatheticConfig.enabled,
      harmonicFieldConfig.enabled,
      harmonicFieldVoices,
      intentionConfig.enabled,
      intentionSupportVoices
    ]
  );

  const mixedVoices = useMemo<FrequencyConfig[]>(() => {
    if (!intentionConfig.enabled) {
      return preIntentionVoices;
    }

    const imprintRateHz = clamp(0.05, intentionConfig.modulationRateHz, 8);
    const imprintDepthScale = clamp(0.02, intentionConfig.modulationDepthHz / 36, 1.8);
    const imprintIntensity = clamp(0.1, intentionConfig.ritualIntensity, 1);

    return preIntentionVoices.map((voice, index) => {
      const baseRate = voice.modulationRateHz ?? 0;
      const nextRate = baseRate > 0 ? baseRate * 0.68 + imprintRateHz * 0.32 : imprintRateHz + index * 0.02;
      const baseDepth = voice.modulationDepth ?? 0.08;
      const nextDepth = clamp(0.02, baseDepth + imprintDepthScale * 0.09 * imprintIntensity, 0.65);
      const seed = intentionConfig.certificateSeed && intentionConfig.certificateSeed.length > 0
        ? intentionConfig.certificateSeed
        : 'INT-SEED';
      const detuneOffset = seed.charCodeAt(index % seed.length) % 3;

      return {
        ...voice,
        modulationRateHz: Number(clamp(0.05, nextRate, 8).toFixed(3)),
        modulationDepth: Number(nextDepth.toFixed(3)),
        detuneCents: Number(((voice.detuneCents ?? 0) + (index % 2 === 0 ? detuneOffset : -detuneOffset)).toFixed(2))
      };
    });
  }, [
    intentionConfig.certificateSeed,
    intentionConfig.enabled,
    intentionConfig.modulationDepthHz,
    intentionConfig.modulationRateHz,
    intentionConfig.ritualIntensity,
    preIntentionVoices
  ]);

  useEffect(() => {
    return () => {
      generator.dispose();
      void micService.stop();
      void roomMicService.stop();
      void journeyMicService.stop();
      void breathMicService.stop();
    };
  }, [breathMicService, generator, micService, roomMicService, journeyMicService]);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

  useEffect(() => {
    const trimmed = intentionConfig.intentionText.trim();
    if (trimmed.length === 0) {
      setIntentionShareText('');
      return;
    }

    setIntentionShareText(
      buildIntentionShareText({
        intentionText: trimmed,
        keywords: intentionConfig.extractedKeywords,
        mappedFrequencies: intentionConfig.mappedFrequencies,
        certificateSeed: intentionConfig.certificateSeed ?? 'INT-UNKNOWN',
        locale: intentionLocale
      })
    );
  }, [
    intentionConfig.certificateSeed,
    intentionConfig.extractedKeywords,
    intentionConfig.intentionText,
    intentionConfig.mappedFrequencies,
    intentionLocale
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setOrigin(window.location.origin);
    setPostAuthFocus(parsePostAuthFocus(new URLSearchParams(window.location.search).get('postAuthFocus')));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsStudioUnlocked(window.localStorage.getItem(STUDIO_UNLOCK_KEY) === '1');
    setHasReachedFirstValue(window.localStorage.getItem(FIRST_VALUE_KEY) === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 820px)');
    const update = () => setIsCompactViewport(media.matches);
    update();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (!isCompactViewport && userId) {
      setShowAdvancedSoundTools(true);
    }
  }, [isCompactViewport, userId]);

  useEffect(() => {
    if (isIOS && includeVideo) {
      setIncludeVideo(false);
    }
  }, [includeVideo, isIOS]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setUserId(data.user?.id ?? null);
      }
    };

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUserId(session?.user?.id ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') {
      return;
    }

    setIsStudioUnlocked(true);
    window.localStorage.setItem(STUDIO_UNLOCK_KEY, '1');
  }, [userId]);

  useEffect(() => {
    setHandledPostAuthFocus(false);
  }, [postAuthFocus]);

  useEffect(() => {
    if (!userId || !postAuthFocus || handledPostAuthFocus) {
      return;
    }

    setHandledPostAuthFocus(true);
    setAuthModalFocus(postAuthFocus);

    if (postAuthFocus === 'publishing') {
      setShowPublishingTools(true);
    }
    if (postAuthFocus === 'frequency_stack') {
      setIsStudioUnlocked(true);
    }
    if (
      postAuthFocus === 'advanced_tools' ||
      postAuthFocus === 'adaptive_journey' ||
      postAuthFocus === 'breath_sync' ||
      postAuthFocus === 'intention_imprint' ||
      postAuthFocus === 'harmonic_field'
    ) {
      setShowAdvancedSoundTools(true);
    }

    try {
      track('post_auth_focus_returned', { focus: postAuthFocus });
    } catch (error) {
      console.warn('Analytics track failed.', error);
    }

    const focusTimer = window.setTimeout(() => {
      const targetMap: Record<PostAuthFocus, HTMLElement | null> = {
        publishing: publishingToolsRef.current,
        frequency_stack: frequencyStackRef.current,
        advanced_tools: advancedSoundRef.current,
        voice_bioprint: voiceBioprintRef.current,
        sympathetic_resonance: sympatheticResonanceRef.current,
        adaptive_journey: adaptiveJourneyRef.current,
        breath_sync: breathSyncRef.current,
        intention_imprint: intentionImprintRef.current,
        harmonic_field: harmonicFieldRef.current
      };
      targetMap[postAuthFocus]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 260);

    const nextParams = new URLSearchParams(window.location.search);
    nextParams.delete('postAuthFocus');
    const nextHref = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
    setPostAuthFocus(null);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [handledPostAuthFocus, pathname, postAuthFocus, router, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return;
    }

    setIsStudioUnlocked(true);
    setHasReachedFirstValue(true);
    window.localStorage.setItem(STUDIO_UNLOCK_KEY, '1');
    window.localStorage.setItem(FIRST_VALUE_KEY, '1');

    try {
      const draft = JSON.parse(raw) as Partial<DraftState>;
      const draftAdvancedFrequencyMode = typeof draft.advancedFrequencyMode === 'boolean'
        ? draft.advancedFrequencyMode
        : false;
      const draftSampleRate = generator.getSampleRate();
      if (typeof draftSampleRate === 'number' && Number.isFinite(draftSampleRate) && draftSampleRate > 0) {
        setAudioSampleRate(draftSampleRate);
      }
      const draftFrequencyMaxHz = draftAdvancedFrequencyMode
        ? resolveAdvancedFrequencyMaxHz(draftSampleRate ?? audioSampleRate)
        : MAX_CUSTOM_FREQUENCY_HZ;
      setAdvancedFrequencyMode(draftAdvancedFrequencyMode);

      if (draft.audioConfig) {
        const parsed = parseAudioConfig(draft.audioConfig, {
          maxFrequencyHz: draftFrequencyMaxHz
        });
        setSelectedFrequencies(dedupeFrequencies(parsed.selectedFrequencies, draftFrequencyMaxHz));
        setFrequencyVolumes(parsed.frequencyVolumes);
        setRhythmConfig(parsed.rhythm);
        setModulationConfig(parsed.modulation);
        setSweepConfig(parsed.sweep);
        setBinauralConfig(parsed.binaural);
        setVoiceBioprintConfig(parsed.innovation.voiceBioprint);
        setSympatheticConfig(parsed.innovation.sympatheticResonance);
        setAdaptiveJourneyConfig(parsed.innovation.adaptiveBinauralJourney);
        setBreathSyncConfig(parsed.innovation.breathSync);
        setIntentionConfig(parsed.innovation.intentionImprint);
        setHarmonicFieldConfig(parsed.innovation.harmonicField);
        if (parsed.innovation.intentionImprint.intentionText.trim().length > 0) {
          setIntentionShareText(
            buildIntentionShareText({
              intentionText: parsed.innovation.intentionImprint.intentionText,
              keywords: parsed.innovation.intentionImprint.extractedKeywords,
              mappedFrequencies: parsed.innovation.intentionImprint.mappedFrequencies,
              certificateSeed: parsed.innovation.intentionImprint.certificateSeed ?? 'INT-UNKNOWN',
              locale: intentionLocale
            })
          );
        }
        if (parsed.innovation.sympatheticResonance.lastDominantFrequencies.length > 0) {
          setRoomResponseFrequencies(parsed.innovation.sympatheticResonance.lastDominantFrequencies);
        }
        setVoiceProfileId(parsed.innovation.voiceBioprint.profileId);
      } else {
        if (draft.selectedFrequencies) {
          setSelectedFrequencies(dedupeFrequencies(draft.selectedFrequencies, draftFrequencyMaxHz));
        }
        if (draft.frequencyVolumes) {
          setFrequencyVolumes(draft.frequencyVolumes);
        }
      }

      if (draft.mixStyle) {
        setMixStyle(draft.mixStyle);
      }
      if (draft.waveform) {
        setWaveform(draft.waveform);
      }
      if (typeof draft.volume === 'number') {
        setVolume(draft.volume);
      }
      if (typeof draft.duration === 'number') {
        setDuration(clamp(60, draft.duration, MAX_EXPORT_SECONDS));
      }
      if (draft.visualizationType) {
        setVisualizationType(draft.visualizationType);
      }
      if (draft.visualizationLayers) {
        setVisualizationLayers(normalizeVisualizationLayers(draft.visualizationLayers, draft.visualizationType));
      }
      if (draft.ambientSound) {
        setAmbientSound(draft.ambientSound);
      }
      if (draft.audioFormat) {
        setAudioFormat(draft.audioFormat);
      }
      if (typeof draft.includeVideo === 'boolean') {
        setIncludeVideo(draft.includeVideo);
      }
      if (typeof draft.showSessionInfoOverlay === 'boolean') {
        setShowSessionInfoOverlay(draft.showSessionInfoOverlay);
      }
      if (draft.title) {
        setTitle(draft.title);
      }
      if (typeof draft.description === 'string') {
        setDescription(draft.description);
      }
      if (typeof draft.isPublic === 'boolean') {
        setIsPublic(draft.isPublic);
      }
    } catch (error) {
      console.warn('Failed to restore draft composition.', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const draft: DraftState = {
      selectedFrequencies,
      frequencyVolumes,
      advancedFrequencyMode,
      mixStyle,
      waveform,
      volume,
      duration,
      visualizationType,
      visualizationLayers: toVisualizationLayersPayload(visualizationLayers),
      ambientSound,
      audioFormat,
      includeVideo,
      showSessionInfoOverlay,
      title,
      description,
      isPublic,
      audioConfig: audioConfigJson
    };

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    ambientSound,
    advancedFrequencyMode,
    audioConfigJson,
    audioFormat,
    description,
    duration,
    frequencyVolumes,
    includeVideo,
    showSessionInfoOverlay,
    isPublic,
    mixStyle,
    selectedFrequencies,
    title,
    visualizationLayers,
    visualizationType,
    volume,
    waveform
  ]);

  useEffect(() => {
    setFrequencyVolumes((prev) => {
      const next = { ...prev };
      let changed = false;
      const selectedKeys = new Set(selectedFrequencies.map((frequency) => frequencyKeyForCurrentRange(frequency)));

      selectedFrequencies.forEach((frequency) => {
        const key = frequencyKeyForCurrentRange(frequency);
        if (typeof next[key] !== 'number') {
          next[key] = 1;
          changed = true;
        }
      });

      for (const key of Object.keys(next)) {
        const numeric = Number(key);
        if (!Number.isFinite(numeric)) {
          delete next[key];
          changed = true;
          continue;
        }

        const normalizedKey = frequencyKeyForCurrentRange(numeric);
        if (!selectedKeys.has(normalizedKey)) {
          delete next[key];
          changed = true;
          continue;
        }

        if (key !== normalizedKey) {
          if (typeof next[normalizedKey] !== 'number') {
            next[normalizedKey] = next[key];
          }
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [frequencyKeyForCurrentRange, selectedFrequencies]);

  useEffect(() => {
    if (isPlaying) {
      generator.setMasterVolume(volume);
    }
  }, [generator, isPlaying, volume]);

  useEffect(() => {
    setBackgroundAnalyser(isPlaying ? analyser : null);
  }, [analyser, isPlaying, setBackgroundAnalyser]);

  useEffect(() => {
    return () => {
      setBackgroundAnalyser(null);
    };
  }, [setBackgroundAnalyser]);

  useEffect(() => {
    if (isPlaying && mixedVoices.length > 0) {
      generator.play(mixedVoices);
    }
  }, [generator, isPlaying, mixedVoices]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    generator.setRhythmPattern(rhythmConfig);
  }, [generator, isPlaying, rhythmConfig]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    generator.setAutomation({ modulation: modulationConfig, sweep: sweepConfig });
  }, [generator, isPlaying, modulationConfig, sweepConfig]);

  useEffect(() => {
    if (isPlaying && mixedVoices.length === 0) {
      generator.stop();
      setIsPlaying(false);
      setStatus(tFrequencyCreatorStatus('selectFrequencyOrField'));
    }
  }, [generator, isPlaying, mixedVoices.length, tFrequencyCreatorStatus]);

  useEffect(() => {
    if (isPlaying) {
      generator.setAmbientLayer(ambientSound);
    }
  }, [ambientSound, generator, isPlaying]);

  useEffect(() => {
    if (!isPlaying || !sympatheticConfig.enabled) {
      setIsRoomMonitoring(false);
      setRoomScanStatus(null);
      setRoomResponseFrequencies([]);
      roomScanLockRef.current = false;
      void roomMicService.stop();
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const runScan = async () => {
      if (roomScanLockRef.current) {
        return;
      }
      roomScanLockRef.current = true;

      try {
        const snapshot = await roomMicService.captureSpectrum({
          durationMs: 1200,
          fftSize: 2048,
          smoothingTimeConstant: 0.72
        });

        if (cancelled) {
          return;
        }

        const result = analyzeRoomSpectrum(snapshot);
        const responseTones = buildRoomResponseTones(result, sympatheticConfig.mode);

        setRoomScanResult(result);
        setRoomResponseFrequencies(responseTones.map((tone) => tone.frequency));
        setSympatheticConfig((prev) => ({
          ...prev,
          lastScanAt: result.capturedAt,
          lastConfidence: result.confidence,
          lastDominantFrequencies: result.dominantFrequencies
        }));

        if (result.confidence < sympatheticConfig.confidenceThreshold) {
          setRoomScanStatus(tFrequencyCreatorStatus('roomScanConfidenceLowPassive'));
        } else {
          setRoomScanStatus(null);
        }
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error && error.name === 'NotAllowedError'
            ? tFrequencyCreatorStatus('roomScanMicDenied')
            : tFrequencyCreatorStatus('roomScanFailedTryAgain');
        setRoomScanStatus(message);
      } finally {
        roomScanLockRef.current = false;
      }
    };

    setIsRoomMonitoring(true);
    void runScan();
    intervalId = setInterval(() => {
      void runScan();
    }, Math.max(2000, Math.round(sympatheticConfig.scanIntervalSeconds * 1000)));

    return () => {
      cancelled = true;
      setIsRoomMonitoring(false);
      if (intervalId) {
        clearInterval(intervalId);
      }
      roomScanLockRef.current = false;
      void roomMicService.stop();
    };
  }, [
    isPlaying,
    roomMicService,
    sympatheticConfig.enabled,
    sympatheticConfig.scanIntervalSeconds,
    sympatheticConfig.mode,
    sympatheticConfig.confidenceThreshold,
    tFrequencyCreatorStatus
  ]);

  useEffect(() => {
    if (!isPlaying || !adaptiveJourneyConfig.enabled) {
      journeyStartAtRef.current = null;
      journeyAdaptiveOffsetRef.current = 0;
      setJourneyRuntime(null);
      setJourneyStatus(null);
      return;
    }

    const steps =
      adaptiveJourneyConfig.steps.length > 0
        ? adaptiveJourneyConfig.steps
        : createAdaptiveJourneySteps(adaptiveJourneyConfig.intent as JourneyIntent, adaptiveJourneyConfig.durationMinutes);

    setBinauralConfig((prev) => (prev.enabled ? prev : { ...prev, enabled: true }));

    journeyStartAtRef.current = performance.now();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled || !journeyStartAtRef.current) {
        return;
      }

      const elapsedSeconds = Math.max(0, (performance.now() - journeyStartAtRef.current) / 1000);
      const runtimePoint = resolveJourneyRuntimePoint({
        steps,
        elapsedSeconds,
        adaptiveBeatOffset: journeyAdaptiveOffsetRef.current
      });

      setJourneyRuntime({
        state: runtimePoint.state,
        beatHz: runtimePoint.beatHz,
        progress: runtimePoint.overallProgress,
        elapsedSeconds: runtimePoint.elapsedSeconds,
        durationSeconds: runtimePoint.durationSeconds,
        breathBpm: journeyLastBreathRef.current,
        adaptiveOffsetHz: journeyAdaptiveOffsetRef.current
      });

      setAdaptiveJourneyConfig((prev) => ({
        ...prev,
        progress: runtimePoint.overallProgress,
        currentState: runtimePoint.state,
        currentBeatHz: runtimePoint.beatHz
      }));

      setBinauralConfig((prev) => {
        if (prev.enabled && Math.abs(prev.beatHz - runtimePoint.beatHz) <= 0.15) {
          return prev;
        }
        return {
          ...prev,
          enabled: true,
          beatHz: Number(runtimePoint.beatHz.toFixed(2))
        };
      });

      if (runtimePoint.overallProgress >= 1) {
        setJourneyStatus(tFrequencyCreatorStatus('adaptiveJourneyComplete'));
      } else {
        setJourneyStatus(
          tFrequencyCreatorStatus('journeyRuntime', {
            state: runtimePoint.state.toUpperCase(),
            beatHz: Math.round(runtimePoint.beatHz * 10) / 10,
            progress: Math.round(runtimePoint.overallProgress * 100)
          })
        );
      }
    };

    tick();
    intervalId = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    adaptiveJourneyConfig.enabled,
    adaptiveJourneyConfig.durationMinutes,
    adaptiveJourneyConfig.intent,
    adaptiveJourneyConfig.steps,
    isPlaying,
    tFrequencyCreatorStatus
  ]);

  useEffect(() => {
    if (!isPlaying || !adaptiveJourneyConfig.enabled || !adaptiveJourneyConfig.micAdaptationEnabled) {
      setIsJourneyMicSampling(false);
      journeyAdaptiveOffsetRef.current = 0;
      journeyLastBreathRef.current = null;
      void journeyMicService.stop();
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const sampleBreath = async () => {
      setIsJourneyMicSampling(true);
      try {
        const amplitude = await journeyMicService.captureAmplitudePattern({
          durationMs: 6500,
          sampleIntervalMs: 100,
          fftSize: 1024
        });

        if (cancelled) {
          return;
        }

        if (
          typeof amplitude.estimatedBreathBpm === 'number' &&
          Number.isFinite(amplitude.estimatedBreathBpm) &&
          amplitude.confidence >= 0.2
        ) {
          journeyLastBreathRef.current = amplitude.estimatedBreathBpm;
          journeyAdaptiveOffsetRef.current = suggestAdaptiveOffsetByBreath({
            breathBpm: amplitude.estimatedBreathBpm,
            intent: adaptiveJourneyConfig.intent as JourneyIntent
          });

          setAdaptiveJourneyConfig((prev) => ({
            ...prev,
            lastBreathBpm: amplitude.estimatedBreathBpm,
            lastAdaptiveOffsetHz: journeyAdaptiveOffsetRef.current
          }));
        }
      } catch (error) {
        console.warn('Journey mic adaptation sample failed.', error);
      } finally {
        setIsJourneyMicSampling(false);
        await journeyMicService.stop();
      }
    };

    void sampleBreath();
    intervalId = setInterval(() => {
      void sampleBreath();
    }, 36000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsJourneyMicSampling(false);
      void journeyMicService.stop();
    };
  }, [
    adaptiveJourneyConfig.enabled,
    adaptiveJourneyConfig.intent,
    adaptiveJourneyConfig.micAdaptationEnabled,
    isPlaying,
    journeyMicService
  ]);

  useEffect(() => {
    if (!isPlaying || !breathSyncConfig.enabled) {
      breathSyncStartAtRef.current = null;
      breathSampleGateRef.current = 0;
      breathLastConfidenceRef.current = 0;
      breathLastBpmRef.current = null;
      setIsBreathMonitoring(false);
      setBreathRuntime(null);
      generator.applyBreathControl({
        phase: 'inhale',
        phaseProgress: 0,
        coherenceScore: 0,
        gainScale: 1
      });
      void breathMicService.stop();
      return;
    }

    if (!breathSyncStartAtRef.current) {
      breathSyncStartAtRef.current = performance.now();
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (cancelled || !breathSyncStartAtRef.current) {
        return;
      }

      const elapsedSeconds = Math.max(0, (performance.now() - breathSyncStartAtRef.current) / 1000);
      const liveBreathBpm =
        breathSyncConfig.mode === 'microphone'
          ? breathLastBpmRef.current ?? breathSyncConfig.lastBreathBpm ?? breathSyncConfig.targetBpm
          : breathSyncConfig.targetBpm;
      const confidence =
        breathSyncConfig.mode === 'microphone' ? Math.max(0.1, breathLastConfidenceRef.current) : 1;
      const frame = buildBreathSyncRuntimeFrame({
        elapsedSeconds,
        breathBpm: liveBreathBpm,
        targetBpm: breathSyncConfig.targetBpm,
        inhaleRatio: breathSyncConfig.inhaleRatio,
        confidence,
        sensitivity: breathSyncConfig.sensitivity
      });

      setBreathRuntime(frame);
      generator.applyBreathControl({
        phase: frame.phase,
        phaseProgress: frame.phaseProgress,
        coherenceScore: frame.coherenceScore,
        gainScale: frame.gainScale,
        rhythmBpm: rhythmConfig.enabled ? rhythmConfig.bpm * frame.tempoScale : undefined
      });

      const now = performance.now();
      if (now >= breathSampleGateRef.current) {
        breathSampleGateRef.current = now + 3400;
        const sample = createBreathSyncSamplePoint({
          source: breathSyncConfig.mode,
          frame,
          confidence
        });
        setBreathSamples((prev) => [sample, ...prev].slice(0, 160));
      }
    };

    tick();
    intervalId = setInterval(tick, 420);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    breathMicService,
    breathSyncConfig.enabled,
    breathSyncConfig.inhaleRatio,
    breathSyncConfig.lastBreathBpm,
    breathSyncConfig.mode,
    breathSyncConfig.sensitivity,
    breathSyncConfig.targetBpm,
    generator,
    isPlaying,
    rhythmConfig.bpm,
    rhythmConfig.enabled
  ]);

  useEffect(() => {
    if (!isPlaying || !breathSyncConfig.enabled || breathSyncConfig.mode !== 'microphone') {
      setIsBreathMonitoring(false);
      breathLastConfidenceRef.current = 0;
      void breathMicService.stop();
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const sampleBreath = async () => {
      setIsBreathMonitoring(true);
      try {
        const pattern = await breathMicService.captureAmplitudePattern({
          durationMs: 7000,
          sampleIntervalMs: 90,
          fftSize: 1024
        });

        if (cancelled) {
          return;
        }

        const confidenceThreshold = clamp(0.12, 0.54 - breathSyncConfig.sensitivity * 0.34, 0.5);
        if (
          typeof pattern.estimatedBreathBpm === 'number' &&
          Number.isFinite(pattern.estimatedBreathBpm) &&
          pattern.confidence >= confidenceThreshold
        ) {
          breathLastBpmRef.current = pattern.estimatedBreathBpm;
          breathLastConfidenceRef.current = pattern.confidence;
          setBreathSyncConfig((prev) => ({
            ...prev,
            lastBreathBpm: pattern.estimatedBreathBpm,
            lastSampledAt: new Date().toISOString()
          }));
          setBreathSyncStatus(
            tFrequencyCreatorStatus('breathMicDetected', {
              bpm: pattern.estimatedBreathBpm.toFixed(1),
              confidence: Math.round(pattern.confidence * 100)
            })
          );
        } else {
          setBreathSyncStatus(tFrequencyCreatorStatus('breathMicConfidenceLow'));
        }
      } catch (error) {
        console.warn('Breath sync mic sample failed.', error);
        if (error instanceof Error && error.name === 'NotAllowedError') {
          setBreathSyncConfig((prev) => ({
            ...prev,
            mode: 'manual'
          }));
          setBreathSyncStatus(tFrequencyCreatorStatus('breathMicDeniedSwitchedManual'));
        } else {
          setBreathSyncStatus(tFrequencyCreatorStatus('breathSamplingFailed'));
        }
      } finally {
        setIsBreathMonitoring(false);
        await breathMicService.stop();
      }
    };

    void sampleBreath();
    intervalId = setInterval(() => {
      void sampleBreath();
    }, 22000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsBreathMonitoring(false);
      void breathMicService.stop();
    };
  }, [
    breathMicService,
    breathSyncConfig.enabled,
    breathSyncConfig.mode,
    breathSyncConfig.sensitivity,
    isPlaying,
    tFrequencyCreatorStatus
  ]);

  useEffect(() => {
    if (!isBaseVisualizationType(visualizationType)) {
      return;
    }

    setVisualizationLayers((prev) => {
      if (prev.some((entry) => entry.type === visualizationType)) {
        return prev;
      }

      return [...prev, createVisualizationLayer(visualizationType)];
    });
  }, [visualizationType]);

  useEffect(() => {
    if (!isCompactViewport) {
      return;
    }

    if (!isPlaying || !liveVisualizationEnabled || !visualCanvas || !showMobileLiveDock || !mobileLiveCanvasRef.current) {
      return;
    }

    const dockCanvas = mobileLiveCanvasRef.current;
    const dockCtx = dockCanvas.getContext('2d');
    if (!dockCtx) {
      return;
    }

    let frameId: number | null = null;

    const renderDock = () => {
      frameId = requestAnimationFrame(renderDock);

      const sourceWidth = visualCanvas.width || visualCanvas.clientWidth;
      const sourceHeight = visualCanvas.height || visualCanvas.clientHeight;
      if (!sourceWidth || !sourceHeight) {
        return;
      }

      if (dockCanvas.width !== sourceWidth || dockCanvas.height !== sourceHeight) {
        dockCanvas.width = sourceWidth;
        dockCanvas.height = sourceHeight;
      }

      dockCtx.clearRect(0, 0, dockCanvas.width, dockCanvas.height);
      dockCtx.drawImage(visualCanvas, 0, 0, dockCanvas.width, dockCanvas.height);
    };

    renderDock();

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isCompactViewport, isPlaying, liveVisualizationEnabled, showMobileLiveDock, visualCanvas]);

  const addFrequency = (hz: number, defaultGain = 1) => {
    const normalized = normalizeUserFrequency(hz);
    let inserted = false;

    setSelectedFrequencies((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      if (prev.length >= maxSelectableFrequencies) {
        setStatus(
          tFrequencyCreatorStatus('maxFrequenciesReached', {
            count: maxSelectableFrequencies
          })
        );
        return prev;
      }
      inserted = true;
      return [...prev, normalized];
    });

    if (!inserted) {
      return;
    }

    setFrequencyVolumes((prev) => ({
      ...prev,
      [frequencyKeyForCurrentRange(normalized)]: clamp(0.05, defaultGain, 1)
    }));
  };

  const toggleFrequency = (hz: number) => {
    const normalized = normalizeUserFrequency(hz);
    const isSelected = selectedFrequencies.includes(normalized);

    if (isSelected) {
      setSelectedFrequencies((prev) => prev.filter((value) => value !== normalized));
      setFrequencyVolumes((prev) => {
        const next = { ...prev };
        delete next[frequencyKeyForCurrentRange(normalized)];
        return next;
      });
      return;
    }

    if (selectedFrequencies.length >= maxSelectableFrequencies) {
      setStatus(
        tFrequencyCreatorStatus('maxFrequenciesReached', {
          count: maxSelectableFrequencies
        })
      );
      return;
    }

    setSelectedFrequencies((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      if (prev.length >= maxSelectableFrequencies) {
        return prev;
      }
      return [...prev, normalized];
    });
    setFrequencyVolumes((prev) => ({
      ...prev,
      [frequencyKeyForCurrentRange(normalized)]: prev[frequencyKeyForCurrentRange(normalized)] ?? 1
    }));
  };

  const addCustomFrequency = () => {
    if (!customFrequencyValid) {
      setStatus(
        tFrequencyCreatorStatus('enterValidFrequencyRange', {
          min: MIN_CUSTOM_FREQUENCY_HZ,
          max: roundedActiveFrequencyMaxHz
        })
      );
      return;
    }

    addFrequency(customFrequencyValue);
    setCustomFrequencyInput('');
    setStatus(null);
  };

  const nudgeCustomFrequency = (direction: 1 | -1) => {
    const base = customFrequencyValid ? customFrequencyValue : 432;
    const next = normalizeUserFrequency(base + direction);
    setCustomFrequencyInput(String(next));
  };

  const handleAdvancedFrequencyModeChange = (enabled: boolean) => {
    const nextFrequencyMaxHz = enabled ? advancedFrequencyMaxHz : MAX_CUSTOM_FREQUENCY_HZ;

    setAdvancedFrequencyMode(enabled);
    setSelectedFrequencies((prev) => dedupeFrequencies(prev, nextFrequencyMaxHz));
    setSweepConfig((prev) => ({
      ...prev,
      targetHz: normalizeFrequency(prev.targetHz, nextFrequencyMaxHz)
    }));
    setCustomFrequencyInput((prev) => {
      if (prev.trim().length === 0) {
        return prev;
      }

      const parsed = Number(prev);
      if (!Number.isFinite(parsed)) {
        return prev;
      }

      return String(normalizeFrequency(parsed, nextFrequencyMaxHz));
    });
  };

  const addHarmonics = () => {
    if (selectedFrequencies.length === 0) {
      setStatus(tFrequencyCreatorStatus('selectBaseFrequencyBeforeHarmonics'));
      return;
    }

    const snapshot = [...selectedFrequencies];
    let added = 0;

    snapshot.forEach((frequency) => {
      const harmonic2 = frequency * 2;
      const harmonic3 = frequency * 3;

      if (isValidFrequency(harmonic2, activeFrequencyMaxHz)) {
        const normalized = normalizeUserFrequency(harmonic2);
        if (!selectedFrequencies.includes(normalized)) {
          addFrequency(normalized, 0.55);
          added += 1;
        }
      }

      if (isValidFrequency(harmonic3, activeFrequencyMaxHz)) {
        const normalized = normalizeUserFrequency(harmonic3);
        if (!selectedFrequencies.includes(normalized)) {
          addFrequency(normalized, 0.35);
          added += 1;
        }
      }
    });

    if (added === 0) {
      setStatus(tFrequencyCreatorStatus('harmonicsAlreadyPresentOrOutOfRange'));
      return;
    }

    setStatus(
      tFrequencyCreatorStatus('addedHarmonicTones', {
        count: added
      })
    );
  };

  const setFrequencyGain = (hz: number, value: number) => {
    const key = frequencyKeyForCurrentRange(hz);
    setFrequencyVolumes((prev) => ({
      ...prev,
      [key]: clamp(0.05, value, 1)
    }));
  };

  const toggleRhythmStep = (index: number) => {
    setRhythmConfig((prev) => {
      const nextSteps = [...prev.steps];
      nextSteps[index] = !nextSteps[index];
      if (!nextSteps.some(Boolean)) {
        nextSteps[index] = true;
      }
      return {
        ...prev,
        steps: normalizeRhythmSteps(nextSteps)
      };
    });
  };

  const randomizeRhythm = () => {
    setRhythmConfig((prev) => ({
      ...prev,
      steps: randomizeSteps(prev.steps.length)
    }));
  };

  const updateLayer = (layerId: string, patch: Partial<VisualizationLayerConfig>) => {
    setVisualizationLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer))
    );
  };

  const addLayer = () => {
    setVisualizationLayers((prev) => [...prev, createVisualizationLayer(layerToAdd)]);
    setVisualizationType('multi-layer');
  };

  const removeLayer = (layerId: string) => {
    setVisualizationLayers((prev) => {
      const next = prev.filter((layer) => layer.id !== layerId);
      return next.length > 0 ? next : [createVisualizationLayer('gradient')];
    });
  };

  const moveLayer = (layerId: string, direction: -1 | 1) => {
    setVisualizationLayers((prev) => {
      const currentIndex = prev.findIndex((layer) => layer.id === layerId);
      if (currentIndex < 0) {
        return prev;
      }
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const persistVoiceProfile = async (profile: VoiceBioprintProfile) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return null;
    }

    try {
      await ensureProfile(supabase, data.user);
    } catch (error) {
      console.warn('Voice profile could not ensure profile record.', error);
      return null;
    }

    const payload: Database['public']['Tables']['voice_profiles']['Insert'] = {
      user_id: data.user.id,
      profile: profile as unknown as Json,
      confidence: profile.confidence,
      capture_duration_ms: profile.captureDurationMs,
      analysis_duration_ms: profile.analysisDurationMs
    };

    const { data: inserted, error } = await supabase
      .from('voice_profiles')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('Voice profile persistence failed.', error);
      return null;
    }

    return inserted.id;
  };

  const handleCaptureVoiceBioprint = async () => {
    if (isCapturingVoice) {
      return;
    }

    if (!voiceBioprintConfig.disclaimerAccepted) {
      setVoiceCaptureError(tFrequencyCreatorStatus('voiceDisclaimerRequired'));
      return;
    }

    setIsCapturingVoice(true);
    setVoiceCaptureError(null);
    setStatus(tFrequencyCreatorStatus('listeningVoiceProfile'));

    try {
      const snapshot = await micService.captureSpectrum({
        durationMs: 5500,
        fftSize: 2048,
        smoothingTimeConstant: 0.78
      });

      const profile = analyzeVoiceBioprint(snapshot);
      const insertedProfileId = await persistVoiceProfile(profile);

      setVoiceProfile(profile);
      setVoiceProfileId(insertedProfileId);
      setVoiceTelemetry({
        captureMs: profile.captureDurationMs,
        analysisMs: profile.analysisDurationMs,
        frameCount: profile.frameCount
      });
      setVoiceBioprintConfig((prev) => ({
        ...prev,
        enabled: true,
        lastCapturedAt: profile.capturedAt,
        confidence: profile.confidence,
        analysisDurationMs: profile.analysisDurationMs,
        recommendations: profile.recommendations,
        profileId: insertedProfileId ?? prev.profileId
      }));

      if (profile.confidence < 0.35) {
        setVoiceCaptureError(tFrequencyCreatorStatus('voiceConfidenceLow'));
      } else {
        setVoiceCaptureError(null);
      }

      setStatus(tFrequencyCreatorStatus('voiceBioprintCaptured'));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? tFrequencyCreatorStatus('voiceMicAccessDenied')
          : tFrequencyCreatorStatus('voiceCaptureFailed');
      setVoiceCaptureError(message);
      setStatus(message);
    } finally {
      await micService.stop();
      setIsCapturingVoice(false);
    }
  };

  const handleUseStarterBioprintProfile = () => {
    const profile = createFallbackVoiceBioprintProfile();
    setVoiceProfile(profile);
    setVoiceProfileId(null);
    setVoiceBioprintConfig((prev) => ({
      ...prev,
      enabled: true,
      lastCapturedAt: profile.capturedAt,
      confidence: profile.confidence,
      analysisDurationMs: profile.analysisDurationMs,
      recommendations: profile.recommendations,
      profileId: null
    }));
    setVoiceTelemetry({
      captureMs: profile.captureDurationMs,
      analysisMs: profile.analysisDurationMs,
      frameCount: profile.frameCount
    });
    setVoiceCaptureError(null);
    setStatus(tFrequencyCreatorStatus('starterVoiceProfileLoaded'));
  };

  const handleApplyVoiceRecommendations = () => {
    if (voiceBioprintConfig.recommendations.length === 0) {
      setStatus(tFrequencyCreatorStatus('captureVoiceFirst'));
      return;
    }

    const incoming = voiceBioprintConfig.recommendations.map((item) => ({
      frequency: normalizeUserFrequency(item.frequency),
      gain: clamp(0.05, item.gain, 1)
    }));

    let added = 0;
    setSelectedFrequencies((prev) => {
      const next = [...prev];
      incoming.forEach((item) => {
        if (!next.includes(item.frequency) && next.length < maxSelectableFrequencies) {
          next.push(item.frequency);
          added += 1;
        }
      });
      return next;
    });

    setFrequencyVolumes((prev) => {
      const next = { ...prev };
      incoming.forEach((item) => {
        const key = frequencyKeyForCurrentRange(item.frequency);
        next[key] = typeof next[key] === 'number' ? next[key] : item.gain;
      });
      return next;
    });

    if (added === 0) {
      setStatus(tFrequencyCreatorStatus('recommendedFrequenciesAlreadyInStack'));
      return;
    }

    setStatus(
      tFrequencyCreatorStatus('appliedVoiceRecommendations', {
        count: added
      })
    );
  };

  const openIntentionDisclaimer = (enableOnAcknowledge: boolean) => {
    setIntentionEnableOnAcknowledge(enableOnAcknowledge);
    setIntentionDisclaimerModalOpen(true);
  };

  const handleAcknowledgeIntentionDisclaimer = () => {
    setIntentionConfig((prev) => ({
      ...prev,
      disclaimerAccepted: true,
      enabled: intentionEnableOnAcknowledge ? true : prev.enabled
    }));
    setIntentionDisclaimerModalOpen(false);
    setIntentionEnableOnAcknowledge(false);
    setIntentionStatus(tFrequencyCreatorStatus('intentionDisclaimerAcknowledged'));
  };

  const handleAnalyzeIntention = () => {
    const trimmed = intentionConfig.intentionText.trim();
    if (trimmed.length < 4) {
      setIntentionStatus(tFrequencyCreatorStatus('enterShortIntention'));
      return;
    }

    const result = analyzeQuantumIntention(trimmed, {
      locale: intentionLocale
    });
    const generatedAt = new Date().toISOString();

    setIntentionConfig((prev) => ({
      ...prev,
      extractedKeywords: result.keywords,
      mappedFrequencies: result.mappedFrequencies,
      mappingConfidence: result.confidence,
      modulationRateHz: result.modulationRateHz,
      modulationDepthHz: result.modulationDepthHz,
      ritualIntensity: result.ritualIntensity,
      certificateSeed: result.certificateSeed,
      lastImprintedAt: generatedAt
    }));
    setIntentionShareText(
      buildIntentionShareText({
        intentionText: trimmed,
        keywords: result.keywords,
        mappedFrequencies: result.mappedFrequencies,
        certificateSeed: result.certificateSeed,
        locale: intentionLocale
      })
    );
    setIntentionStatus(
      tFrequencyCreatorStatus('intentionReflectionConfidence', {
        summary: result.reflectionSummary,
        confidence: Math.round(result.confidence * 100)
      })
    );
  };

  const handleApplyIntentionMapping = () => {
    if (intentionConfig.mappedFrequencies.length === 0) {
      setIntentionStatus(tFrequencyCreatorStatus('analyzeIntentionFirst'));
      return;
    }

    const incoming = intentionConfig.mappedFrequencies.map((frequency) => ({
      frequency: normalizeUserFrequency(frequency),
      gain: clamp(0.05, 0.28 + intentionConfig.mappingConfidence * 0.38, 0.85)
    }));

    let added = 0;
    setSelectedFrequencies((prev) => {
      const next = [...prev];
      incoming.forEach((item) => {
        if (!next.includes(item.frequency) && next.length < maxSelectableFrequencies) {
          next.push(item.frequency);
          added += 1;
        }
      });
      return next;
    });

    setFrequencyVolumes((prev) => {
      const next = { ...prev };
      incoming.forEach((item) => {
        const key = frequencyKeyForCurrentRange(item.frequency);
        next[key] = typeof next[key] === 'number' ? next[key] : item.gain;
      });
      return next;
    });

    setIntentionConfig((prev) => ({
      ...prev,
      lastImprintedAt: new Date().toISOString()
    }));

    if (added === 0) {
      setStatus(tFrequencyCreatorStatus('intentionFrequenciesAlreadyInStack'));
      return;
    }

    setStatus(
      tFrequencyCreatorStatus('appliedIntentionFrequencies', {
        count: added
      })
    );
    setIntentionStatus(tFrequencyCreatorStatus('intentionFrequenciesBlended'));
  };

  const handleCopyIntentionShare = async () => {
    if (!intentionShareText) {
      setIntentionStatus(tFrequencyCreatorStatus('analyzeIntentionForShare'));
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setIntentionStatus(tFrequencyCreatorStatus('clipboardUnavailable'));
      return;
    }

    try {
      await navigator.clipboard.writeText(intentionShareText);
      setIntentionStatus(tFrequencyCreatorStatus('intentionShareCopied'));
    } catch (error) {
      console.error(error);
      setIntentionStatus(tFrequencyCreatorStatus('intentionShareCopyFailed'));
    }
  };

  const handleCalibrateRoom = async () => {
    if (isCalibratingRoom) {
      return;
    }

    setIsCalibratingRoom(true);
    setRoomScanStatus(tFrequencyCreatorStatus('calibratingRoomNoiseFloor'));

    try {
      const snapshot = await roomMicService.captureSpectrum({
        durationMs: 2500,
        fftSize: 2048,
        smoothingTimeConstant: 0.74
      });
      const result = analyzeRoomSpectrum(snapshot);

      setSympatheticConfig((prev) => ({
        ...prev,
        calibratedNoiseFloorDb: result.noiseFloorDb,
        lastScanAt: result.capturedAt,
        lastConfidence: result.confidence,
        lastDominantFrequencies: result.dominantFrequencies
      }));
      setRoomScanResult(result);
      setRoomResponseFrequencies(buildRoomResponseTones(result, sympatheticConfig.mode).map((tone) => tone.frequency));
      setRoomScanStatus(
        tFrequencyCreatorStatus('roomCalibratedAtNoiseFloor', {
          noiseFloor: result.noiseFloorDb
        })
      );
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? tFrequencyCreatorStatus('roomCalibrationMicDenied')
          : tFrequencyCreatorStatus('roomCalibrationFailed');
      setRoomScanStatus(message);
    } finally {
      await roomMicService.stop();
      setIsCalibratingRoom(false);
    }
  };

  const handleScanRoomNow = async () => {
    if (roomScanLockRef.current || isCalibratingRoom) {
      return;
    }

    setRoomScanStatus(tFrequencyCreatorStatus('runningRoomScan'));
    roomScanLockRef.current = true;

    try {
      const snapshot = await roomMicService.captureSpectrum({
        durationMs: 1200,
        fftSize: 2048,
        smoothingTimeConstant: 0.72
      });
      const result = analyzeRoomSpectrum(snapshot);
      const tones = buildRoomResponseTones(result, sympatheticConfig.mode);

      setRoomScanResult(result);
      setRoomResponseFrequencies(tones.map((tone) => tone.frequency));
      setSympatheticConfig((prev) => ({
        ...prev,
        lastScanAt: result.capturedAt,
        lastConfidence: result.confidence,
        lastDominantFrequencies: result.dominantFrequencies
      }));
      setRoomScanStatus(
        result.confidence < sympatheticConfig.confidenceThreshold
          ? tFrequencyCreatorStatus('roomScanConfidenceLow')
          : tFrequencyCreatorStatus('roomScanUpdated')
      );
    } catch (error) {
      console.error(error);
      setRoomScanStatus(tFrequencyCreatorStatus('roomScanFailed'));
    } finally {
      roomScanLockRef.current = false;
      await roomMicService.stop();
    }
  };

  const handleCalibrateBreathSync = async () => {
    if (isBreathCalibrating || isBreathMonitoring) {
      return;
    }

    setIsBreathCalibrating(true);
    setBreathSyncStatus(tFrequencyCreatorStatus('calibratingBreathMicBaseline'));

    try {
      const snapshot = await breathMicService.captureSpectrum({
        durationMs: 4200,
        fftSize: 1024,
        smoothingTimeConstant: 0.7
      });
      const noiseFloor = Number(snapshot.noiseFloorDb.toFixed(2));
      setBreathSyncConfig((prev) => ({
        ...prev,
        calibrationNoiseFloorDb: noiseFloor,
        lastSampledAt: new Date().toISOString()
      }));
      setBreathSyncStatus(
        tFrequencyCreatorStatus('breathMicCalibratedNoiseFloor', {
          noiseFloor
        })
      );
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? tFrequencyCreatorStatus('breathCalibrationMicDenied')
          : tFrequencyCreatorStatus('breathCalibrationFailed');
      setBreathSyncStatus(message);
    } finally {
      await breathMicService.stop();
      setIsBreathCalibrating(false);
    }
  };

  const handleBreathModeChange = (mode: BreathSyncMode) => {
    setBreathSyncConfig((prev) => ({
      ...prev,
      mode
    }));
    setBreathSyncStatus(null);
    breathLastConfidenceRef.current = 0;
    breathLastBpmRef.current = mode === 'manual' ? breathSyncConfig.targetBpm : null;
  };

  const handleAdaptiveIntentChange = (intent: JourneyIntent) => {
    const template = getAdaptiveJourneyTemplate(intent);
    const nextDuration = adaptiveJourneyConfig.durationMinutes || template.defaultDurationMinutes;
    setAdaptiveJourneyConfig((prev) => ({
      ...prev,
      intent,
      steps: createAdaptiveJourneySteps(intent, nextDuration),
      progress: 0,
      currentState: template.steps[0]?.state ?? 'alpha',
      currentBeatHz: template.steps[0]?.beatHz ?? 8
    }));
    setJourneyRuntime(null);
    journeyStartAtRef.current = null;
    journeyAdaptiveOffsetRef.current = 0;
    journeyLastBreathRef.current = null;
    setJourneyStatus(null);
  };

  const handleAdaptiveDurationChange = (durationMinutes: number) => {
    const nextDuration = clamp(8, durationMinutes, 60);
    setAdaptiveJourneyConfig((prev) => ({
      ...prev,
      durationMinutes: nextDuration,
      steps: createAdaptiveJourneySteps(prev.intent as JourneyIntent, nextDuration),
      progress: 0
    }));
    setJourneyRuntime(null);
    journeyStartAtRef.current = null;
    setJourneyStatus(null);
  };

  const currentLayerEntries = visualizationType === 'multi-layer' ? visualizationLayers : effectiveVisualizationLayers;

  const trackEvent = useCallback(
    (name: string, properties?: Record<string, string | number | boolean | null | undefined>) => {
      try {
        track(name, properties);
      } catch (error) {
        console.warn('Analytics track failed.', error);
      }
    },
    []
  );

  const createRedirectTo = useCallback(
    (focus: PostAuthFocus) => {
      return `${pathname}?postAuthFocus=${focus}`;
    },
    [pathname]
  );

  const buildAuthHref = useCallback(
    (mode: 'login' | 'signup', focus: PostAuthFocus) => {
      return `/${mode}?redirectTo=${encodeURIComponent(createRedirectTo(focus))}`;
    },
    [createRedirectTo]
  );

  const handleUnlockStudioControls = (source: 'manual' | 'sticky' | 'auto_after_first_play' = 'manual') => {
    setIsStudioUnlocked(true);
    setHasReachedFirstValue(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STUDIO_UNLOCK_KEY, '1');
      window.localStorage.setItem(FIRST_VALUE_KEY, '1');
    }
    trackEvent('ftue_studio_unlocked', {
      source,
      is_guest: isGuest,
      is_authenticated: Boolean(userId)
    });
    setStatus(tFrequencyCreator('ui.studioControlsUnlocked'));
  };

  const handleAuthCtaClick = (
    source:
      | 'guest_publishing'
      | 'advanced_preview'
      | 'auth_modal'
      | 'sticky_advanced',
    cta: 'sign_in' | 'sign_up',
    focus: PostAuthFocus
  ) => {
    trackEvent('ftue_auth_cta_click', {
      source,
      cta,
      focus
    });
  };

  const handlePromptSignIn = (source: 'advanced_preview_card' | 'sticky_advanced', focus: PostAuthFocus) => {
    trackEvent('ftue_advanced_teaser_click', {
      source,
      focus
    });
    setAuthModalFocus(focus);
    setStatus(tFrequencyCreatorStatus('signInToSaveComposition'));
    setAuthModalOpen(true);
  };

  const handlePlay = async () => {
    if (isSaving) {
      return;
    }

    if (isPlaying) {
      generator.stop();
      setIsPlaying(false);
      return;
    }

    if (mixedVoices.length === 0) {
      setStatus(tFrequencyCreatorStatus('selectFrequencyOrFieldBeforePlayback'));
      return;
    }

    if (adaptiveJourneyConfig.enabled && !journeyHeadphonesConfirmed) {
      setStatus(tFrequencyCreatorStatus('adaptiveJourneyHeadphonesRequired'));
      return;
    }

    if (intentionConfig.enabled && !intentionConfig.disclaimerAccepted) {
      setStatus(tFrequencyCreatorStatus('acknowledgeIntentionDisclaimerBeforePlayback'));
      setIntentionStatus(tFrequencyCreatorStatus('intentionAcknowledgementRequiredPlayback'));
      openIntentionDisclaimer(false);
      return;
    }

    try {
      const shouldEnableBridge = isIOS || isIOSDevice() || isAndroidDevice();
      await generator.initialize(DEFAULT_EFFECTS, {
        enableAudioBridge: shouldEnableBridge
      });
      const initializedSampleRate = generator.getSampleRate();
      if (typeof initializedSampleRate === 'number' && Number.isFinite(initializedSampleRate) && initializedSampleRate > 0) {
        setAudioSampleRate(initializedSampleRate);
      }
      if (adaptiveJourneyConfig.enabled && !binauralConfig.enabled) {
        setBinauralConfig((prev) => ({ ...prev, enabled: true }));
      }
      if (harmonicFieldConfig.enabled) {
        const playedAt = new Date().toISOString();
        setHarmonicFieldConfig((prev) => ({
          ...prev,
          lastFieldAt: playedAt,
          lastLayerFrequencies: harmonicFieldBundle.layerFrequencies,
          lastInterferenceFrequencies: harmonicFieldBundle.interferenceFrequencies
        }));
      }
      if (breathSyncConfig.enabled) {
        breathSyncStartAtRef.current = performance.now();
        breathSampleGateRef.current = 0;
        breathLastBpmRef.current = breathSyncConfig.mode === 'manual' ? breathSyncConfig.targetBpm : null;
        breathLastConfidenceRef.current = breathSyncConfig.mode === 'manual' ? 1 : 0;
        setBreathSamples([]);
        setBreathSyncStatus(
          breathSyncConfig.mode === 'microphone'
            ? tFrequencyCreatorStatus('breathSyncListeningMic')
            : tFrequencyCreatorStatus('breathSyncManualMode')
        );
      }
      generator.setMasterVolume(volume);
      generator.setRhythmPattern(rhythmConfig);
      generator.setAutomation({ modulation: modulationConfig, sweep: sweepConfig });
      setAnalyser(generator.getAnalyser());

      if (!hasReachedFirstValue) {
        setHasReachedFirstValue(true);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(FIRST_VALUE_KEY, '1');
        }
        trackEvent('ftue_first_play_started', {
          is_guest: isGuest,
          selected_frequency_count: selectedFrequencies.length
        });
      }
      if (!userId && !isStudioUnlocked) {
        setIsStudioUnlocked(true);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STUDIO_UNLOCK_KEY, '1');
        }
        trackEvent('ftue_studio_unlocked', {
          source: 'auto_after_first_play',
          is_guest: true,
          is_authenticated: false
        });
      }

      setIsPlaying(true);
      setStatus(null);
    } catch (error) {
      console.error(error);
      setStatus(tFrequencyCreatorStatus('audioStartFailed'));
    }
  };

  const resolveSavedShareUrl = () => {
    if (!savedCompositionPath) {
      return null;
    }

    if (typeof window !== 'undefined') {
      return `${window.location.origin}${savedCompositionPath}`;
    }

    return savedCompositionUrl ?? savedCompositionPath;
  };

  const handleCopyShareLink = async () => {
    const shareUrl = resolveSavedShareUrl();
    if (!shareUrl) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setShareStatus(tFrequencyCreatorStatus('clipboardUnavailable'));
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus(tFrequencyCreatorStatus('shareLinkCopied'));
    } catch (error) {
      console.error(error);
      setShareStatus(tFrequencyCreatorStatus('shareLinkCopyFailed'));
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = resolveSavedShareUrl();
    if (!shareUrl) {
      return;
    }

    if (!navigator.share) {
      await handleCopyShareLink();
      return;
    }

    try {
      await navigator.share({
        title: title.trim() || tFrequencyCreator('defaults.healingSessionTitle'),
        text: tFrequencyCreator('share.listenToSession'),
        url: shareUrl
      });
      setShareStatus(tFrequencyCreatorStatus('shared'));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error(error);
      setShareStatus(tFrequencyCreatorStatus('shareCanceledOrUnavailable'));
    }
  };

  const handleCopyEmbedCode = async () => {
    if (!savedEmbedCode) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setShareStatus(tFrequencyCreatorStatus('clipboardUnavailable'));
      return;
    }

    try {
      await navigator.clipboard.writeText(savedEmbedCode);
      setShareStatus(tFrequencyCreatorStatus('embedCodeCopied'));
    } catch (error) {
      console.error(error);
      setShareStatus(tFrequencyCreatorStatus('embedCodeCopyFailed'));
    }
  };

  const handleSocialShare = (channel: 'x' | 'facebook' | 'linkedin') => {
    if (typeof window === 'undefined') {
      return;
    }

    const shareUrl = resolveSavedShareUrl();
    if (!shareUrl) {
      return;
    }

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(
      `${title.trim() || tFrequencyCreator('defaults.healingSessionTitle')} | ${tFrequencyCreator('share.studioName')}`
    );
    const socialTarget =
      channel === 'x'
        ? `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`
        : channel === 'facebook'
          ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
          : `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

    window.open(socialTarget, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (!isPlaying) {
      setStatus(tFrequencyCreatorStatus('pressPlayBeforeSaving'));
      return;
    }

    if (mixedVoices.length === 0) {
      setStatus(tFrequencyCreatorStatus('selectFrequencyOrField'));
      return;
    }

    if (intentionConfig.enabled && !intentionConfig.disclaimerAccepted) {
      setStatus(tFrequencyCreatorStatus('acknowledgeIntentionDisclaimerBeforeSaving'));
      setIntentionStatus(tFrequencyCreatorStatus('intentionAcknowledgementRequiredSaving'));
      openIntentionDisclaimer(false);
      return;
    }

    if (audioFormat === 'mp3' && duration > mp3LimitSeconds) {
      setStatus(
        tFrequencyCreatorStatus('mp3LimitExceeded', {
          seconds: mp3LimitSeconds
        })
      );
      return;
    }

    if (!userId) {
      setStatus(tFrequencyCreatorStatus('signInToSaveComposition'));
      setAuthModalFocus('publishing');
      setAuthModalOpen(true);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const activeUserId = data.user?.id ?? userId;
    const activeUser = data.user ?? null;
    if (!activeUserId || !activeUser) {
      setStatus(tFrequencyCreatorStatus('signInToSaveComposition'));
      setAuthModalFocus('publishing');
      setAuthModalOpen(true);
      return;
    }

    setSavedCompositionId(null);
    setSavedCompositionPublic(null);
    setShareStatus(null);

    try {
      await ensureProfile(supabase, activeUser);
    } catch (profileError) {
      console.error(profileError);
      setStatus(tFrequencyCreatorStatus('profileSetupFailed'));
      return;
    }

    setIsSaving(true);
    setStatus(tFrequencyCreatorStatus('preparingSession'));
    let destinationAudioCapture: ReturnType<typeof createDestinationAudioCapture> | null = null;

    try {
      const wasTruncated = duration > MAX_EXPORT_SECONDS;
      const exportDuration = Math.min(duration, MAX_EXPORT_SECONDS);
      const canvas = visualCanvas;
      const targetTotalBitrateBps = Math.floor((VIDEO_UPLOAD_TARGET_BYTES * 8) / Math.max(1, exportDuration));
      const videoBitrateBps = clamp(
        MIN_VIDEO_BITRATE_BPS,
        targetTotalBitrateBps - VIDEO_AUDIO_BITRATE_BPS,
        MAX_VIDEO_BITRATE_BPS
      );
      const captureFps = exportDuration >= 240 ? 24 : 30;

      if (includeVideo && !canvas) {
        setStatus(tFrequencyCreatorStatus('videoCaptureNotReady'));
        return;
      }

      if (includeVideo) {
        try {
          destinationAudioCapture = createDestinationAudioCapture();
        } catch (error) {
          console.error(error);
          setStatus(tFrequencyCreatorStatus('syncedVideoUnsupported'));
          return;
        }
      }

      const videoPromise =
        includeVideo && canvas
          ? captureVideo(canvas, exportDuration, {
              audioStream: destinationAudioCapture?.stream ?? null,
              fps: captureFps,
              videoBitsPerSecond: videoBitrateBps,
              audioBitsPerSecond: VIDEO_AUDIO_BITRATE_BPS
            })
          : Promise.resolve(null);
      const thumbnailPromise = canvas ? captureThumbnail(canvas) : Promise.resolve(null);

      setStatus(
        includeVideo
          ? tFrequencyCreatorStatus('recordingAudioAndVideo')
          : tFrequencyCreatorStatus('recordingAudioOnly')
      );
      const exportResult = await exportAudio(exportDuration, audioFormat);
      const [videoBlob, thumbnailBlob] = await Promise.all([videoPromise, thumbnailPromise]);

      const slug = createSlug(title) || 'session';
      const timestamp = Date.now();
      const fileName = `${activeUserId}/${timestamp}-${slug}.${exportResult.extension}`;
      setStatus(tFrequencyCreatorStatus('uploadingAudio'));
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(fileName, exportResult.blob, { contentType: exportResult.mimeType, upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(uploadData.path).data.publicUrl;
      let videoUrl: string | null = null;
      let thumbnailUrl: string | null = null;

      if (includeVideo && !videoBlob) {
        setStatus(tFrequencyCreatorStatus('videoExportUnavailableDevice'));
      }

      if (videoBlob) {
        if (videoBlob.size > SUPABASE_OBJECT_LIMIT_BYTES) {
          const maxMb = Math.round(SUPABASE_OBJECT_LIMIT_BYTES / (1024 * 1024));
          const videoMb = (videoBlob.size / (1024 * 1024)).toFixed(1);
          setStatus(
            tFrequencyCreatorStatus('videoExportExceededLimit', {
              videoMb,
              maxMb
            })
          );
        } else {
          setStatus(tFrequencyCreatorStatus('uploadingVideo'));
          const videoExtension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
          const videoName = `${activeUserId}/${timestamp}-${slug}.${videoExtension}`;
          const { data: videoData, error: videoError } = await supabase.storage
            .from(VIDEO_BUCKET)
            .upload(videoName, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });

          if (videoError) {
            const message = videoError.message.toLowerCase();
            if (message.includes('maximum allowed size')) {
              const maxMb = Math.round(SUPABASE_OBJECT_LIMIT_BYTES / (1024 * 1024));
              setStatus(
                tFrequencyCreatorStatus('videoFileExceededLimit', {
                  maxMb
                })
              );
            } else {
              throw videoError;
            }
          } else {
            videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(videoData.path).data.publicUrl;
          }
        }
      }

      if (thumbnailBlob) {
        setStatus(tFrequencyCreatorStatus('uploadingThumbnail'));
        const thumbName = `${activeUserId}/${timestamp}-${slug}.png`;
        const { data: thumbData, error: thumbError } = await supabase.storage
          .from(THUMBNAIL_BUCKET)
          .upload(thumbName, thumbnailBlob, { contentType: 'image/png', upsert: true });

        if (thumbError) {
          throw thumbError;
        }

        thumbnailUrl = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(thumbData.path).data.publicUrl;
      }

      const frequenciesToStore = frequenciesForStorage(
        mixStyle,
        selectedFrequencies,
        mixedVoices,
        activeFrequencyMaxHz
      );
      const frequencyVolumesPayload: Json = Object.fromEntries(
        selectedFrequencies.map((frequency) => {
          const key = frequencyKeyForCurrentRange(frequency);
          return [key, frequencyVolumes[key] ?? 1];
        })
      );
      const effectsConfig: Json = {
        reverb: DEFAULT_EFFECTS.reverb
          ? { decay: DEFAULT_EFFECTS.reverb.decay, wet: DEFAULT_EFFECTS.reverb.wet }
          : null,
        delay: DEFAULT_EFFECTS.delay
          ? {
              time: DEFAULT_EFFECTS.delay.time,
              feedback: DEFAULT_EFFECTS.delay.feedback,
              wet: DEFAULT_EFFECTS.delay.wet
            }
          : null,
        mix_style: mixStyle,
        binaural_enabled: binauralConfig.enabled
      };
      const intentionKeywordTags = intentionConfig.enabled
        ? intentionConfig.extractedKeywords
            .slice(0, 2)
            .map((keyword) => keyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
            .filter((keyword) => keyword.length > 0)
            .map((keyword) => `intent-${keyword}`)
        : [];

      const insertPayload: CompositionInsert = {
        user_id: activeUserId,
        title: title.trim() || tFrequencyCreator('defaults.untitledSession'),
        description,
        frequencies: frequenciesToStore,
        frequency_volumes: frequencyVolumesPayload,
        duration: exportDuration,
        waveform,
        ambient_sound: ambientSound === 'none' ? null : ambientSound,
        effects: effectsConfig,
        audio_config: audioConfigJson,
        innovation_config: {
          voiceBioprint: {
            enabled: voiceBioprintConfig.enabled,
            confidence: voiceBioprintConfig.confidence,
            profileId: voiceProfileId,
            recommendations: voiceBioprintConfig.recommendations.map((entry) => ({ ...entry })),
            analysisDurationMs: voiceBioprintConfig.analysisDurationMs
          },
          sympatheticResonance: {
            enabled: sympatheticConfig.enabled,
            mode: sympatheticConfig.mode,
            scanIntervalSeconds: sympatheticConfig.scanIntervalSeconds,
            confidenceThreshold: sympatheticConfig.confidenceThreshold,
            calibratedNoiseFloorDb: sympatheticConfig.calibratedNoiseFloorDb,
            lastScanAt: roomScanResult?.capturedAt ?? sympatheticConfig.lastScanAt,
            lastConfidence: roomScanResult?.confidence ?? sympatheticConfig.lastConfidence,
            lastDominantFrequencies:
              roomScanResult?.dominantFrequencies ?? sympatheticConfig.lastDominantFrequencies,
            responseFrequencies: roomResponseFrequencies
          },
          adaptiveBinauralJourney: {
            enabled: adaptiveJourneyConfig.enabled,
            intent: adaptiveJourneyConfig.intent,
            durationMinutes: adaptiveJourneyConfig.durationMinutes,
            micAdaptationEnabled: adaptiveJourneyConfig.micAdaptationEnabled,
            lastBreathBpm: journeyLastBreathRef.current ?? adaptiveJourneyConfig.lastBreathBpm,
            lastAdaptiveOffsetHz: journeyAdaptiveOffsetRef.current,
            progress: journeyRuntime?.progress ?? adaptiveJourneyConfig.progress,
            currentState: journeyRuntime?.state ?? adaptiveJourneyConfig.currentState,
            currentBeatHz: journeyRuntime?.beatHz ?? adaptiveJourneyConfig.currentBeatHz,
            steps: adaptiveJourneyConfig.steps.map((entry) => ({ ...entry }))
          },
          breathSync: {
            enabled: breathSyncConfig.enabled,
            mode: breathSyncConfig.mode,
            targetBpm: breathSyncConfig.targetBpm,
            inhaleRatio: breathSyncConfig.inhaleRatio,
            sensitivity: breathSyncConfig.sensitivity,
            calibrationNoiseFloorDb: breathSyncConfig.calibrationNoiseFloorDb,
            lastBreathBpm: breathRuntime?.breathBpm ?? breathSyncConfig.lastBreathBpm,
            coherenceScore: breathRuntime?.coherenceScore ?? breathSyncConfig.coherenceScore,
            phase: breathRuntime?.phase ?? breathSyncConfig.phase,
            phaseProgress: breathRuntime?.phaseProgress ?? breathSyncConfig.phaseProgress,
            lastSampledAt: breathSamples[0]?.capturedAt ?? breathSyncConfig.lastSampledAt
          },
          intentionImprint: {
            enabled: intentionConfig.enabled,
            disclaimerAccepted: intentionConfig.disclaimerAccepted,
            intentionText: intentionConfig.intentionText,
            extractedKeywords: intentionConfig.extractedKeywords,
            mappedFrequencies: intentionConfig.mappedFrequencies,
            mappingConfidence: intentionConfig.mappingConfidence,
            modulationRateHz: intentionConfig.modulationRateHz,
            modulationDepthHz: intentionConfig.modulationDepthHz,
            ritualIntensity: intentionConfig.ritualIntensity,
            certificateSeed: intentionConfig.certificateSeed,
            lastImprintedAt: intentionConfig.lastImprintedAt
          },
          harmonicField: {
            enabled: harmonicFieldConfig.enabled,
            presetId: harmonicFieldConfig.presetId,
            intensity: harmonicFieldConfig.intensity,
            includeInterference: harmonicFieldConfig.includeInterference,
            spatialMotionEnabled: harmonicFieldConfig.spatialMotionEnabled,
            motionSpeed: harmonicFieldConfig.motionSpeed,
            lastFieldAt: harmonicFieldConfig.lastFieldAt,
            layerFrequencies: harmonicFieldBundle.layerFrequencies,
            interferenceFrequencies: harmonicFieldBundle.interferenceFrequencies
          }
        },
        innovation_flags: [
          voiceBioprintConfig.enabled ? 'voice_bioprint' : null,
          sympatheticConfig.enabled ? 'sympathetic_resonance' : null,
          adaptiveJourneyConfig.enabled ? 'adaptive_binaural_journey' : null,
          breathSyncConfig.enabled ? 'breath_sync_protocol' : null,
          intentionConfig.enabled ? 'quantum_intention_imprint' : null,
          harmonicFieldConfig.enabled ? 'solfeggio_harmonic_field' : null
        ].filter((value): value is string => Boolean(value)),
        scientific_disclaimer_ack:
          voiceBioprintConfig.disclaimerAccepted ||
          (intentionConfig.enabled && intentionConfig.disclaimerAccepted) ||
          Boolean(sympatheticConfig.enabled) ||
          Boolean(breathSyncConfig.enabled) ||
          Boolean(harmonicFieldConfig.enabled),
        voice_profile_id: voiceProfileId,
        visualization_type: visualizationType,
        visualization_config: { palette: 'ember-lagoon' },
        visualization_layers: toVisualizationLayersPayload(effectiveVisualizationLayers),
        audio_url: publicUrl,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        is_public: isPublic,
        tags: [
          ambientSound,
          binauralConfig.enabled ? 'binaural' : null,
          voiceBioprintConfig.enabled ? 'voice-bioprint' : null,
          sympatheticConfig.enabled ? `room-${sympatheticConfig.mode}` : null,
          adaptiveJourneyConfig.enabled ? `journey-${adaptiveJourneyConfig.intent}` : null,
          breathSyncConfig.enabled ? 'breath-sync' : null,
          intentionConfig.enabled ? 'quantum-intention' : null,
          ...intentionKeywordTags,
          harmonicFieldConfig.enabled ? 'solfeggio-field' : null,
          harmonicFieldConfig.enabled ? `field-${harmonicFieldConfig.presetId}` : null
        ].filter((tag): tag is string => Boolean(tag) && tag !== 'none')
      };

      let insertResult = await supabase.from('compositions').insert(insertPayload).select('id').single();

      if (
        insertResult.error &&
        (insertResult.error.message.includes('audio_config') ||
          insertResult.error.message.includes('visualization_layers') ||
          insertResult.error.message.includes('innovation_config') ||
          insertResult.error.message.includes('innovation_flags') ||
          insertResult.error.message.includes('scientific_disclaimer_ack') ||
          insertResult.error.message.includes('voice_profile_id'))
      ) {
        const {
          audio_config: _audioConfig,
          visualization_layers: _visualizationLayers,
          innovation_config: _innovationConfig,
          innovation_flags: _innovationFlags,
          scientific_disclaimer_ack: _scientificDisclaimerAck,
          voice_profile_id: _voiceProfileId,
          ...fallbackPayload
        } = insertPayload;
        insertResult = await supabase
          .from('compositions')
          .insert(fallbackPayload as CompositionInsert)
          .select('id')
          .single();
      }

      if (insertResult.error) {
        throw insertResult.error;
      }

      if (insertResult.data?.id) {
        setSavedCompositionId(insertResult.data.id);
        setSavedCompositionPublic(Boolean(isPublic));

        if (
          sympatheticConfig.enabled &&
          (roomScanResult?.dominantFrequencies.length ?? sympatheticConfig.lastDominantFrequencies.length) > 0
        ) {
          const dominantFrequencies =
            roomScanResult?.dominantFrequencies ?? sympatheticConfig.lastDominantFrequencies;
          const { error: roomScanInsertError } = await supabase.from('room_scans').insert({
            user_id: activeUserId,
            composition_id: insertResult.data.id,
            mode: sympatheticConfig.mode,
            dominant_frequencies: dominantFrequencies as unknown as Json,
            spectrum: (roomScanResult?.spectrumMap ?? null) as Json | null,
            confidence: roomScanResult?.confidence ?? sympatheticConfig.lastConfidence,
            noise_floor_db: roomScanResult?.noiseFloorDb ?? sympatheticConfig.calibratedNoiseFloorDb,
            peak_db: roomScanResult?.peakDb ?? null
          });

          if (roomScanInsertError) {
            console.warn('Room scan persistence failed.', roomScanInsertError);
          }
        }

        if (adaptiveJourneyConfig.enabled) {
          const { error: journeyInsertError } = await supabase.from('journey_sessions').insert({
            user_id: activeUserId,
            composition_id: insertResult.data.id,
            intent: adaptiveJourneyConfig.intent,
            current_state: journeyRuntime?.state ?? adaptiveJourneyConfig.currentState,
            progress: journeyRuntime?.progress ?? adaptiveJourneyConfig.progress,
            last_beat_hz: journeyRuntime?.beatHz ?? adaptiveJourneyConfig.currentBeatHz,
            last_breath_bpm: journeyLastBreathRef.current ?? adaptiveJourneyConfig.lastBreathBpm,
            adaptive_offset_hz: journeyAdaptiveOffsetRef.current,
            duration_minutes: adaptiveJourneyConfig.durationMinutes,
            mic_adaptation_enabled: adaptiveJourneyConfig.micAdaptationEnabled
          });

          if (journeyInsertError) {
            console.warn('Journey session persistence failed.', journeyInsertError);
          }
        }

        if (breathSyncConfig.enabled) {
          const summary = summarizeBreathSyncSession(breathSamples);
          const { error: breathInsertError } = await supabase.from('breath_sessions').insert({
            user_id: activeUserId,
            composition_id: insertResult.data.id,
            mode: breathSyncConfig.mode,
            target_bpm: breathSyncConfig.targetBpm,
            average_breath_bpm:
              summary.averageBreathBpm > 0
                ? summary.averageBreathBpm
                : breathRuntime?.breathBpm ?? breathSyncConfig.lastBreathBpm,
            coherence_score:
              summary.coherenceScore > 0
                ? summary.coherenceScore
                : breathRuntime?.coherenceScore ?? breathSyncConfig.coherenceScore,
            peak_coherence_score:
              summary.peakCoherenceScore > 0
                ? summary.peakCoherenceScore
                : breathRuntime?.coherenceScore ?? breathSyncConfig.coherenceScore,
            time_in_coherence_pct: summary.timeInCoherencePct,
            inhale_ratio: breathSyncConfig.inhaleRatio,
            sensitivity: breathSyncConfig.sensitivity,
            calibration_noise_floor_db: breathSyncConfig.calibrationNoiseFloorDb,
            sample_count: summary.sampleCount
          });

          if (breathInsertError) {
            console.warn('Breath sync persistence failed.', breathInsertError);
          }
        }

        if (harmonicFieldConfig.enabled && harmonicFieldBundle.layerFrequencies.length > 0) {
          const createdAt = harmonicFieldConfig.lastFieldAt ?? new Date().toISOString();
          const { error: harmonicInsertError } = await supabase.from('harmonic_field_sessions').insert({
            user_id: activeUserId,
            composition_id: insertResult.data.id,
            preset_id: harmonicFieldConfig.presetId,
            layer_frequencies: harmonicFieldBundle.layerFrequencies as unknown as Json,
            interference_frequencies:
              (harmonicFieldConfig.includeInterference
                ? harmonicFieldBundle.interferenceFrequencies
                : []) as unknown as Json,
            intensity: harmonicFieldConfig.intensity,
            include_interference: harmonicFieldConfig.includeInterference,
            spatial_motion_enabled: harmonicFieldConfig.spatialMotionEnabled,
            motion_speed: harmonicFieldConfig.motionSpeed,
            created_at: createdAt
          });

          if (harmonicInsertError) {
            console.warn('Harmonic field persistence failed.', harmonicInsertError);
          }
        }

        if (intentionConfig.enabled && intentionConfig.intentionText.trim().length > 0) {
          const createdAt = intentionConfig.lastImprintedAt ?? new Date().toISOString();
          const mappingPayload: Json = {
            intentionText: intentionConfig.intentionText.trim(),
            keywords: intentionConfig.extractedKeywords,
            mappedFrequencies: intentionConfig.mappedFrequencies,
            mappingConfidence: intentionConfig.mappingConfidence,
            modulationRateHz: intentionConfig.modulationRateHz,
            modulationDepthHz: intentionConfig.modulationDepthHz,
            ritualIntensity: intentionConfig.ritualIntensity,
            certificateSeed: intentionConfig.certificateSeed,
            shareText: intentionShareText
          };
          const { error: intentionInsertError } = await supabase.from('intention_imprints').insert({
            user_id: activeUserId,
            composition_id: insertResult.data.id,
            intention_text: intentionConfig.intentionText.trim(),
            mapping: mappingPayload,
            extracted_keywords: intentionConfig.extractedKeywords,
            mapped_frequencies: intentionConfig.mappedFrequencies as unknown as Json,
            mapping_confidence: intentionConfig.mappingConfidence,
            modulation_rate_hz: intentionConfig.modulationRateHz,
            modulation_depth_hz: intentionConfig.modulationDepthHz,
            ritual_intensity: intentionConfig.ritualIntensity,
            certificate_seed: intentionConfig.certificateSeed,
            created_at: createdAt
          });

          if (intentionInsertError) {
            console.warn('Intention imprint persistence failed.', intentionInsertError);
          }
        }

        const tasks = ['normalize_audio'];
        if (videoUrl) {
          tasks.push('transcode_video');
        }
        fetch('/api/processing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compositionId: insertResult.data.id, tasks })
        }).catch(() => null);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DRAFT_KEY);
      }

      if (isPublic) {
        setStatus(
          wasTruncated
            ? tFrequencyCreatorStatus('savedPublicTruncated', {
                seconds: MAX_EXPORT_SECONDS
              })
            : tFrequencyCreatorStatus('savedPublicDiscover')
        );
      } else {
        setStatus(
          wasTruncated
            ? tFrequencyCreatorStatus('savedPrivateTruncated', {
                seconds: MAX_EXPORT_SECONDS
              })
            : tFrequencyCreatorStatus('savedPrivate')
        );
      }
    } catch (error) {
      console.error(error);
      const message =
        error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unknown error';
      if (message.includes('row-level security')) {
        setStatus(tFrequencyCreatorStatus('uploadBlockedByPolicy'));
      } else {
        setStatus(tFrequencyCreatorStatus('saveCompositionFailed'));
      }
    } finally {
      destinationAudioCapture?.disconnect();
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32 md:pb-14">
      <div className="grid gap-6 rounded-3xl bg-white/70 p-6 shadow-halo md:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">{tFrequencyCreator('ui.quickResonanceMode')}</h2>
          <p className="text-sm text-ink/70">
            {tFrequencyCreator('ui.quickResonanceDescription')}
          </p>
          {isGuest && !hasReachedFirstValue ? (
            <p className="rounded-2xl border border-ink/10 bg-white/82 px-3 py-2 text-xs text-ink/65">
              {tFrequencyCreator('ui.firstSessionHint')}
            </p>
          ) : null}
          <div className="rounded-2xl border border-ink/10 bg-white/82 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">{tFrequencyCreator('ui.activeFrequencyStack')}</p>
            <p className="mt-2 text-sm font-semibold text-ink/90">{selectedFrequencySummary}</p>
            <p className="mt-1 text-xs text-ink/60">
              {selectedFrequencies.length === 0
                ? tFrequencyCreator('ui.tapPresetToBegin')
                : tFrequencyCreator('ui.toneSelected', {
                    count: selectedFrequencies.length
                  })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handlePlay} disabled={mixedVoices.length === 0 || isSaving}>
                {isPlaying ? tFrequencyCreator('ui.stopNow') : tFrequencyCreator('ui.playNow')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!canAccessStudioControls) {
                    handleUnlockStudioControls();
                    return;
                  }
                  frequencyStackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {canAccessStudioControls ? tFrequencyCreator('ui.tuneFrequencies') : tFrequencyCreator('ui.unlockStudioControls')}
              </Button>
            </div>
          </div>
          {status ? <p className="text-sm text-ink/70">{status}</p> : null}
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/60">{tFrequencyCreator('ui.liveSessionControls')}</p>
            {isIOS ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {tFrequencyCreator('ui.iosTip')}
              </div>
            ) : null}
            {binauralConfig.enabled ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {tFrequencyCreator('ui.binauralTip')}
              </div>
            ) : null}
            {adaptiveJourneyConfig.enabled && !journeyHeadphonesConfirmed ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {tFrequencyCreator('ui.adaptiveHeadphonesTip')}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span>{tFrequencyCreator('ui.waveform')}</span>
                <select
                  value={waveform}
                  onChange={(event) => setWaveform(event.target.value as typeof waveform)}
                  className="rounded-full border border-ink/10 bg-white px-3 py-2"
                >
                  {WAVEFORMS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>{tFrequencyCreator('ui.mixStyle')}</span>
                <select
                  value={mixStyle}
                  onChange={(event) => setMixStyle(event.target.value as MixStyle)}
                  className="rounded-full border border-ink/10 bg-white px-3 py-2"
                >
                  {MIX_STYLES.map((option) => (
                    <option key={option} value={option}>
                      {mixStyleLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              <p
                className={
                  mixStyle === 'golden432'
                    ? 'rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700'
                    : 'rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700'
                }
              >
                {mixStyle === 'golden432'
                  ? tFrequencyCreator('mixStyles.golden432Description')
                  : tFrequencyCreator('mixStyles.manualDescription')}
              </p>
              <label className="flex items-center justify-between gap-3">
                <span>{tFrequencyCreator('ui.visualization')}</span>
                <select
                  value={visualizationType}
                  onChange={(event) => setVisualizationType(event.target.value as VisualizerType)}
                  className="rounded-full border border-ink/10 bg-white px-3 py-2"
                >
                  {VISUALIZATION_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>{tFrequencyCreator('ui.ambientLayer')}</span>
                <select
                  value={ambientSound}
                  onChange={(event) => setAmbientSound(event.target.value as typeof ambientSound)}
                  className="rounded-full border border-ink/10 bg-white px-3 py-2"
                >
                  {AMBIENT_SOUNDS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>{tFrequencyCreator('ui.durationSec')}</span>
                <input
                  type="number"
                  min={60}
                  max={MAX_EXPORT_SECONDS}
                  value={duration}
                  onChange={(event) => setDuration(clamp(60, Number(event.target.value), MAX_EXPORT_SECONDS))}
                  className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                />
              </label>
              <p className="text-xs text-ink/55">
                {tFrequencyCreator('ui.exportsLimitNotice', {
                  seconds: MAX_EXPORT_SECONDS
                })}
              </p>
              <label className="flex items-center justify-between gap-3">
                <span>{tFrequencyCreator('ui.masterVolume')}</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-40"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
        <button
          type="button"
          onClick={() => setShowPublishingTools((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 text-left"
          aria-expanded={showPublishingTools}
          aria-controls="publishing-tools"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-ink/55">{tFrequencyCreator('ui.publishingTools')}</p>
            <p className="mt-1 text-sm text-ink/70">
              {showPublishingTools
                ? tFrequencyCreator('ui.publishingExpandedDescription')
                : tFrequencyCreator('ui.publishingCollapsedDescription')}
            </p>
          </div>
          <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">
            {showPublishingTools ? tFrequencyCreator('ui.hide') : tFrequencyCreator('ui.show')}
          </span>
        </button>

        {showPublishingTools ? (
          <div id="publishing-tools" ref={publishingToolsRef} className="mt-4 space-y-4">
            {!userId ? (
              <div className="rounded-3xl border border-ink/10 bg-white/82 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.guestPublishingTitle')}</p>
                <p className="mt-2 text-sm text-ink/72">{tFrequencyCreator('ui.guestPublishingDescription')}</p>
                <ul className="mt-3 space-y-1 text-xs text-ink/65">
                  <li>{tFrequencyCreator('ui.guestPublishingBenefitSave')}</li>
                  <li>{tFrequencyCreator('ui.guestPublishingBenefitAdvanced')}</li>
                  <li>{tFrequencyCreator('ui.guestPublishingBenefitPublish')}</li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link
                      href={buildAuthHref('login', 'publishing')}
                      onClick={() => handleAuthCtaClick('guest_publishing', 'sign_in', 'publishing')}
                    >
                      {tFrequencyCreator('ui.signInToSave')}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={buildAuthHref('signup', 'publishing')}
                      onClick={() => handleAuthCtaClick('guest_publishing', 'sign_up', 'publishing')}
                    >
                      {tFrequencyCreator('ui.createAccount')}
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-xs text-ink/58">{tFrequencyCreator('ui.localDraftNotice')}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  <label className="text-xs uppercase tracking-[0.3em] text-ink/60">{tFrequencyCreator('ui.title')}</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
                  />
                  <label className="text-xs uppercase tracking-[0.3em] text-ink/60">{tFrequencyCreator('ui.description')}</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-[90px] w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
                  />
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2">
                    <span>{tFrequencyCreator('ui.exportFormat')}</span>
                    <select
                      value={audioFormat}
                      onChange={(event) => setAudioFormat(event.target.value as typeof audioFormat)}
                      className="rounded-full border border-ink/10 bg-white px-3 py-2"
                    >
                      {AUDIO_FORMATS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2">
                    <span>{tFrequencyCreator('ui.captureVideo')}</span>
                    <input
                      type="checkbox"
                      checked={includeVideo}
                      onChange={(event) => setIncludeVideo(event.target.checked)}
                      disabled={isIOS}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2">
                    <span>{tFrequencyCreator('ui.publicShare')}</span>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(event) => setIsPublic(event.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleSave} disabled={!isPlaying || isSaving}>
                      {isSaving ? tFrequencyCreator('ui.saving') : tFrequencyCreator('ui.saveAndShare')}
                    </Button>
                  </div>
                </div>
                {showMp3Warning ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {tFrequencyCreator('ui.mp3Warning', {
                      seconds: mp3LimitSeconds
                    })}
                  </p>
                ) : null}
                {includeVideo ? (
                  <p className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                    {tFrequencyCreator('ui.videoExport50mbNote')}
                  </p>
                ) : null}
                {savedCompositionId ? (
                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-ink/85">{tFrequencyCreator('ui.sessionSaved')}</p>
                    <p className="mt-1 text-xs text-ink/60">
                      {savedCompositionPublic
                        ? tFrequencyCreator('ui.savedPublicShareHint')
                        : tFrequencyCreator('ui.savedPrivateHint')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={savedCompositionPath ?? '/discover'}>{tFrequencyCreator('ui.openComposition')}</Link>
                      </Button>
                      {savedCompositionPublic ? (
                        <>
                          <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                            {tFrequencyCreator('ui.copyLink')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleNativeShare}>
                            {tFrequencyCreator('ui.share')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCopyEmbedCode}>
                            {tFrequencyCreator('ui.copyEmbed')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleSocialShare('x')}>
                            X
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleSocialShare('facebook')}>
                            Facebook
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleSocialShare('linkedin')}>
                            LinkedIn
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {savedCompositionUrl ? <p className="mt-3 text-xs text-ink/55">{savedCompositionUrl}</p> : null}
                    {shareStatus ? <p className="mt-2 text-xs text-ink/65">{shareStatus}</p> : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {canAccessStudioControls ? (
            <div ref={frequencyStackRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
              <h3 className="text-lg font-semibold">{tFrequencyCreator('ui.selectedFrequencies')}</h3>
              <p className="text-xs text-ink/60">
                {tFrequencyCreator('ui.selectedFrequenciesDescription', {
                  min: MIN_CUSTOM_FREQUENCY_HZ,
                  max: roundedActiveFrequencyMaxHz
                })}
              </p>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-ink/70">
                <input
                  type="checkbox"
                  checked={advancedFrequencyMode}
                  onChange={(event) => handleAdvancedFrequencyModeChange(event.target.checked)}
                  className="h-4 w-4"
                />
                <span>{tFrequencyCreator('ui.enableAdvancedFrequencyRange')}</span>
                <span className="text-ink/55">
                  {tFrequencyCreator('ui.advancedFrequencyRangeHint', {
                    max: Math.round(advancedFrequencyMaxHz)
                  })}
                </span>
              </label>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-ink/60">
                  {tFrequencyCreator('ui.customHz')}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => nudgeCustomFrequency(-1)}
                      className="h-9 w-9 rounded-full border border-ink/15 bg-white text-lg leading-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={MIN_CUSTOM_FREQUENCY_HZ}
                      max={roundedActiveFrequencyMaxHz}
                      step={0.1}
                      value={customFrequencyInput}
                      onChange={(event) => setCustomFrequencyInput(event.target.value)}
                      className="w-32 rounded-full border border-ink/10 bg-white px-3 py-2 text-sm"
                      placeholder={tFrequencyCreator('ui.customFrequencyPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => nudgeCustomFrequency(1)}
                      className="h-9 w-9 rounded-full border border-ink/15 bg-white text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </label>
                <Button size="sm" onClick={addCustomFrequency}>
                  {tFrequencyCreator('ui.addFrequency')}
                </Button>
                <Button size="sm" variant="outline" onClick={addHarmonics}>
                  {tFrequencyCreator('ui.addHarmonics')}
                </Button>
              </div>
              {customFrequencyInput.trim().length > 0 && !customFrequencyValid ? (
                <p className="mt-2 text-xs text-rose-600">
                  {tFrequencyCreator('ui.frequencyRangeValidation', {
                    min: MIN_CUSTOM_FREQUENCY_HZ,
                    max: roundedActiveFrequencyMaxHz
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-3xl border border-ink/10 bg-white/82 p-4">
              <h3 className="text-lg font-semibold">{tFrequencyCreator('ui.studioControlsTitle')}</h3>
              <p className="mt-2 text-sm text-ink/70">{tFrequencyCreator('ui.studioControlsDescription')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleUnlockStudioControls('manual')}>
                  {tFrequencyCreator('ui.unlockStudioControls')}
                </Button>
                <Button size="sm" variant="outline" onClick={handlePlay} disabled={mixedVoices.length === 0 || isSaving}>
                  {isPlaying ? tFrequencyCreator('ui.stopNow') : tFrequencyCreator('ui.playNow')}
                </Button>
              </div>
            </div>
          )}

          {canUseAdvancedModules ? (
            <>
              <div ref={voiceBioprintRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{tFrequencyCreator('ui.voiceBioprintBeta')}</h3>
                    <p className="text-xs text-ink/60">
                      {tFrequencyCreator('ui.voiceBioprintDescription')}
                    </p>
                  </div>
                  <HelpPopover
                    align="left"
                    label={tFrequencyCreator('help.voiceBioprintLabel')}
                    text={tFrequencyCreator('help.voiceBioprintText')}
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {tFrequencyCreator('ui.voiceBioprintNotice')}
                </div>

                <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2 text-sm text-ink/70">
                  <span>{tFrequencyCreator('ui.voiceBioprintDisclaimerCheckbox')}</span>
                  <input
                    type="checkbox"
                    checked={voiceBioprintConfig.disclaimerAccepted}
                    onChange={(event) =>
                      setVoiceBioprintConfig((prev) => ({
                        ...prev,
                        disclaimerAccepted: event.target.checked
                      }))
                    }
                    className="h-4 w-4"
                  />
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handleCaptureVoiceBioprint}
                    disabled={isCapturingVoice || !voiceBioprintConfig.disclaimerAccepted}
                  >
                    {isCapturingVoice ? tFrequencyCreator('ui.capturing') : tFrequencyCreator('ui.captureVoiceProfile')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleUseStarterBioprintProfile} disabled={isCapturingVoice}>
                    {tFrequencyCreator('ui.useStarterProfile')}
                  </Button>
                </div>

                {voiceCaptureError ? <p className="mt-2 text-xs text-rose-600">{voiceCaptureError}</p> : null}
                {voiceTelemetry ? (
                  <p className="mt-2 text-xs text-ink/55">
                    {tFrequencyCreator('ui.voiceTelemetry', {
                      captureMs: voiceTelemetry.captureMs,
                      analysisMs: voiceTelemetry.analysisMs,
                      frameCount: voiceTelemetry.frameCount
                    })}
                  </p>
                ) : null}

                <div className="mt-3">
                  <VoicePortraitCard
                    profile={voiceProfile}
                    recommendations={voiceBioprintConfig.recommendations}
                    onApply={handleApplyVoiceRecommendations}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div ref={sympatheticResonanceRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{tFrequencyCreator('ui.sympatheticResonanceTitle')}</h3>
                    <p className="text-xs text-ink/60">
                      {tFrequencyCreator('ui.sympatheticResonanceDescription')}
                    </p>
                  </div>
                  <HelpPopover
                    align="left"
                    label={tFrequencyCreator('help.roomTunerLabel')}
                    text={tFrequencyCreator('help.roomTunerText')}
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {tFrequencyCreator('ui.cleanseExperimentalNotice')}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/85 px-3 py-2 text-sm text-ink/70">
                    <span>{tFrequencyCreator('ui.enableRoomTuner')}</span>
                    <input
                      type="checkbox"
                      checked={sympatheticConfig.enabled}
                      onChange={(event) =>
                        setSympatheticConfig((prev) => ({
                          ...prev,
                          enabled: event.target.checked
                        }))
                      }
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/85 px-3 py-2 text-sm text-ink/70">
                    <span>{tFrequencyCreator('ui.mode')}</span>
                    <select
                      value={sympatheticConfig.mode}
                      onChange={(event) =>
                        setSympatheticConfig((prev) => ({
                          ...prev,
                          mode: event.target.value as SympatheticResonanceMode
                        }))
                      }
                      className="rounded-full border border-ink/10 bg-white px-3 py-2"
                    >
                      <option value="harmonize">{tFrequencyCreator('ui.harmonize')}</option>
                      <option value="cleanse">{tFrequencyCreator('ui.cleanseExperimental')}</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/85 px-3 py-2 text-sm text-ink/70">
                    <span>{tFrequencyCreator('ui.scanInterval')}</span>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={sympatheticConfig.scanIntervalSeconds}
                      onChange={(event) =>
                        setSympatheticConfig((prev) => ({
                          ...prev,
                          scanIntervalSeconds: clamp(2, Number(event.target.value), 30)
                        }))
                      }
                      className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/85 px-3 py-2 text-sm text-ink/70">
                    <span>{tFrequencyCreator('ui.confidenceThreshold')}</span>
                    <input
                      type="number"
                      min={0.05}
                      max={0.95}
                      step={0.01}
                      value={sympatheticConfig.confidenceThreshold}
                      onChange={(event) =>
                        setSympatheticConfig((prev) => ({
                          ...prev,
                          confidenceThreshold: clamp(0.05, Number(event.target.value), 0.95)
                        }))
                      }
                      className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleCalibrateRoom} disabled={isCalibratingRoom}>
                    {isCalibratingRoom ? tFrequencyCreator('ui.calibrating') : tFrequencyCreator('ui.calibrateRoom')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleScanRoomNow} disabled={isCalibratingRoom}>
                    {tFrequencyCreator('ui.scanNow')}
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-ink/10 bg-white/85 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.monitor')}</p>
                    <p className="mt-1 text-sm font-semibold text-ink/85">
                      {sympatheticConfig.enabled && isRoomMonitoring
                        ? tFrequencyCreator('ui.active')
                        : tFrequencyCreator('ui.idle')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white/85 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.confidence')}</p>
                    <p className="mt-1 text-sm font-semibold text-ink/85">
                      {roomScanResult ? `${Math.round(roomScanResult.confidence * 100)}%` : `${Math.round(sympatheticConfig.lastConfidence * 100)}%`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white/85 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.calibratedNoiseFloor')}</p>
                    <p className="mt-1 text-sm font-semibold text-ink/85">
                      {typeof sympatheticConfig.calibratedNoiseFloorDb === 'number'
                        ? `${sympatheticConfig.calibratedNoiseFloorDb.toFixed(1)} dB`
                        : tFrequencyCreator('ui.notCalibrated')}
                    </p>
                  </div>
                </div>

                {roomScanStatus ? <p className="mt-2 text-xs text-ink/60">{roomScanStatus}</p> : null}
                <p className="mt-2 text-xs text-ink/55">
                  {tFrequencyCreator('ui.dominantRoomTones')}{' '}
                  {roomScanResult?.dominantFrequencies.length
                    ? roomScanResult.dominantFrequencies.map((value) => `${Math.round(value)}Hz`).join(', ')
                    : sympatheticConfig.lastDominantFrequencies.map((value) => `${Math.round(value)}Hz`).join(', ') ||
                      tFrequencyCreator('ui.noneYet')}
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  {tFrequencyCreator('ui.responseTones')}{' '}
                  {roomResponseFrequencies.length > 0
                    ? roomResponseFrequencies.slice(0, 8).map((value) => `${Math.round(value)}Hz`).join(', ')
                    : tFrequencyCreator('ui.noneYet')}
                </p>

                <div className="mt-3">
                  <RoomFrequencyMap levels={roomScanResult?.spectrumMap ?? []} />
                </div>
              </div>
            </>
          ) : shouldShowAdvancedPreviews ? (
            <div className="rounded-3xl border border-ink/10 bg-white/82 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/55">{tFrequencyCreator('ui.advancedPreviewTitle')}</p>
              <p className="mt-2 text-sm text-ink/70">{tFrequencyCreator('ui.advancedPreviewDescription')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {advancedFeaturePreviews.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handlePromptSignIn('advanced_preview_card', item.key)}
                    className="rounded-2xl border border-ink/10 bg-white px-3 py-3 text-left transition hover:border-ink/25"
                  >
                    <p className="text-sm font-semibold text-ink/85">{item.title}</p>
                    <p className="mt-1 text-xs text-ink/62 line-clamp-3">{item.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <Link
                    href={buildAuthHref('login', 'advanced_tools')}
                    onClick={() => handleAuthCtaClick('advanced_preview', 'sign_in', 'advanced_tools')}
                  >
                    {tFrequencyCreator('ui.advancedPreviewCta')}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={buildAuthHref('signup', 'advanced_tools')}
                    onClick={() => handleAuthCtaClick('advanced_preview', 'sign_up', 'advanced_tools')}
                  >
                    {tFrequencyCreator('ui.createAccount')}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {PRESET_FREQUENCIES.map((freq) => (
              <button
                key={freq.id}
                onClick={() => toggleFrequency(freq.hz)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedFrequencies.includes(freq.hz)
                    ? 'border-transparent bg-white shadow-glow'
                    : 'border-ink/10 bg-white/70 hover:border-ink/30'
                }`}
                style={{ boxShadow: selectedFrequencies.includes(freq.hz) ? `0 0 0 2px ${freq.color}` : undefined }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{localizedPresetMap[freq.id]?.name ?? freq.name}</span>
                  <span className="text-xs text-ink/60">{freq.hz} Hz</span>
                </div>
                <p className="mt-2 text-xs text-ink/60">
                  {localizedPresetMap[freq.id]?.intention ?? freq.intention}
                </p>
              </button>
            ))}
          </div>

          {canAccessStudioControls ? (
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                  {tFrequencyCreator('ui.frequencyStack', {
                    selected: selectedFrequencies.length,
                    max: maxSelectableFrequencies
                  })}
                </h4>
                <HelpPopover
                  align="left"
                  label={tFrequencyCreator('help.frequencyStackLabel')}
                  text={tFrequencyCreator('help.frequencyStackText')}
                />
              </div>
            </div>
            {selectedFrequencies.length === 0 ? (
              <p className="text-sm text-ink/60">{tFrequencyCreator('ui.noFrequenciesSelected')}</p>
            ) : (
              <div className="space-y-3">
                {selectedFrequencies.map((frequency) => {
                  const key = frequencyKeyForCurrentRange(frequency);
                  const gain = frequencyVolumes[key] ?? 1;
                  return (
                    <div key={key} className="rounded-2xl border border-ink/10 bg-white px-3 py-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{frequency.toFixed(2)} Hz</span>
                        <button
                          type="button"
                          onClick={() => toggleFrequency(frequency)}
                          className="text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-ink"
                        >
                          {tFrequencyCreator('ui.remove')}
                        </button>
                      </div>
                      <label className="flex items-center justify-between gap-3 text-xs text-ink/60">
                        <span>{tFrequencyCreator('ui.volume')}</span>
                        <input
                          type="range"
                          min={0.05}
                          max={1}
                          step={0.01}
                          value={gain}
                          onChange={(event) => setFrequencyGain(frequency, Number(event.target.value))}
                          className="w-40"
                        />
                        <span className="w-10 text-right">{Math.round(gain * 100)}%</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          ) : null}

          {canUseAdvancedModules ? (
            <div ref={advancedSoundRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <button
              type="button"
              onClick={() => setShowAdvancedSoundTools((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={showAdvancedSoundTools}
              aria-controls="advanced-sound-tools"
            >
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                  {tFrequencyCreator('ui.advancedSoundTools')}
                </h4>
                <p className="mt-1 text-xs text-ink/65">
                  {tFrequencyCreator('ui.advancedSoundDescription')}
                </p>
              </div>
              <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">
                {showAdvancedSoundTools ? tFrequencyCreator('ui.hide') : tFrequencyCreator('ui.show')}
              </span>
            </button>
            <p className="mt-3 text-xs text-ink/60">
              {isCompactViewport ? tFrequencyCreator('ui.mobileHiddenByDefault') : tFrequencyCreator('ui.readyForDeepShaping')}{' '}
              {advancedSoundSummary}
            </p>

            {showAdvancedSoundTools ? (
              <div id="advanced-sound-tools" className="mt-4 space-y-4">
                <div ref={adaptiveJourneyRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                        {tFrequencyCreator('ui.rhythmPattern')}
                      </h4>
                      <HelpPopover
                        align="left"
                        label={tFrequencyCreator('help.rhythmPatternLabel')}
                        text={tFrequencyCreator('help.rhythmPatternText')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-ink/70">
                        <span>{tFrequencyCreator('ui.enable')}</span>
                        <input
                          type="checkbox"
                          checked={rhythmConfig.enabled}
                          onChange={(event) =>
                            setRhythmConfig((prev) => ({
                              ...prev,
                              enabled: event.target.checked
                            }))
                          }
                          className="h-4 w-4"
                        />
                      </label>
                      <Button size="sm" variant="outline" onClick={randomizeRhythm}>
                        {tFrequencyCreator('ui.randomize')}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.bpm')}</span>
                      <input
                        type="number"
                        min={35}
                        max={180}
                        value={rhythmConfig.bpm}
                        onChange={(event) =>
                          setRhythmConfig((prev) => ({ ...prev, bpm: clamp(35, Number(event.target.value), 180) }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.subdivision')}</span>
                      <select
                        value={rhythmConfig.subdivision}
                        onChange={(event) =>
                          setRhythmConfig((prev) => ({
                            ...prev,
                            subdivision: event.target.value as RhythmConfig['subdivision']
                          }))
                        }
                        className="rounded-full border border-ink/10 bg-white px-3 py-2"
                      >
                        <option value="4n">4n</option>
                        <option value="8n">8n</option>
                        <option value="16n">16n</option>
                        <option value="8t">8t</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-8 gap-2">
                    {rhythmConfig.steps.map((step, index) => (
                      <button
                        key={`step-${index}`}
                        type="button"
                        onClick={() => toggleRhythmStep(index)}
                        className={`h-9 rounded-xl border text-xs ${
                          step ? 'border-lagoon bg-lagoon text-white' : 'border-ink/15 bg-white text-ink/50'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div ref={breathSyncRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                      {tFrequencyCreator('ui.modulationAndSweep')}
                    </h4>
                    <HelpPopover
                      align="left"
                      label={tFrequencyCreator('help.modulationSweepLabel')}
                      text={tFrequencyCreator('help.modulationSweepText')}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableLfo')}</span>
                      <input
                        type="checkbox"
                        checked={modulationConfig.enabled}
                        onChange={(event) =>
                          setModulationConfig((prev) => ({
                            ...prev,
                            enabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.lfoWaveform')}</span>
                      <select
                        value={modulationConfig.waveform}
                        onChange={(event) =>
                          setModulationConfig((prev) => ({
                            ...prev,
                            waveform: event.target.value as ModulationConfig['waveform']
                          }))
                        }
                        className="rounded-full border border-ink/10 bg-white px-3 py-2"
                      >
                        <option value="sine">sine</option>
                        <option value="triangle">triangle</option>
                        <option value="square">square</option>
                        <option value="sawtooth">sawtooth</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.rateHz')}</span>
                      <input
                        type="number"
                        min={0.01}
                        max={24}
                        step={0.01}
                        value={modulationConfig.rateHz}
                        onChange={(event) =>
                          setModulationConfig((prev) => ({
                            ...prev,
                            rateHz: clamp(0.01, Number(event.target.value), 24)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.depthHz')}</span>
                      <input
                        type="number"
                        min={0.1}
                        max={220}
                        step={0.1}
                        value={modulationConfig.depthHz}
                        onChange={(event) =>
                          setModulationConfig((prev) => ({
                            ...prev,
                            depthHz: clamp(0.1, Number(event.target.value), 220)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableSweep')}</span>
                      <input
                        type="checkbox"
                        checked={sweepConfig.enabled}
                        onChange={(event) =>
                          setSweepConfig((prev) => ({
                            ...prev,
                            enabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.curve')}</span>
                      <select
                        value={sweepConfig.curve}
                        onChange={(event) =>
                          setSweepConfig((prev) => ({
                            ...prev,
                            curve: event.target.value as SweepConfig['curve']
                          }))
                        }
                        className="rounded-full border border-ink/10 bg-white px-3 py-2"
                      >
                        <option value="linear">{tFrequencyCreator('ui.curveLinear')}</option>
                        <option value="easeInOut">{tFrequencyCreator('ui.curveEaseInOut')}</option>
                        <option value="exponential">{tFrequencyCreator('ui.curveExponential')}</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.targetHz')}</span>
                      <input
                        type="number"
                        min={MIN_CUSTOM_FREQUENCY_HZ}
                        max={roundedActiveFrequencyMaxHz}
                        value={sweepConfig.targetHz}
                        onChange={(event) =>
                          setSweepConfig((prev) => ({
                            ...prev,
                            targetHz: normalizeUserFrequency(Number(event.target.value))
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.durationSeconds')}</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={sweepConfig.durationSeconds}
                        onChange={(event) =>
                          setSweepConfig((prev) => ({
                            ...prev,
                            durationSeconds: clamp(1, Number(event.target.value), 180)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                  </div>
                </div>

                <div ref={intentionImprintRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                      {tFrequencyCreator('ui.binauralMode')}
                    </h4>
                    <HelpPopover
                      align="left"
                      label={tFrequencyCreator('help.binauralModeLabel')}
                      text={tFrequencyCreator('help.binauralModeText')}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableBinaural')}</span>
                      <input
                        type="checkbox"
                        checked={binauralConfig.enabled}
                        onChange={(event) =>
                          setBinauralConfig((prev) => ({
                            ...prev,
                            enabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.beatOffsetHz')}</span>
                      <input
                        type="number"
                        min={0.1}
                        max={40}
                        step={0.1}
                        value={binauralConfig.beatHz}
                        onChange={(event) =>
                          setBinauralConfig((prev) => ({
                            ...prev,
                            beatHz: clamp(0.1, Number(event.target.value), 40)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>{tFrequencyCreator('ui.stereoSpread')}</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={binauralConfig.panSpread}
                        onChange={(event) =>
                          setBinauralConfig((prev) => ({
                            ...prev,
                            panSpread: Number(event.target.value)
                          }))
                        }
                        className="w-40"
                      />
                      <span className="w-10 text-right text-xs">{Math.round(binauralConfig.panSpread * 100)}%</span>
                    </label>
                  </div>
                </div>

                <div ref={harmonicFieldRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                      {tFrequencyCreator('ui.adaptiveBinauralJourney')}
                    </h4>
                    <HelpPopover
                      align="left"
                      label={tFrequencyCreator('help.adaptiveJourneyLabel')}
                      text={tFrequencyCreator('help.adaptiveJourneyText')}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableJourney')}</span>
                      <input
                        type="checkbox"
                        checked={adaptiveJourneyConfig.enabled}
                        onChange={(event) =>
                          setAdaptiveJourneyConfig((prev) => ({
                            ...prev,
                            enabled: event.target.checked,
                            progress: event.target.checked ? prev.progress : 0
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.journeyIntent')}</span>
                      <select
                        value={adaptiveJourneyConfig.intent}
                        onChange={(event) => handleAdaptiveIntentChange(event.target.value as JourneyIntent)}
                        className="rounded-full border border-ink/10 bg-white px-3 py-2"
                      >
                        {journeyTemplates.map((template) => (
                          <option key={template.intent} value={template.intent}>
                            {journeyTemplateLabels[template.intent].title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.durationMinutes')}</span>
                      <input
                        type="number"
                        min={8}
                        max={60}
                        value={adaptiveJourneyConfig.durationMinutes}
                        onChange={(event) => handleAdaptiveDurationChange(Number(event.target.value))}
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.micAdaptation')}</span>
                      <input
                        type="checkbox"
                        checked={adaptiveJourneyConfig.micAdaptationEnabled}
                        onChange={(event) =>
                          setAdaptiveJourneyConfig((prev) => ({
                            ...prev,
                            micAdaptationEnabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>{tFrequencyCreator('ui.headphonesConfirmed')}</span>
                      <input
                        type="checkbox"
                        checked={journeyHeadphonesConfirmed}
                        onChange={(event) => setJourneyHeadphonesConfirmed(event.target.checked)}
                        className="h-4 w-4"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-ink/60">{journeyTemplateLabels[activeJourneyTemplate.intent].description}</p>
                  <p className="mt-1 text-xs text-ink/55">
                    {tFrequencyCreator('ui.statesLabel')}{' '}
                    {adaptiveJourneyConfig.steps.map((step) => `${step.state.toUpperCase()} ${step.beatHz}Hz`).join(' → ')}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.runtime')}</p>
                      <p className="mt-1">
                        {journeyRuntime
                          ? `${journeyRuntime.state.toUpperCase()} · ${journeyRuntime.beatHz.toFixed(2)}Hz · ${Math.round(
                              journeyRuntime.progress * 100
                            )}%`
                          : tFrequencyCreator('ui.journeyIdle')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.micAdaptation')}</p>
                      <p className="mt-1">
                        {adaptiveJourneyConfig.micAdaptationEnabled
                          ? isJourneyMicSampling
                            ? tFrequencyCreator('ui.sampling')
                            : tFrequencyCreator('ui.breathOffsetRuntime', {
                                breath:
                                  journeyRuntime?.breathBpm
                                    ? `${journeyRuntime.breathBpm.toFixed(1)} bpm`
                                    : tFrequencyCreator('ui.notAvailableCompact'),
                                offset: journeyRuntime?.adaptiveOffsetHz.toFixed(2) ?? '0.00'
                              })
                          : tFrequencyCreator('ui.off')}
                      </p>
                    </div>
                  </div>
                  {journeyStatus ? (
                    <p className="mt-2 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2 text-xs text-ink/65">
                      {journeyStatus}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                      {tFrequencyCreator('ui.breathSyncProtocol')}
                    </h4>
                    <HelpPopover
                      align="left"
                      label={tFrequencyCreator('help.breathSyncLabel')}
                      text={tFrequencyCreator('help.breathSyncText')}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableBreathSync')}</span>
                      <input
                        type="checkbox"
                        checked={breathSyncConfig.enabled}
                        onChange={(event) =>
                          setBreathSyncConfig((prev) => ({
                            ...prev,
                            enabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.mode')}</span>
                      <select
                        value={breathSyncConfig.mode}
                        onChange={(event) => handleBreathModeChange(event.target.value as BreathSyncMode)}
                        className="rounded-full border border-ink/10 bg-white px-3 py-2"
                      >
                        <option value="manual">{tFrequencyCreator('ui.manualPacing')}</option>
                        <option value="microphone">{tFrequencyCreator('ui.microphone')}</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.targetBpm')}</span>
                      <input
                        type="number"
                        min={3}
                        max={9}
                        step={0.1}
                        value={breathSyncConfig.targetBpm}
                        onChange={(event) =>
                          setBreathSyncConfig((prev) => ({
                            ...prev,
                            targetBpm: clamp(3, Number(event.target.value), 9)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.inhaleRatio')}</span>
                      <input
                        type="range"
                        min={0.25}
                        max={0.75}
                        step={0.01}
                        value={breathSyncConfig.inhaleRatio}
                        onChange={(event) =>
                          setBreathSyncConfig((prev) => ({
                            ...prev,
                            inhaleRatio: Number(event.target.value)
                          }))
                        }
                        className="w-36"
                      />
                      <span className="w-10 text-right text-xs">{Math.round(breathSyncConfig.inhaleRatio * 100)}%</span>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>{tFrequencyCreator('ui.sensitivity')}</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={breathSyncConfig.sensitivity}
                        onChange={(event) =>
                          setBreathSyncConfig((prev) => ({
                            ...prev,
                            sensitivity: Number(event.target.value)
                          }))
                        }
                        className="w-40"
                      />
                      <span className="w-10 text-right text-xs">{Math.round(breathSyncConfig.sensitivity * 100)}%</span>
                    </label>
                  </div>
                  {breathSyncConfig.mode === 'microphone' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCalibrateBreathSync}
                        disabled={isBreathCalibrating || isBreathMonitoring}
                      >
                        {isBreathCalibrating ? tFrequencyCreator('ui.calibrating') : tFrequencyCreator('ui.calibrateMic')}
                      </Button>
                      <p className="text-xs text-ink/55">
                        {typeof breathSyncConfig.calibrationNoiseFloorDb === 'number'
                          ? tFrequencyCreator('ui.noiseFloorDb', {
                              noiseFloor: breathSyncConfig.calibrationNoiseFloorDb.toFixed(1)
                            })
                          : tFrequencyCreator('ui.notCalibratedYet')}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.phase')}</p>
                      <p className="mt-1">
                        {breathRuntime
                          ? `${breathRuntime.phase.toUpperCase()} ${Math.round(breathRuntime.phaseProgress * 100)}%`
                          : tFrequencyCreator('ui.idle')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.breathRate')}</p>
                      <p className="mt-1">
                        {breathRuntime ? `${breathRuntime.breathBpm.toFixed(1)} bpm` : tFrequencyCreator('ui.notAvailableCompact')} · {tFrequencyCreator('ui.targetLabel')}{' '}
                        {breathSyncConfig.targetBpm.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.coherence')}</p>
                      <p className="mt-1">
                        {breathRuntime ? `${Math.round(breathRuntime.coherenceScore * 100)}%` : tFrequencyCreator('ui.notAvailableCompact')} ·{' '}
                        {isBreathMonitoring
                          ? tFrequencyCreator('ui.micSampling')
                          : breathSyncConfig.mode === 'manual'
                            ? tFrequencyCreator('ui.manualMode')
                            : tFrequencyCreator('ui.idle')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-ink/10 bg-white px-3 py-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink/55">
                      <span>{tFrequencyCreator('ui.breathGuide')}</span>
                      <span>{breathRuntime ? breathRuntime.phase.toUpperCase() : tFrequencyCreator('ui.idleUpper')}</span>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-ink/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          breathRuntime?.phase === 'inhale' ? 'bg-emerald-400/80' : 'bg-sky-400/80'
                        }`}
                        style={{ width: `${Math.round((breathRuntime?.phaseProgress ?? 0) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink/55">
                      {breathRuntime
                        ? tFrequencyCreator('ui.breathGuideInstruction', {
                            phaseInstruction:
                              breathRuntime.phase === 'inhale'
                                ? tFrequencyCreator('ui.inhaleAndExpand')
                                : tFrequencyCreator('ui.exhaleAndSoften')
                          })
                        : tFrequencyCreator('ui.startPlaybackForBreathPacing')}
                    </p>
                  </div>
                  {breathSyncStatus ? (
                    <p className="mt-2 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2 text-xs text-ink/65">
                      {breathSyncStatus}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                      {tFrequencyCreator('ui.quantumIntentionImprintExperimental')}
                    </h4>
                    <HelpPopover
                      align="left"
                      label={tFrequencyCreator('help.intentionImprintLabel')}
                      text={tFrequencyCreator('help.intentionImprintText')}
                    />
                  </div>
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {tFrequencyCreator('ui.intentionExperimentalNotice')}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableIntentionMode')}</span>
                      <input
                        type="checkbox"
                        checked={intentionConfig.enabled}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          if (checked && !intentionConfig.disclaimerAccepted) {
                            setIntentionStatus(tFrequencyCreatorStatus('acknowledgeDisclaimerBeforeEnablingIntention'));
                            openIntentionDisclaimer(true);
                            return;
                          }
                          setIntentionConfig((prev) => ({
                            ...prev,
                            enabled: checked
                          }));
                        }}
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.disclaimerAcknowledged')}</span>
                      <input
                        type="checkbox"
                        checked={intentionConfig.disclaimerAccepted}
                        onChange={(event) =>
                          setIntentionConfig((prev) => ({
                            ...prev,
                            disclaimerAccepted: event.target.checked,
                            enabled: event.target.checked ? prev.enabled : false
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.modulationRate')}</span>
                      <input
                        type="number"
                        min={0.05}
                        max={8}
                        step={0.01}
                        value={intentionConfig.modulationRateHz}
                        onChange={(event) =>
                          setIntentionConfig((prev) => ({
                            ...prev,
                            modulationRateHz: clamp(0.05, Number(event.target.value), 8)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.modulationDepth')}</span>
                      <input
                        type="number"
                        min={0.5}
                        max={60}
                        step={0.1}
                        value={intentionConfig.modulationDepthHz}
                        onChange={(event) =>
                          setIntentionConfig((prev) => ({
                            ...prev,
                            modulationDepthHz: clamp(0.5, Number(event.target.value), 60)
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>{tFrequencyCreator('ui.ritualIntensity')}</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={intentionConfig.ritualIntensity}
                        onChange={(event) =>
                          setIntentionConfig((prev) => ({
                            ...prev,
                            ritualIntensity: Number(event.target.value)
                          }))
                        }
                        className="w-44"
                      />
                      <span className="w-10 text-right text-xs">{Math.round(intentionConfig.ritualIntensity * 100)}%</span>
                    </label>
                  </div>
                  <label className="mt-3 block text-xs uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.intentionText')}</label>
                  <textarea
                    value={intentionConfig.intentionText}
                    onChange={(event) => {
                      const nextText = event.target.value.slice(0, 500);
                      setIntentionConfig((prev) => ({
                        ...prev,
                        intentionText: nextText
                      }));
                      setIntentionStatus(null);
                    }}
                    placeholder={tFrequencyCreator('ui.intentionPlaceholder')}
                    className="mt-2 min-h-[88px] w-full rounded-2xl border border-ink/10 bg-white px-3 py-3 text-sm"
                  />
                  <p className="mt-1 text-xs text-ink/55">
                    {tFrequencyCreator('ui.intentionCharacters', {
                      count: intentionConfig.intentionText.length
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleAnalyzeIntention}>
                      {tFrequencyCreator('ui.analyzeIntention')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleApplyIntentionMapping}
                      disabled={intentionConfig.mappedFrequencies.length === 0}
                    >
                      {tFrequencyCreator('ui.applyMappedTones')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCopyIntentionShare} disabled={!intentionShareText}>
                      {tFrequencyCreator('ui.copyShareText')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openIntentionDisclaimer(false)}
                    >
                      {tFrequencyCreator('ui.viewDisclaimer')}
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.confidence')}</p>
                      <p className="mt-1">{Math.round(intentionConfig.mappingConfidence * 100)}%</p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.seed')}</p>
                      <p className="mt-1">{intentionConfig.certificateSeed ?? tFrequencyCreator('ui.notGenerated')}</p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.mappedTones')}</p>
                      <p className="mt-1">{intentionConfig.mappedFrequencies.length}</p>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                      <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.lastImprint')}</p>
                      <p className="mt-1">
                        {intentionConfig.lastImprintedAt
                          ? new Date(intentionConfig.lastImprintedAt).toLocaleString()
                          : tFrequencyCreator('ui.notYet')}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink/60">
                    {tFrequencyCreator('ui.keywordsLabel')}{' '}
                    {intentionConfig.extractedKeywords.length > 0
                      ? intentionConfig.extractedKeywords.join(', ')
                      : tFrequencyCreator('ui.analyzeToExtractKeywords')}
                  </p>
                  <p className="mt-1 text-xs text-ink/60">
                    {tFrequencyCreator('ui.mappedFrequenciesLabel')}{' '}
                    {intentionConfig.mappedFrequencies.length > 0
                      ? intentionConfig.mappedFrequencies.map((value) => `${Math.round(value)}Hz`).join(' • ')
                      : tFrequencyCreator('ui.noneYet')}
                  </p>
                  <p className="mt-1 text-xs text-ink/55 break-words">
                    {tFrequencyCreator('ui.shareTextLabel')} {intentionShareText || tFrequencyCreator('ui.analyzeToGenerateShareText')}
                  </p>
                  {intentionStatus ? (
                    <p className="mt-2 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2 text-xs text-ink/65">
                      {intentionStatus}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                      {tFrequencyCreator('ui.solfeggioHarmonicField')}
                    </h4>
                    <HelpPopover
                      align="left"
                      label={tFrequencyCreator('help.harmonicFieldLabel')}
                      text={tFrequencyCreator('help.harmonicFieldText')}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.enableField')}</span>
                      <input
                        type="checkbox"
                        checked={harmonicFieldConfig.enabled}
                        onChange={(event) =>
                          setHarmonicFieldConfig((prev) => ({
                            ...prev,
                            enabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.preset')}</span>
                      <select
                        value={harmonicFieldConfig.presetId}
                        onChange={(event) =>
                          setHarmonicFieldConfig((prev) => ({
                            ...prev,
                            presetId: event.target.value
                          }))
                        }
                        className="rounded-full border border-ink/10 bg-white px-3 py-2"
                      >
                        {harmonicPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {harmonicPresetLabels[preset.id].name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>{tFrequencyCreator('ui.intensity')}</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={harmonicFieldConfig.intensity}
                        onChange={(event) =>
                          setHarmonicFieldConfig((prev) => ({
                            ...prev,
                            intensity: Number(event.target.value)
                          }))
                        }
                        className="w-44"
                      />
                      <span className="w-10 text-right text-xs">{Math.round(harmonicFieldConfig.intensity * 100)}%</span>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.interferenceLayer')}</span>
                      <input
                        type="checkbox"
                        checked={harmonicFieldConfig.includeInterference}
                        onChange={(event) =>
                          setHarmonicFieldConfig((prev) => ({
                            ...prev,
                            includeInterference: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{tFrequencyCreator('ui.spatialMotion')}</span>
                      <input
                        type="checkbox"
                        checked={harmonicFieldConfig.spatialMotionEnabled}
                        onChange={(event) =>
                          setHarmonicFieldConfig((prev) => ({
                            ...prev,
                            spatialMotionEnabled: event.target.checked
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2">
                      <span>{tFrequencyCreator('ui.motionSpeed')}</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={harmonicFieldConfig.motionSpeed}
                        disabled={!harmonicFieldConfig.spatialMotionEnabled}
                        onChange={(event) =>
                          setHarmonicFieldConfig((prev) => ({
                            ...prev,
                            motionSpeed: Number(event.target.value)
                          }))
                        }
                        className="w-44 disabled:opacity-45"
                      />
                      <span className="w-10 text-right text-xs">{Math.round(harmonicFieldConfig.motionSpeed * 100)}%</span>
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-ink/60">{harmonicPresetLabels[activeHarmonicPreset.id].description}</p>
                  <div className="mt-3 rounded-2xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
                    <p className="uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.liveField')}</p>
                    <p className="mt-1">
                      {tFrequencyCreator('ui.layersLabel')}{' '}
                      {harmonicFieldBundle.layerFrequencies.length > 0
                        ? harmonicFieldBundle.layerFrequencies.map((frequency) => `${Math.round(frequency)}Hz`).join(' • ')
                        : tFrequencyCreator('ui.none')}
                    </p>
                    <p className="mt-1">
                      {tFrequencyCreator('ui.interferenceLabel')}{' '}
                      {harmonicFieldBundle.interferenceFrequencies.length > 0
                        ? harmonicFieldBundle.interferenceFrequencies
                            .slice(0, 8)
                            .map((frequency) => `${frequency.toFixed(1)}Hz`)
                            .join(' • ')
                        : tFrequencyCreator('ui.off')}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    {tFrequencyCreator('ui.harmonicFieldTip')}
                  </p>
                </div>
              </div>
            ) : null}
            </div>
          ) : null}
        </div>

        <div ref={liveSectionRef} className="space-y-4 md:sticky md:top-28 md:self-start">
          <h3 className="text-lg font-semibold">{tFrequencyCreator('ui.liveVisualization')}</h3>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-white/78 px-3 py-2 text-xs text-ink/70">
            <span>{liveVisualizationEnabled ? tFrequencyCreator('ui.liveRenderingOn') : tFrequencyCreator('ui.liveRenderingPaused')}</span>
            <label className="flex items-center gap-2">
              <span>{tFrequencyCreator('ui.live')}</span>
              <input
                type="checkbox"
                checked={liveVisualizationEnabled}
                onChange={(event) => setLiveVisualizationEnabled(event.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>
          {visualizationType === 'orbital' ? (
            <ThreeVisualizer
              analyser={analyser}
              isActive={isPlaying && liveVisualizationEnabled}
              showSessionInfo={showSessionInfoOverlay}
              sessionInfo={sessionOverlayInfo}
              onCanvasReady={setVisualCanvas}
            />
          ) : (
            <WaveformVisualizer
              analyser={analyser}
              type={visualizationType}
              layers={effectiveVisualizationLayers}
              isActive={isPlaying && liveVisualizationEnabled}
              showSessionInfo={showSessionInfoOverlay}
              sessionInfo={sessionOverlayInfo}
              breathGuide={
                breathSyncConfig.enabled && isPlaying && breathRuntime
                  ? {
                      phase: breathRuntime.phase,
                      phaseProgress: breathRuntime.phaseProgress,
                      coherenceScore: breathRuntime.coherenceScore,
                      breathBpm: breathRuntime.breathBpm,
                      targetBpm: breathRuntime.targetBpm
                    }
                  : null
              }
              onCanvasReady={setVisualCanvas}
            />
          )}
          <p className="text-xs text-ink/60">
            {tFrequencyCreator('ui.visualsAudioReactiveNote')}
          </p>
          <p className="text-xs text-ink/55">
            {tFrequencyCreator('ui.globalBackgroundFollowsAudio')}
          </p>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/75 px-3 py-2 text-xs text-ink/70">
            <span>{tFrequencyCreator('ui.showSessionInfoOverlay')}</span>
            <input
              type="checkbox"
              checked={showSessionInfoOverlay}
              onChange={(event) => setShowSessionInfoOverlay(event.target.checked)}
              className="h-4 w-4"
            />
          </label>

          {visualizationType !== 'orbital' ? (
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">{tFrequencyCreator('ui.visualizationLayers')}</h4>
                  <HelpPopover
                    align="left"
                    label={tFrequencyCreator('help.visualizationLayersLabel')}
                    text={tFrequencyCreator('help.visualizationLayersText')}
                  />
                </div>
                {visualizationType === 'multi-layer' ? (
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <select
                      value={layerToAdd}
                      onChange={(event) => setLayerToAdd(event.target.value as BaseVisualizationType)}
                      className="min-w-0 flex-1 rounded-full border border-ink/10 bg-white px-2 py-1 text-xs sm:flex-none"
                    >
                      {BASE_LAYER_TYPES.map((type) => (
                        <option key={`layer-type-${type}`} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={addLayer}>
                      {tFrequencyCreator('ui.addLayer')}
                    </Button>
                  </div>
                ) : null}
              </div>

              {currentLayerEntries.length === 0 ? (
                <p className="text-sm text-ink/60">{tFrequencyCreator('ui.noLayersConfigured')}</p>
              ) : (
                <div className="space-y-3">
                  {currentLayerEntries.map((layer, index) => (
                    <div key={layer.id} className="rounded-2xl border border-ink/10 bg-white px-3 py-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-ink/60">
                        <span>{layer.type}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {visualizationType === 'multi-layer' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => moveLayer(layer.id, -1)}
                                disabled={index === 0}
                                className="rounded-full border border-ink/15 px-2 py-1 disabled:opacity-40"
                              >
                                {tFrequencyCreator('ui.up')}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLayer(layer.id, 1)}
                                disabled={index === currentLayerEntries.length - 1}
                                className="rounded-full border border-ink/15 px-2 py-1 disabled:opacity-40"
                              >
                                {tFrequencyCreator('ui.down')}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLayer(layer.id)}
                                className="rounded-full border border-rose-200 px-2 py-1 text-rose-600"
                              >
                                {tFrequencyCreator('ui.remove')}
                              </button>
                            </>
                          ) : null}
                          <label className="flex items-center gap-1 normal-case tracking-normal text-ink/70">
                            <span>{tFrequencyCreator('ui.on')}</span>
                            <input
                              type="checkbox"
                              checked={layer.enabled}
                              onChange={(event) => updateLayer(layer.id, { enabled: event.target.checked })}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-2 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                          <span>{tFrequencyCreator('ui.blend')}</span>
                          <select
                            value={layer.blendMode}
                            onChange={(event) =>
                              updateLayer(layer.id, {
                                blendMode: event.target.value as LayerBlendMode
                              })
                            }
                            className="w-full rounded-full border border-ink/10 bg-white px-2 py-1 sm:w-auto"
                          >
                            {BLEND_MODES.map((mode) => (
                              <option key={`${layer.id}-${mode}`} value={mode}>
                                {mode}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-2 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                          <span>{tFrequencyCreator('ui.opacity')}</span>
                          <input
                            type="range"
                            min={0.08}
                            max={1}
                            step={0.01}
                            value={layer.opacity}
                            onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value) })}
                            className="w-full sm:w-28"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                          <span>{tFrequencyCreator('ui.intensity')}</span>
                          <input
                            type="range"
                            min={0.1}
                            max={1.5}
                            step={0.01}
                            value={layer.intensity}
                            onChange={(event) => updateLayer(layer.id, { intensity: Number(event.target.value) })}
                            className="w-full sm:w-28"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                          <span>{tFrequencyCreator('ui.speed')}</span>
                          <input
                            type="range"
                            min={0.1}
                            max={2.5}
                            step={0.01}
                            value={layer.speed}
                            onChange={(event) => updateLayer(layer.id, { speed: Number(event.target.value) })}
                            className="w-full sm:w-28"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                          <span>{tFrequencyCreator('ui.scale')}</span>
                          <input
                            type="range"
                            min={0.35}
                            max={2}
                            step={0.01}
                            value={layer.scale}
                            onChange={(event) => updateLayer(layer.id, { scale: Number(event.target.value) })}
                            className="w-full sm:w-28"
                          />
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink/70 sm:grid-cols-3">
                        <label className="flex items-center justify-between gap-2 sm:justify-start">
                          <span>A</span>
                          <input
                            type="color"
                            value={layer.colorA}
                            onChange={(event) => updateLayer(layer.id, { colorA: event.target.value })}
                            className="h-8 w-full rounded border border-ink/10"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 sm:justify-start">
                          <span>B</span>
                          <input
                            type="color"
                            value={layer.colorB}
                            onChange={(event) => updateLayer(layer.id, { colorB: event.target.value })}
                            className="h-8 w-full rounded border border-ink/10"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 sm:justify-start">
                          <span>C</span>
                          <input
                            type="color"
                            value={layer.colorC}
                            onChange={(event) => updateLayer(layer.id, { colorC: event.target.value })}
                            className="h-8 w-full rounded border border-ink/10"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {isCompactViewport ? (
        showMobileLiveDock ? (
          <div className="fixed bottom-24 right-3 z-30 w-40 overflow-hidden rounded-2xl border border-white/25 bg-slate-950/65 shadow-2xl backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/80">
              <span>{tFrequencyCreator('ui.live')}</span>
              <button
                type="button"
                onClick={() => setShowMobileLiveDock(false)}
                className="rounded-full border border-white/25 px-2 py-0.5 text-[10px]"
              >
                {tFrequencyCreator('ui.hide')}
              </button>
            </div>
            <div className="relative aspect-square w-full overflow-hidden bg-black/30">
              <canvas ref={mobileLiveCanvasRef} className="h-full w-full" />
              {!liveVisualizationEnabled ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-2 text-center text-[10px] text-white/90">
                  {tFrequencyCreator('ui.livePaused')}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMobileLiveDock(true)}
            className="fixed bottom-24 right-3 z-30 rounded-full border border-white/30 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm md:hidden"
          >
            {tFrequencyCreator('ui.live')}
          </button>
        )
      ) : null}

      <div className="fixed bottom-3 left-3 right-3 z-40 md:left-auto md:right-6 md:w-[430px]">
        <div className="rounded-2xl border border-white/35 bg-white/88 px-3 py-3 shadow-[0_18px_34px_rgba(20,25,42,0.24)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-[0.2em] text-ink/55">{tFrequencyCreator('ui.nowTuned')}</p>
              <p className="truncate text-sm font-semibold text-ink/90">{selectedFrequencySummary}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePlay} disabled={mixedVoices.length === 0 || isSaving}>
                {isPlaying ? tFrequencyCreator('ui.stop') : tFrequencyCreator('ui.play')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLiveVisualizationEnabled((prev) => !prev)}
              >
                {liveVisualizationEnabled ? tFrequencyCreator('ui.liveOn') : tFrequencyCreator('ui.liveOff')}
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                if (!canAccessStudioControls) {
                  handleUnlockStudioControls('sticky');
                  return;
                }
                frequencyStackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              {canAccessStudioControls ? tFrequencyCreator('ui.frequencyStackShort') : tFrequencyCreator('ui.unlockStudioControls')}
            </button>
            <button
              type="button"
              onClick={() => liveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              {tFrequencyCreator('ui.liveVisualization')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canUseAdvancedModules) {
                  handlePromptSignIn('sticky_advanced', 'advanced_tools');
                  return;
                }
                setShowAdvancedSoundTools((prev) => !prev);
                advancedSoundRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              {canUseAdvancedModules
                ? showAdvancedSoundTools
                  ? tFrequencyCreator('ui.hideAdvancedAudio')
                  : tFrequencyCreator('ui.showAdvancedAudio')
                : tFrequencyCreator('ui.advancedPreviewCta')}
            </button>
            <button
              type="button"
              onClick={() => setShowPublishingTools((prev) => !prev)}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              {showPublishingTools ? tFrequencyCreator('ui.hidePublishing') : tFrequencyCreator('ui.openPublishing')}
            </button>
          </div>
        </div>
      </div>

      <Modal open={authModalOpen} onClose={() => setAuthModalOpen(false)} title={tFrequencyCreator('ui.saveYourSession')}>
        <p className="text-sm text-ink/70">
          {tFrequencyCreator('ui.saveSessionModalDescription')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link
              href={buildAuthHref('login', authModalFocus)}
              onClick={() => handleAuthCtaClick('auth_modal', 'sign_in', authModalFocus)}
            >
              {tFrequencyCreator('ui.signIn')}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              href={buildAuthHref('signup', authModalFocus)}
              onClick={() => handleAuthCtaClick('auth_modal', 'sign_up', authModalFocus)}
            >
              {tFrequencyCreator('ui.createAccount')}
            </Link>
          </Button>
        </div>
      </Modal>
      <Modal
        open={intentionDisclaimerModalOpen}
        onClose={() => {
          setIntentionDisclaimerModalOpen(false);
          setIntentionEnableOnAcknowledge(false);
        }}
        title={tFrequencyCreator('ui.quantumIntentionDisclaimer')}
      >
        <p className="text-sm text-ink/70">
          {tFrequencyCreator('ui.quantumIntentionDisclaimerDescription')}
        </p>
        <p className="mt-3 text-sm text-ink/70">
          {tFrequencyCreator('ui.quantumIntentionDisclaimerContinue')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="sm" onClick={handleAcknowledgeIntentionDisclaimer}>
            {tFrequencyCreator('ui.iUnderstand')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIntentionDisclaimerModalOpen(false);
              setIntentionEnableOnAcknowledge(false);
            }}
          >
            {tFrequencyCreator('ui.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
