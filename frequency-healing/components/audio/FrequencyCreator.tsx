'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import WaveformVisualizer, { type VisualizerType } from '@/components/audio/WaveformVisualizer';
import { FrequencyGenerator } from '@/lib/audio/FrequencyGenerator';
import { exportAudio } from '@/lib/audio/AudioExporter';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';
import {
  AMBIENT_SOUNDS,
  AUDIO_BUCKET,
  DEFAULT_DURATION,
  MAX_FREQUENCIES,
  PRESET_FREQUENCIES,
  VISUALIZATION_TYPES,
  WAVEFORMS
} from '@/lib/utils/constants';
import { createSlug } from '@/lib/utils/helpers';

const DEFAULT_VOLUME = 0.35;
const DRAFT_KEY = 'frequency-healing:draft';

type DraftState = {
  selectedFrequencies: number[];
  waveform: (typeof WAVEFORMS)[number];
  volume: number;
  duration: number;
  visualizationType: VisualizerType;
  ambientSound: (typeof AMBIENT_SOUNDS)[number];
  title: string;
  description: string;
  isPublic: boolean;
};

export default function FrequencyCreator() {
  const [selectedFrequencies, setSelectedFrequencies] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState<(typeof WAVEFORMS)[number]>('sine');
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [visualizationType, setVisualizationType] = useState<VisualizerType>('waveform');
  const [ambientSound, setAmbientSound] = useState<(typeof AMBIENT_SOUNDS)[number]>('none');
  const [title, setTitle] = useState('Untitled Session');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const generator = useMemo(() => new FrequencyGenerator(), []);
  const supabase = useMemo(() => createSupabaseClient(), []);

  useEffect(() => {
    return () => {
      generator.dispose();
    };
  }, [generator]);

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
      waveform,
      volume,
      duration,
      visualizationType,
      ambientSound,
      title,
      description,
      isPublic
    };

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    selectedFrequencies,
    waveform,
    volume,
    duration,
    visualizationType,
    ambientSound,
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
    if (isPlaying && selectedFrequencies.length > 0) {
      generator.play(
        selectedFrequencies.map((hz) => ({
          frequency: hz,
          volume,
          waveform
        }))
      );
    }
  }, [generator, isPlaying, selectedFrequencies, volume, waveform]);

  const toggleFrequency = (hz: number) => {
    setSelectedFrequencies((prev) =>
      prev.includes(hz)
        ? prev.filter((value) => value !== hz)
        : prev.length >= MAX_FREQUENCIES
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

    await generator.initialize();
    generator.setMasterVolume(volume);
    setAnalyser(generator.getAnalyser());
    setIsPlaying(true);
  };

  const handleSave = async () => {
    if (selectedFrequencies.length === 0) {
      setStatus('Select at least one frequency.');
      return;
    }

    if (!userId) {
      setStatus('Sign in to save your composition.');
      setAuthModalOpen(true);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const activeUserId = data.user?.id ?? userId;
    if (!activeUserId) {
      setStatus('Sign in to save your composition.');
      setAuthModalOpen(true);
      return;
    }

    setIsSaving(true);
    setStatus('Rendering audio...');

    try {
      const audioBlob = await exportAudio(Math.min(duration, 120));
      const slug = createSlug(title) || 'session';
      const fileName = `${activeUserId}/${Date.now()}-${slug}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(uploadData.path).data.publicUrl;

      const frequencyVolumes: Json = Object.fromEntries(
        selectedFrequencies.map((hz) => [String(hz), volume])
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
          : null
      };

      const { error: insertError } = await supabase.from('compositions').insert({
        user_id: activeUserId,
        title: title.trim() || 'Untitled Session',
        description,
        frequencies: selectedFrequencies,
        frequency_volumes: frequencyVolumes,
        duration,
        waveform,
        ambient_sound: ambientSound === 'none' ? null : ambientSound,
        effects: effectsConfig,
        visualization_type: visualizationType,
        visualization_config: { palette: 'ember-lagoon' },
        audio_url: publicUrl,
        is_public: isPublic,
        tags: [ambientSound].filter((tag) => tag !== 'none')
      });

      if (insertError) {
        throw insertError;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DRAFT_KEY);
      }

      setStatus('Saved! Your composition is now available in Discover.');
    } catch (error) {
      console.error(error);
      setStatus('Could not save the composition. Check Supabase storage bucket setup.');
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
            Pick up to six frequencies, tune the waveform, and watch the resonance unfold in real time.
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
            <Button onClick={handlePlay} disabled={selectedFrequencies.length === 0}>
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
          <WaveformVisualizer analyser={analyser} type={visualizationType} isActive={isPlaying} />
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
