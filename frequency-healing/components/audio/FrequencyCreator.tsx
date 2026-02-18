'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import HelpPopover from '@/components/ui/HelpPopover';
import Modal from '@/components/ui/Modal';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import ThreeVisualizer from '@/components/audio/ThreeVisualizer';
import VoicePortraitCard from '@/components/audio/VoicePortraitCard';
import type { VisualizationSessionOverlayData } from '@/components/audio/visualizationSessionOverlay';
import { useBackgroundAudioBridge } from '@/components/background/BackgroundAudioBridge';
import { FrequencyGenerator } from '@/lib/audio/FrequencyGenerator';
import { MicrophoneAnalysisService } from '@/lib/audio/MicrophoneAnalysisService';
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
  createDefaultAudioConfig,
  frequencyKey,
  MAX_CUSTOM_FREQUENCY_HZ,
  MIN_CUSTOM_FREQUENCY_HZ,
  normalizeFrequency,
  normalizeRhythmSteps,
  parseAudioConfig,
  type AudioConfigShape,
  type BinauralConfig,
  type ModulationConfig,
  type RhythmConfig,
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
const MIX_STYLE_LABELS: Record<MixStyle, string> = {
  manual: 'Direct',
  golden432: 'Golden'
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

function isValidFrequency(value: number) {
  return Number.isFinite(value) && value >= MIN_CUSTOM_FREQUENCY_HZ && value <= MAX_CUSTOM_FREQUENCY_HZ;
}

function dedupeFrequencies(values: number[]) {
  const set = new Set<number>();
  const output: number[] = [];

  for (const value of values) {
    const normalized = normalizeFrequency(value);
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
  const defaultAudioConfig = useMemo(() => createDefaultAudioConfig(), []);

  const [selectedFrequencies, setSelectedFrequencies] = useState<number[]>([]);
  const [frequencyVolumes, setFrequencyVolumes] = useState<Record<string, number>>({});
  const [customFrequencyInput, setCustomFrequencyInput] = useState('');
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
  const [liveVisualizationEnabled, setLiveVisualizationEnabled] = useState(true);
  const [showMobileLiveDock, setShowMobileLiveDock] = useState(true);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [title, setTitle] = useState('Untitled Session');
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
  const [voiceProfile, setVoiceProfile] = useState<VoiceBioprintProfile | null>(null);
  const [voiceProfileId, setVoiceProfileId] = useState<string | null>(null);
  const [isCapturingVoice, setIsCapturingVoice] = useState(false);
  const [voiceCaptureError, setVoiceCaptureError] = useState<string | null>(null);
  const [voiceTelemetry, setVoiceTelemetry] = useState<{
    captureMs: number;
    analysisMs: number;
    frameCount: number;
  } | null>(null);
  const frequencyStackRef = useRef<HTMLDivElement | null>(null);
  const advancedSoundRef = useRef<HTMLDivElement | null>(null);
  const liveSectionRef = useRef<HTMLDivElement | null>(null);
  const mobileLiveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mp3LimitSeconds = MP3_ESTIMATED_MAX_SECONDS;
  const showMp3Warning = audioFormat === 'mp3' && duration > mp3LimitSeconds;
  const maxSelectableFrequencies = mixStyle === 'golden432' ? MAX_PHASE2_FREQUENCIES : MAX_PHASE2_FREQUENCIES;

  const generator = useMemo(() => new FrequencyGenerator(), []);
  const micService = useMemo(() => new MicrophoneAnalysisService(), []);
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { setAnalyser: setBackgroundAnalyser } = useBackgroundAudioBridge();

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
        }
      }
    }),
    [audioConfig]
  );

  const customFrequencyValue = Number(customFrequencyInput);
  const customFrequencyValid =
    customFrequencyInput.trim().length > 0 && Number.isFinite(customFrequencyValue) && isValidFrequency(customFrequencyValue);

  const effectiveVisualizationLayers = useMemo(() => {
    if (visualizationType === 'multi-layer') {
      return visualizationLayers.length > 0 ? visualizationLayers : createDefaultVisualizationLayers();
    }

    if (visualizationType === 'orbital') {
      return [];
    }

    const layer = visualizationLayers.find((entry) => entry.type === visualizationType);
    return layer ? [layer] : createLayersForType(visualizationType);
  }, [visualizationLayers, visualizationType]);

  const selectedFrequencySummary = useMemo(() => {
    if (selectedFrequencies.length === 0) {
      return 'No tones selected';
    }

    const first = selectedFrequencies.slice(0, 3).map((value) => `${Math.round(value)}Hz`);
    const extra = selectedFrequencies.length - first.length;
    return `${first.join(' • ')}${extra > 0 ? ` +${extra}` : ''}`;
  }, [selectedFrequencies]);
  const savedCompositionPath = savedCompositionId ? `/composition/${savedCompositionId}` : null;
  const savedCompositionUrl = savedCompositionPath ? `${origin}${savedCompositionPath}` : null;
  const savedEmbedCode = useMemo(() => {
    if (!savedCompositionUrl) {
      return null;
    }
    return `<iframe src="${savedCompositionUrl}?embed=1" width="640" height="360" allow="autoplay" loading="lazy"></iframe>`;
  }, [savedCompositionUrl]);

  const advancedSoundSummary = useMemo(() => {
    const activeModules: string[] = [];
    if (rhythmConfig.enabled) {
      activeModules.push('Rhythm');
    }
    if (modulationConfig.enabled || sweepConfig.enabled) {
      activeModules.push('Mod/Sweep');
    }
    if (binauralConfig.enabled) {
      activeModules.push('Binaural');
    }

    if (activeModules.length === 0) {
      return 'All advanced modules are currently off.';
    }

    return `Active: ${activeModules.join(' • ')}`;
  }, [binauralConfig.enabled, modulationConfig.enabled, rhythmConfig.enabled, sweepConfig.enabled]);

  const sessionOverlayInfo = useMemo<VisualizationSessionOverlayData>(
    () => ({
      title,
      frequencies: selectedFrequencies.map((frequency) => ({
        frequency,
        gain: frequencyVolumes[frequencyKey(frequency)] ?? 1
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
      frequencyVolumes,
      mixStyle,
      modulationConfig,
      rhythmConfig,
      selectedFrequencies,
      sweepConfig,
      title,
      waveform
    ]
  );

  const mixedVoices = useMemo(
    () =>
      buildFrequencyMix({
        mixStyle,
        selectedFrequencies,
        waveform,
        volume,
        frequencyVolumes,
        binaural: binauralConfig
      }),
    [mixStyle, selectedFrequencies, waveform, volume, frequencyVolumes, binauralConfig]
  );

  useEffect(() => {
    return () => {
      generator.dispose();
      void micService.stop();
    };
  }, [generator, micService]);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setOrigin(window.location.origin);
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
    if (!isCompactViewport) {
      setShowAdvancedSoundTools(true);
    }
  }, [isCompactViewport]);

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
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return;
    }

    try {
      const draft = JSON.parse(raw) as Partial<DraftState>;
      if (draft.audioConfig) {
        const parsed = parseAudioConfig(draft.audioConfig);
        setSelectedFrequencies(dedupeFrequencies(parsed.selectedFrequencies));
        setFrequencyVolumes(parsed.frequencyVolumes);
        setRhythmConfig(parsed.rhythm);
        setModulationConfig(parsed.modulation);
        setSweepConfig(parsed.sweep);
        setBinauralConfig(parsed.binaural);
        setVoiceBioprintConfig(parsed.innovation.voiceBioprint);
        setVoiceProfileId(parsed.innovation.voiceBioprint.profileId);
      } else {
        if (draft.selectedFrequencies) {
          setSelectedFrequencies(dedupeFrequencies(draft.selectedFrequencies));
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

      selectedFrequencies.forEach((frequency) => {
        const key = frequencyKey(frequency);
        if (typeof next[key] !== 'number') {
          next[key] = 1;
          changed = true;
        }
      });

      for (const key of Object.keys(next)) {
        const value = Number(key);
        if (Number.isFinite(value) && !selectedFrequencies.includes(normalizeFrequency(value))) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [selectedFrequencies]);

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
      setStatus('Select at least one frequency.');
    }
  }, [generator, isPlaying, mixedVoices.length]);

  useEffect(() => {
    if (isPlaying) {
      generator.setAmbientLayer(ambientSound);
    }
  }, [ambientSound, generator, isPlaying]);

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
    const normalized = normalizeFrequency(hz);
    let inserted = false;

    setSelectedFrequencies((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      if (prev.length >= maxSelectableFrequencies) {
        setStatus(`You can stack up to ${maxSelectableFrequencies} frequencies in Phase 2 mode.`);
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
      [frequencyKey(normalized)]: clamp(0.05, defaultGain, 1)
    }));
  };

  const toggleFrequency = (hz: number) => {
    const normalized = normalizeFrequency(hz);
    const isSelected = selectedFrequencies.includes(normalized);

    if (isSelected) {
      setSelectedFrequencies((prev) => prev.filter((value) => value !== normalized));
      setFrequencyVolumes((prev) => {
        const next = { ...prev };
        delete next[frequencyKey(normalized)];
        return next;
      });
      return;
    }

    if (selectedFrequencies.length >= maxSelectableFrequencies) {
      setStatus(`You can stack up to ${maxSelectableFrequencies} frequencies in Phase 2 mode.`);
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
      [frequencyKey(normalized)]: prev[frequencyKey(normalized)] ?? 1
    }));
  };

  const addCustomFrequency = () => {
    if (!customFrequencyValid) {
      setStatus(`Enter a valid frequency between ${MIN_CUSTOM_FREQUENCY_HZ}Hz and ${MAX_CUSTOM_FREQUENCY_HZ}Hz.`);
      return;
    }

    addFrequency(customFrequencyValue);
    setCustomFrequencyInput('');
    setStatus(null);
  };

  const nudgeCustomFrequency = (direction: 1 | -1) => {
    const base = customFrequencyValid ? customFrequencyValue : 432;
    const next = normalizeFrequency(base + direction);
    setCustomFrequencyInput(String(next));
  };

  const addHarmonics = () => {
    if (selectedFrequencies.length === 0) {
      setStatus('Select a base frequency before adding harmonics.');
      return;
    }

    const snapshot = [...selectedFrequencies];
    let added = 0;

    snapshot.forEach((frequency) => {
      const harmonic2 = frequency * 2;
      const harmonic3 = frequency * 3;

      if (isValidFrequency(harmonic2)) {
        const normalized = normalizeFrequency(harmonic2);
        if (!selectedFrequencies.includes(normalized)) {
          addFrequency(normalized, 0.55);
          added += 1;
        }
      }

      if (isValidFrequency(harmonic3)) {
        const normalized = normalizeFrequency(harmonic3);
        if (!selectedFrequencies.includes(normalized)) {
          addFrequency(normalized, 0.35);
          added += 1;
        }
      }
    });

    if (added === 0) {
      setStatus('All available 2x and 3x harmonics are already present or out of range.');
      return;
    }

    setStatus(`Added ${added} harmonic tone${added > 1 ? 's' : ''}.`);
  };

  const setFrequencyGain = (hz: number, value: number) => {
    const key = frequencyKey(hz);
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
      setVoiceCaptureError('Please acknowledge the wellness disclaimer before recording.');
      return;
    }

    setIsCapturingVoice(true);
    setVoiceCaptureError(null);
    setStatus('Listening to your voice profile...');

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
        setVoiceCaptureError('Confidence is low. Try speaking closer to the mic in a quieter room.');
      } else {
        setVoiceCaptureError(null);
      }

      setStatus('Voice Bioprint captured. Review the recommendations below.');
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone access was denied. Use starter profile mode or allow mic access.'
          : 'Voice capture failed. Check microphone permission and try again.';
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
    setStatus('Starter Voice Bioprint profile loaded.');
  };

  const handleApplyVoiceRecommendations = () => {
    if (voiceBioprintConfig.recommendations.length === 0) {
      setStatus('Capture a voice profile first to generate recommendations.');
      return;
    }

    let added = 0;
    voiceBioprintConfig.recommendations.forEach((recommendation) => {
      const normalized = normalizeFrequency(recommendation.frequency);
      if (!selectedFrequencies.includes(normalized)) {
        added += 1;
      }
      addFrequency(recommendation.frequency, recommendation.gain);
    });

    if (added === 0) {
      setStatus('Recommended frequencies are already in your stack.');
      return;
    }

    setStatus(`Applied ${added} voice-bioprint recommendation${added > 1 ? 's' : ''}.`);
  };

  const currentLayerEntries = visualizationType === 'multi-layer' ? visualizationLayers : effectiveVisualizationLayers;

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
      setStatus('Select at least one frequency before playback.');
      return;
    }

    try {
      const shouldEnableBridge = isIOS || isIOSDevice() || isAndroidDevice();
      await generator.initialize(DEFAULT_EFFECTS, {
        enableAudioBridge: shouldEnableBridge
      });
      generator.setMasterVolume(volume);
      generator.setRhythmPattern(rhythmConfig);
      generator.setAutomation({ modulation: modulationConfig, sweep: sweepConfig });
      setAnalyser(generator.getAnalyser());
      setIsPlaying(true);
      setStatus(null);
    } catch (error) {
      console.error(error);
      setStatus('Audio could not start. Please tap Play again or check device settings.');
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
      setShareStatus('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('Share link copied.');
    } catch (error) {
      console.error(error);
      setShareStatus('Could not copy share link.');
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
        title: title.trim() || 'Healing Session',
        text: 'Listen to this healing frequency session.',
        url: shareUrl
      });
      setShareStatus('Shared.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error(error);
      setShareStatus('Share was canceled or unavailable.');
    }
  };

  const handleCopyEmbedCode = async () => {
    if (!savedEmbedCode) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setShareStatus('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(savedEmbedCode);
      setShareStatus('Embed code copied.');
    } catch (error) {
      console.error(error);
      setShareStatus('Could not copy embed code.');
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
    const encodedText = encodeURIComponent(`${title.trim() || 'Healing Session'} | Frequency Healing Studio`);
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
      setStatus('Press Play before saving so your current mix is captured.');
      return;
    }

    if (mixedVoices.length === 0) {
      setStatus('Select at least one frequency.');
      return;
    }

    if (audioFormat === 'mp3' && duration > mp3LimitSeconds) {
      setStatus(`MP3 export is limited to ${mp3LimitSeconds}s. Reduce duration or choose WAV.`);
      return;
    }

    if (!userId) {
      setStatus('Sign in to save your composition.');
      setAuthModalOpen(true);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const activeUserId = data.user?.id ?? userId;
    const activeUser = data.user ?? null;
    if (!activeUserId || !activeUser) {
      setStatus('Sign in to save your composition.');
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
      setStatus('We could not finish your profile setup. Please try again.');
      return;
    }

    setIsSaving(true);
    setStatus('Preparing your session...');
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
        setStatus('Video capture is not ready yet. Please try again in a moment.');
        return;
      }

      if (includeVideo) {
        try {
          destinationAudioCapture = createDestinationAudioCapture();
        } catch (error) {
          console.error(error);
          setStatus('Synchronized video capture is not supported in this browser. Try audio-only export.');
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

      setStatus(includeVideo ? 'Recording synchronized audio and video...' : 'Recording audio...');
      const exportResult = await exportAudio(exportDuration, audioFormat);
      const [videoBlob, thumbnailBlob] = await Promise.all([videoPromise, thumbnailPromise]);

      const slug = createSlug(title) || 'session';
      const timestamp = Date.now();
      const fileName = `${activeUserId}/${timestamp}-${slug}.${exportResult.extension}`;
      setStatus('Uploading audio...');
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
        setStatus('Video export is unavailable on this device. Saving audio only.');
      }

      if (videoBlob) {
        if (videoBlob.size > SUPABASE_OBJECT_LIMIT_BYTES) {
          const maxMb = Math.round(SUPABASE_OBJECT_LIMIT_BYTES / (1024 * 1024));
          const videoMb = (videoBlob.size / (1024 * 1024)).toFixed(1);
          setStatus(
            `Video export is ${videoMb}MB and exceeds your storage object limit (~${maxMb}MB). Saved audio only.`
          );
        } else {
          setStatus('Uploading video...');
          const videoExtension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
          const videoName = `${activeUserId}/${timestamp}-${slug}.${videoExtension}`;
          const { data: videoData, error: videoError } = await supabase.storage
            .from(VIDEO_BUCKET)
            .upload(videoName, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });

          if (videoError) {
            const message = videoError.message.toLowerCase();
            if (message.includes('maximum allowed size')) {
              const maxMb = Math.round(SUPABASE_OBJECT_LIMIT_BYTES / (1024 * 1024));
              setStatus(`Video file exceeded storage object limit (~${maxMb}MB). Saved audio only.`);
            } else {
              throw videoError;
            }
          } else {
            videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(videoData.path).data.publicUrl;
          }
        }
      }

      if (thumbnailBlob) {
        setStatus('Uploading thumbnail...');
        const thumbName = `${activeUserId}/${timestamp}-${slug}.png`;
        const { data: thumbData, error: thumbError } = await supabase.storage
          .from(THUMBNAIL_BUCKET)
          .upload(thumbName, thumbnailBlob, { contentType: 'image/png', upsert: true });

        if (thumbError) {
          throw thumbError;
        }

        thumbnailUrl = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(thumbData.path).data.publicUrl;
      }

      const frequenciesToStore = frequenciesForStorage(mixStyle, selectedFrequencies, mixedVoices);
      const frequencyVolumesPayload: Json = Object.fromEntries(
        selectedFrequencies.map((frequency) => {
          const key = frequencyKey(frequency);
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

      const insertPayload: CompositionInsert = {
        user_id: activeUserId,
        title: title.trim() || 'Untitled Session',
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
          }
        },
        innovation_flags: [voiceBioprintConfig.enabled ? 'voice_bioprint' : null].filter(
          (value): value is string => Boolean(value)
        ),
        scientific_disclaimer_ack: voiceBioprintConfig.disclaimerAccepted,
        voice_profile_id: voiceProfileId,
        visualization_type: visualizationType,
        visualization_config: { palette: 'ember-lagoon' },
        visualization_layers: toVisualizationLayersPayload(effectiveVisualizationLayers),
        audio_url: publicUrl,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        is_public: isPublic,
        tags: [ambientSound, binauralConfig.enabled ? 'binaural' : null, voiceBioprintConfig.enabled ? 'voice-bioprint' : null].filter(
          (tag): tag is string => Boolean(tag) && tag !== 'none'
        )
      };

      let insertResult = await supabase.from('compositions').insert(insertPayload).select('id').single();

      if (
        insertResult.error &&
        (insertResult.error.message.includes('audio_config') ||
          insertResult.error.message.includes('visualization_layers') ||
          insertResult.error.message.includes('innovation_config') ||
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
            ? `Saved! Your public composition is live. Export includes the first ${MAX_EXPORT_SECONDS}s.`
            : 'Saved! Your public composition is now available in Discover.'
        );
      } else {
        setStatus(
          wasTruncated
            ? `Saved as a private composition. Export includes the first ${MAX_EXPORT_SECONDS}s.`
            : 'Saved as a private composition.'
        );
      }
    } catch (error) {
      console.error(error);
      const message =
        error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unknown error';
      if (message.includes('row-level security')) {
        setStatus('Upload blocked by storage policy. Create storage buckets and RLS policies in Supabase.');
      } else {
        setStatus('Could not save the composition. Check Supabase storage bucket setup.');
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
          <h2 className="text-2xl font-semibold">Quick resonance mode</h2>
          <p className="text-sm text-ink/70">
            Start listening instantly, then refine only what you need. Publishing tools stay tucked away until you ask
            for them.
          </p>
          <div className="rounded-2xl border border-ink/10 bg-white/82 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/55">Active frequency stack</p>
            <p className="mt-2 text-sm font-semibold text-ink/90">{selectedFrequencySummary}</p>
            <p className="mt-1 text-xs text-ink/60">
              {selectedFrequencies.length === 0
                ? 'Tap a preset below to begin.'
                : `${selectedFrequencies.length} tone${selectedFrequencies.length > 1 ? 's' : ''} selected.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handlePlay} disabled={mixedVoices.length === 0 || isSaving}>
                {isPlaying ? 'Stop now' : 'Play now'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => frequencyStackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Tune frequencies
              </Button>
            </div>
          </div>
          {status ? <p className="text-sm text-ink/70">{status}</p> : null}
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/60">Live session controls</p>
            {isIOS ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                iOS tip: Tap Play once to unlock audio. If sound is muted, turn off the side silent switch.
              </div>
            ) : null}
            {binauralConfig.enabled ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Binaural mode is optimized for headphones and gentle listening environments.
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span>Waveform</span>
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
                <span>Mix style</span>
                <select
                  value={mixStyle}
                  onChange={(event) => setMixStyle(event.target.value as MixStyle)}
                  className="rounded-full border border-ink/10 bg-white px-3 py-2"
                >
                  {MIX_STYLES.map((option) => (
                    <option key={option} value={option}>
                      {MIX_STYLE_LABELS[option]}
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
                  ? 'Golden: expands each tone using a golden-ratio ladder for a fuller, immersive field.'
                  : 'Direct: plays only the exact frequencies you selected, with no extra ladder layers.'}
              </p>
              <label className="flex items-center justify-between gap-3">
                <span>Visualization</span>
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
                <span>Ambient layer</span>
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
                <span>Duration (sec)</span>
                <input
                  type="number"
                  min={60}
                  max={MAX_EXPORT_SECONDS}
                  value={duration}
                  onChange={(event) => setDuration(clamp(60, Number(event.target.value), MAX_EXPORT_SECONDS))}
                  className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                />
              </label>
              <p className="text-xs text-ink/55">Exports support up to {MAX_EXPORT_SECONDS}s (5 minutes).</p>
              <label className="flex items-center justify-between gap-3">
                <span>Master volume</span>
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
            <p className="text-xs uppercase tracking-[0.25em] text-ink/55">Publishing tools</p>
            <p className="mt-1 text-sm text-ink/70">
              {showPublishingTools
                ? 'Set title, export options, and sharing details.'
                : 'Open when you want to save, share, or sign in.'}
            </p>
          </div>
          <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">
            {showPublishingTools ? 'Hide' : 'Show'}
          </span>
        </button>

        {showPublishingTools ? (
          <div id="publishing-tools" className="mt-4 space-y-4">
            {!userId ? (
              <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                <p className="text-sm text-ink/70">
                  You are composing as a guest. Sign in whenever you want to save and publish this session.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link href="/login?redirectTo=/create">Sign in to save</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/signup?redirectTo=/discover">Create account</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
              />
              <label className="text-xs uppercase tracking-[0.3em] text-ink/60">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[90px] w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm"
              />
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2">
                <span>Export format</span>
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
                <span>Capture video</span>
                <input
                  type="checkbox"
                  checked={includeVideo}
                  onChange={(event) => setIncludeVideo(event.target.checked)}
                  disabled={isIOS}
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2">
                <span>Public share</span>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleSave} disabled={!isPlaying || isSaving}>
                  {isSaving ? 'Saving...' : 'Save & Share'}
                </Button>
              </div>
            </div>
            {showMp3Warning ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                MP3 export is optimized for shorter sessions (up to {mp3LimitSeconds}s). Reduce duration or choose WAV
                for longer renders.
              </p>
            ) : null}
            {includeVideo ? (
              <p className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                Video export is lmited to 50MB per file. MP4 is used when the
                browser supports MP4 recording; otherwise export falls back to WebM.
              </p>
            ) : null}
            {savedCompositionId ? (
              <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <p className="text-sm font-semibold text-ink/85">Session saved.</p>
                <p className="mt-1 text-xs text-ink/60">
                  {savedCompositionPublic
                    ? 'Share your public composition link, post it socially, or copy an embed snippet.'
                    : 'This composition is private. You can open it directly, but it will not appear in Discover.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={savedCompositionPath ?? '/discover'}>Open composition</Link>
                  </Button>
                  {savedCompositionPublic ? (
                    <>
                      <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                        Copy link
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleNativeShare}>
                        Share
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCopyEmbedCode}>
                        Copy embed
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
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div ref={frequencyStackRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <h3 className="text-lg font-semibold">Selected frequencies</h3>
            <p className="text-xs text-ink/60">
              Add arbitrary frequencies ({MIN_CUSTOM_FREQUENCY_HZ}-{MAX_CUSTOM_FREQUENCY_HZ}Hz), then use harmonics,
              modulation, and rhythm shaping.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-ink/60">
                Custom Hz
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
                    max={MAX_CUSTOM_FREQUENCY_HZ}
                    step={0.1}
                    value={customFrequencyInput}
                    onChange={(event) => setCustomFrequencyInput(event.target.value)}
                    className="w-32 rounded-full border border-ink/10 bg-white px-3 py-2 text-sm"
                    placeholder="e.g. 741"
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
                Add frequency
              </Button>
              <Button size="sm" variant="outline" onClick={addHarmonics}>
                Add 2x/3x harmonics
              </Button>
            </div>
            {customFrequencyInput.trim().length > 0 && !customFrequencyValid ? (
              <p className="mt-2 text-xs text-rose-600">
                Frequency must be between {MIN_CUSTOM_FREQUENCY_HZ}Hz and {MAX_CUSTOM_FREQUENCY_HZ}Hz.
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Voice Bioprint (beta)</h3>
                <p className="text-xs text-ink/60">
                  Record ~5 seconds, analyze your vocal spectrum, then auto-suggest supporting frequencies.
                </p>
              </div>
              <HelpPopover
                align="left"
                label="Voice Bioprint help"
                text="This is a wellness personalization tool and not a medical diagnostic system. Capture quality depends on room noise and mic quality."
              />
            </div>

            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Use for personal audio tuning only. Do not interpret this as medical advice, diagnosis, or treatment.
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2 text-sm text-ink/70">
              <span>I understand the Voice Bioprint wellness disclaimer</span>
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
                {isCapturingVoice ? 'Capturing...' : 'Capture voice profile'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleUseStarterBioprintProfile} disabled={isCapturingVoice}>
                Use starter profile
              </Button>
            </div>

            {voiceCaptureError ? <p className="mt-2 text-xs text-rose-600">{voiceCaptureError}</p> : null}
            {voiceTelemetry ? (
              <p className="mt-2 text-xs text-ink/55">
                Capture {voiceTelemetry.captureMs}ms, analysis {voiceTelemetry.analysisMs}ms, {voiceTelemetry.frameCount} frames.
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
                  <span className="text-sm font-semibold">{freq.name}</span>
                  <span className="text-xs text-ink/60">{freq.hz} Hz</span>
                </div>
                <p className="mt-2 text-xs text-ink/60">{freq.intention}</p>
              </button>
            ))}
          </div>

          <div ref={advancedSoundRef} className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Frequency stack ({selectedFrequencies.length}/{maxSelectableFrequencies})
                </h4>
                <HelpPopover
                  align="left"
                  label="Frequency stack help"
                  text="Your active tones live here. Each one has its own volume, and the stack is saved into audio config."
                />
              </div>
            </div>
            {selectedFrequencies.length === 0 ? (
              <p className="text-sm text-ink/60">No frequencies selected yet.</p>
            ) : (
              <div className="space-y-3">
                {selectedFrequencies.map((frequency) => {
                  const key = frequencyKey(frequency);
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
                          Remove
                        </button>
                      </div>
                      <label className="flex items-center justify-between gap-3 text-xs text-ink/60">
                        <span>Volume</span>
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

          <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <button
              type="button"
              onClick={() => setShowAdvancedSoundTools((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={showAdvancedSoundTools}
              aria-controls="advanced-sound-tools"
            >
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Advanced sound tools</h4>
                <p className="mt-1 text-xs text-ink/65">
                  Rhythm pattern, modulation + sweep, and binaural mode.
                </p>
              </div>
              <span className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">
                {showAdvancedSoundTools ? 'Hide' : 'Show'}
              </span>
            </button>
            <p className="mt-3 text-xs text-ink/60">
              {isCompactViewport ? 'Hidden by default on mobile for a calmer starter flow.' : 'Ready for deep session shaping.'}{' '}
              {advancedSoundSummary}
            </p>

            {showAdvancedSoundTools ? (
              <div id="advanced-sound-tools" className="mt-4 space-y-4">
                <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Rhythm pattern</h4>
                      <HelpPopover
                        align="left"
                        label="Rhythm pattern help"
                        text="The step grid gates sound on and off. BPM and subdivision control timing, and randomize creates a valid new pattern."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-ink/70">
                        <span>Enable</span>
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
                        Randomize
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>BPM</span>
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
                      <span>Subdivision</span>
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

                <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Modulation + sweep</h4>
                    <HelpPopover
                      align="left"
                      label="Modulation and sweep help"
                      text="LFO adds cyclic pitch movement. Sweep shifts tones toward a target frequency over a set duration and curve."
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Enable LFO</span>
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
                      <span>LFO waveform</span>
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
                      <span>Rate (Hz)</span>
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
                      <span>Depth (Hz)</span>
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
                      <span>Enable sweep</span>
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
                      <span>Curve</span>
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
                        <option value="linear">linear</option>
                        <option value="easeInOut">easeInOut</option>
                        <option value="exponential">exponential</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Target Hz</span>
                      <input
                        type="number"
                        min={MIN_CUSTOM_FREQUENCY_HZ}
                        max={MAX_CUSTOM_FREQUENCY_HZ}
                        value={sweepConfig.targetHz}
                        onChange={(event) =>
                          setSweepConfig((prev) => ({
                            ...prev,
                            targetHz: normalizeFrequency(Number(event.target.value))
                          }))
                        }
                        className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Duration (s)</span>
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

                <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Binaural mode</h4>
                    <HelpPopover
                      align="left"
                      label="Binaural mode help"
                      text="Binaural mode sends slightly different frequencies to left and right channels to create a perceived beat. Headphones are recommended."
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Enable binaural</span>
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
                      <span>Beat offset (Hz)</span>
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
                      <span>Stereo spread</span>
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
              </div>
            ) : null}
          </div>
        </div>

        <div ref={liveSectionRef} className="space-y-4 md:sticky md:top-28 md:self-start">
          <h3 className="text-lg font-semibold">Live visualization</h3>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-white/78 px-3 py-2 text-xs text-ink/70">
            <span>{liveVisualizationEnabled ? 'Live rendering on' : 'Live rendering paused'}</span>
            <label className="flex items-center gap-2">
              <span>Live</span>
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
              onCanvasReady={setVisualCanvas}
            />
          )}
          <p className="text-xs text-ink/60">
            Visuals are audio-reactive and auto-downgrade on constrained devices for stable frame times.
          </p>
          <p className="text-xs text-ink/55">
            The global background atmosphere also follows this audio energy while playback is running.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/75 px-3 py-2 text-xs text-ink/70">
            <span>Show session info overlay (preview + exports)</span>
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
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Visualization layers</h4>
                  <HelpPopover
                    align="left"
                    label="Visualization layers help"
                    text="Stack multiple visual renderers, reorder them, and blend with different modes. Each layer has its own color and motion controls."
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
                      Add layer
                    </Button>
                  </div>
                ) : null}
              </div>

              {currentLayerEntries.length === 0 ? (
                <p className="text-sm text-ink/60">No layers configured for this visual mode.</p>
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
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLayer(layer.id, 1)}
                                disabled={index === currentLayerEntries.length - 1}
                                className="rounded-full border border-ink/15 px-2 py-1 disabled:opacity-40"
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLayer(layer.id)}
                                className="rounded-full border border-rose-200 px-2 py-1 text-rose-600"
                              >
                                Remove
                              </button>
                            </>
                          ) : null}
                          <label className="flex items-center gap-1 normal-case tracking-normal text-ink/70">
                            <span>On</span>
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
                          <span>Blend</span>
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
                          <span>Opacity</span>
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
                          <span>Intensity</span>
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
                          <span>Speed</span>
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
                          <span>Scale</span>
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
              <span>Live</span>
              <button
                type="button"
                onClick={() => setShowMobileLiveDock(false)}
                className="rounded-full border border-white/25 px-2 py-0.5 text-[10px]"
              >
                Hide
              </button>
            </div>
            <div className="relative aspect-square w-full overflow-hidden bg-black/30">
              <canvas ref={mobileLiveCanvasRef} className="h-full w-full" />
              {!liveVisualizationEnabled ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-2 text-center text-[10px] text-white/90">
                  Live paused
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
            Live
          </button>
        )
      ) : null}

      <div className="fixed bottom-3 left-3 right-3 z-40 md:left-auto md:right-6 md:w-[430px]">
        <div className="rounded-2xl border border-white/35 bg-white/88 px-3 py-3 shadow-[0_18px_34px_rgba(20,25,42,0.24)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-[0.2em] text-ink/55">Now tuned</p>
              <p className="truncate text-sm font-semibold text-ink/90">{selectedFrequencySummary}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePlay} disabled={mixedVoices.length === 0 || isSaving}>
                {isPlaying ? 'Stop' : 'Play'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLiveVisualizationEnabled((prev) => !prev)}
              >
                {liveVisualizationEnabled ? 'Live on' : 'Live off'}
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => frequencyStackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              Frequency stack
            </button>
            <button
              type="button"
              onClick={() => liveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              Live visualization
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdvancedSoundTools((prev) => !prev);
                advancedSoundRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              {showAdvancedSoundTools ? 'Hide advanced audio' : 'Show advanced audio'}
            </button>
            <button
              type="button"
              onClick={() => setShowPublishingTools((prev) => !prev)}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-ink/70"
            >
              {showPublishingTools ? 'Hide publishing' : 'Open publishing'}
            </button>
          </div>
        </div>
      </div>

      <Modal open={authModalOpen} onClose={() => setAuthModalOpen(false)} title="Save your session">
        <p className="text-sm text-ink/70">
          Create a free account to save, publish, and revisit your healing compositions anytime. Your draft is stored
          locally so you can pick up right where you left off.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link href="/login?redirectTo=/create">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/signup?redirectTo=/discover">Create account</Link>
          </Button>
        </div>
      </Modal>
    </div>
  );
}
