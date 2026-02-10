'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import WaveformVisualizer, { type VisualizerType } from '@/components/audio/WaveformVisualizer';
import ThreeVisualizer from '@/components/audio/ThreeVisualizer';
import { FrequencyGenerator } from '@/lib/audio/FrequencyGenerator';
import { buildFrequencyMix, frequenciesForStorage, type MixStyle } from '@/lib/audio/mixProfiles';
import { exportAudio } from '@/lib/audio/AudioExporter';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import { createSupabaseClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';
import type { Json } from '@/lib/supabase/types';
import { captureVideo } from '@/lib/visualization/VideoCapture';
import { isIOSDevice } from '@/lib/utils/platform';
import {
  AMBIENT_SOUNDS,
  AUDIO_BUCKET,
  AUDIO_FORMATS,
  DEFAULT_DURATION,
  MAX_FREQUENCIES,
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
const MAX_EXPORT_SECONDS = 120;
const THUMBNAIL_WIDTH = 640;

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
  mixStyle: MixStyle;
  waveform: (typeof WAVEFORMS)[number];
  volume: number;
  duration: number;
  visualizationType: VisualizerType;
  ambientSound: (typeof AMBIENT_SOUNDS)[number];
  audioFormat: (typeof AUDIO_FORMATS)[number];
  includeVideo: boolean;
  title: string;
  description: string;
  isPublic: boolean;
};

export default function FrequencyCreator() {
  const [selectedFrequencies, setSelectedFrequencies] = useState<number[]>([]);
  const [mixStyle, setMixStyle] = useState<MixStyle>('golden432');
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState<(typeof WAVEFORMS)[number]>('sine');
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [visualizationType, setVisualizationType] = useState<VisualizerType>('waveform');
  const [ambientSound, setAmbientSound] = useState<(typeof AMBIENT_SOUNDS)[number]>('none');
  const [audioFormat, setAudioFormat] = useState<(typeof AUDIO_FORMATS)[number]>('webm');
  const [includeVideo, setIncludeVideo] = useState(false);
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
  const mp3LimitSeconds = MP3_ESTIMATED_MAX_SECONDS;
  const showMp3Warning = audioFormat === 'mp3' && duration > mp3LimitSeconds;
  const maxSelectableFrequencies =
    mixStyle === 'golden432' ? PRESET_FREQUENCIES.length : MAX_FREQUENCIES;

  const generator = useMemo(() => new FrequencyGenerator(), []);
  const supabase = useMemo(() => createSupabaseClient(), []);
  const mixedVoices = useMemo(
    () =>
      buildFrequencyMix({
        mixStyle,
        selectedFrequencies,
        waveform,
        volume
      }),
    [mixStyle, selectedFrequencies, waveform, volume]
  );

  useEffect(() => {
    return () => {
      generator.dispose();
    };
  }, [generator]);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

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
      if (draft.selectedFrequencies) {
        setSelectedFrequencies(draft.selectedFrequencies);
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
        setDuration(draft.duration);
      }
      if (draft.visualizationType) {
        setVisualizationType(draft.visualizationType);
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
      mixStyle,
      waveform,
      volume,
      duration,
      visualizationType,
      ambientSound,
      audioFormat,
      includeVideo,
      title,
      description,
      isPublic
    };

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    selectedFrequencies,
    mixStyle,
    waveform,
    volume,
    duration,
    visualizationType,
    ambientSound,
    audioFormat,
    includeVideo,
    title,
    description,
    isPublic
  ]);

  useEffect(() => {
    if (isPlaying) {
      generator.setMasterVolume(volume);
    }
  }, [generator, isPlaying, volume]);

  useEffect(() => {
    if (isPlaying && mixedVoices.length > 0) {
      generator.play(mixedVoices);
    }
  }, [generator, isPlaying, mixedVoices]);

  useEffect(() => {
    if (isPlaying && mixedVoices.length === 0) {
      generator.stop();
      setIsPlaying(false);
      setStatus('Select at least one frequency.');
    }
  }, [generator, isPlaying, mixedVoices.length]);

  useEffect(() => {
    if (mixStyle !== 'golden432') {
      if (selectedFrequencies.length > MAX_FREQUENCIES) {
        setSelectedFrequencies((prev) => prev.slice(0, MAX_FREQUENCIES));
      }
    }
  }, [mixStyle, selectedFrequencies.length]);

  useEffect(() => {
    if (isPlaying) {
      generator.setAmbientLayer(ambientSound);
    }
  }, [ambientSound, generator, isPlaying]);

  const toggleFrequency = (hz: number) => {
    setSelectedFrequencies((prev) =>
      prev.includes(hz)
        ? prev.filter((value) => value !== hz)
        : prev.length >= maxSelectableFrequencies
          ? prev
          : [...prev, hz]
    );
  };

  const handlePlay = async () => {
    if (isPlaying) {
      generator.stop();
      setIsPlaying(false);
      return;
    }

    try {
      const shouldEnableBridge = isIOS || isIOSDevice();
      await generator.initialize(DEFAULT_EFFECTS, { enableIOSAudioBridge: shouldEnableBridge });
      generator.setMasterVolume(volume);
      setAnalyser(generator.getAnalyser());
      setIsPlaying(true);
    } catch (error) {
      console.error(error);
      setStatus('Audio could not start. Please tap Play again or check device settings.');
    }
  };

  const handleSave = async () => {
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

    try {
      await ensureProfile(supabase, activeUser);
    } catch (profileError) {
      console.error(profileError);
      setStatus('We could not finish your profile setup. Please try again.');
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    setStatus('Preparing your session...');

    try {
      const exportDuration = Math.min(duration, MAX_EXPORT_SECONDS);
      const canvas = visualCanvas;

      if (includeVideo && !canvas) {
        setStatus('Video capture is not ready yet. Please try again in a moment.');
        setIsSaving(false);
        return;
      }

      const videoPromise =
        includeVideo && canvas ? captureVideo(canvas, exportDuration) : Promise.resolve(null);
      const thumbnailPromise = canvas ? captureThumbnail(canvas) : Promise.resolve(null);

      setStatus(includeVideo ? 'Recording audio and video...' : 'Rendering audio...');
      const exportResult = await exportAudio(exportDuration, audioFormat);
      const [videoBlob, thumbnailBlob] = await Promise.all([videoPromise, thumbnailPromise]);

      const slug = createSlug(title) || 'session';
      const timestamp = Date.now();
      const fileName = `${activeUserId}/${timestamp}-${slug}.${exportResult.extension}`;
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
        setStatus('Uploading video...');
        const videoExtension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const videoName = `${activeUserId}/${timestamp}-${slug}.${videoExtension}`;
        const { data: videoData, error: videoError } = await supabase.storage
          .from(VIDEO_BUCKET)
          .upload(videoName, videoBlob, { contentType: videoBlob.type || 'video/webm', upsert: true });

        if (videoError) {
          throw videoError;
        }

        videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(videoData.path).data.publicUrl;
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
      const frequencyVolumes: Json = Object.fromEntries(
        mixedVoices.map((voice) => [String(Math.round(voice.frequency * 100) / 100), voice.volume])
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
        mix_style: mixStyle
      };

      const { data: insertData, error: insertError } = await supabase
        .from('compositions')
        .insert({
        user_id: activeUserId,
        title: title.trim() || 'Untitled Session',
        description,
        frequencies: frequenciesToStore,
        frequency_volumes: frequencyVolumes,
        duration,
        waveform,
        ambient_sound: ambientSound === 'none' ? null : ambientSound,
        effects: effectsConfig,
        visualization_type: visualizationType,
        visualization_config: { palette: 'ember-lagoon' },
        audio_url: publicUrl,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        is_public: isPublic,
        tags: [ambientSound].filter((tag) => tag !== 'none')
      })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (insertData?.id) {
        const tasks = ['normalize_audio'];
        if (videoUrl) {
          tasks.push('transcode_video');
        }
        fetch('/api/processing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compositionId: insertData.id, tasks })
        }).catch(() => null);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DRAFT_KEY);
      }

      setStatus('Saved! Your composition is now available in Discover.');
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
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 rounded-3xl bg-white/70 p-6 shadow-halo md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Create your frequency ritual</h2>
          <p className="text-sm text-ink/70">
            Stack core tones, shape phi harmonics, and explore immersive resonance patterns in real time.
          </p>
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
        </div>
        <div className="space-y-4">
          {!userId ? (
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
              <p className="text-sm text-ink/70">
                You are composing as a guest. Sign in to save and share your session when it feels right.
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
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/60">Session controls</p>
            {isIOS ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                iOS tip: Tap Play to unlock audio. If you still hear nothing, flip the silent switch off on the side of
                your iPhone. Video export is unavailable on iPhone/iPad.
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
                      {option === 'manual' ? 'Selected frequencies only' : 'Golden ratio ladder'}
                    </option>
                  ))}
                </select>
              </label>
              {mixStyle === 'golden432' ? (
                <p className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                  Golden ladder mode uses each selected frequency as a base tone, then adds phi sidebands with
                  reference-style left/right weighting.
                </p>
              ) : null}
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
              {showMp3Warning ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  MP3 export is optimized for shorter sessions (up to {mp3LimitSeconds}s). Reduce duration or choose
                  WAV for longer renders.
                </p>
              ) : null}
              <label className="flex items-center justify-between gap-3">
                <span>Capture video</span>
                <input
                  type="checkbox"
                  checked={includeVideo}
                  onChange={(event) => setIncludeVideo(event.target.checked)}
                  disabled={isIOS}
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Duration (sec)</span>
                <input
                  type="number"
                  min={60}
                  max={600}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="w-24 rounded-full border border-ink/10 bg-white px-3 py-2 text-right"
                />
              </label>
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
              <label className="flex items-center justify-between gap-3">
                <span>Public share</span>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePlay} disabled={mixedVoices.length === 0}>
              {isPlaying ? 'Stop' : 'Play'}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={!isPlaying || isSaving}>
              {isSaving ? 'Saving...' : 'Save & Share'}
            </Button>
          </div>
          {status ? <p className="text-sm text-ink/70">{status}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Selected frequencies</h3>
          <p className="text-xs text-ink/60">
            {mixStyle === 'golden432'
              ? 'Select one or more base frequencies. Each selected tone generates its own phi ladder.'
              : `Select up to ${MAX_FREQUENCIES} frequencies.`}
          </p>
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
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Live visualization</h3>
          {visualizationType === 'orbital' ? (
            <ThreeVisualizer analyser={analyser} isActive={isPlaying} onCanvasReady={setVisualCanvas} />
          ) : (
            <WaveformVisualizer
              analyser={analyser}
              type={visualizationType}
              isActive={isPlaying}
              onCanvasReady={setVisualCanvas}
            />
          )}
          <p className="text-xs text-ink/60">
            Visualization reacts to the master output. Use the waveform selector to explore patterns.
          </p>
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
