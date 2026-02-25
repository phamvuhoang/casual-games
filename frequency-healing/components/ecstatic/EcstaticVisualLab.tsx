'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { FrequencyGenerator } from '@/lib/audio/FrequencyGenerator';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import { buildSceneRuntime, defaultSceneTransition, getEcstaticScenePack, getEcstaticScenes } from '@/lib/ecstatic/templates';
import { loadEcstaticDraft, saveEcstaticDraft } from '@/lib/ecstatic/storage';
import type { EcstaticSceneId, EcstaticTransitionType, EcstaticVisualPack } from '@/lib/ecstatic/types';

const VISUAL_PACKS: Array<{ id: EcstaticVisualPack; label: string }> = [
  { id: 'organic', label: 'Organic' },
  { id: 'tribal', label: 'Tribal' },
  { id: 'cosmic', label: 'Cosmic' },
  { id: 'minimal', label: 'Minimal' }
];

export default function EcstaticVisualLab() {
  const scenes = useMemo(() => getEcstaticScenes(), []);
  const [visualPack, setVisualPack] = useState<EcstaticVisualPack>('organic');
  const [activeSceneId, setActiveSceneId] = useState<EcstaticSceneId>(() => getEcstaticScenePack('organic')[0] ?? 'kinetic_mandala');
  const [sceneIntensity, setSceneIntensity] = useState(1);
  const [sceneSpeed, setSceneSpeed] = useState(1);
  const [transition, setTransition] = useState<EcstaticTransitionType>(defaultSceneTransition());
  const [isPreviewRunning, setIsPreviewRunning] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const generatorRef = useRef(new FrequencyGenerator());
  const mountedRef = useRef(true);

  const sceneStack = useMemo(() => getEcstaticScenePack(visualPack), [visualPack]);
  const activeSceneRuntime = useMemo(
    () => buildSceneRuntime({ sceneId: activeSceneId, intensityScale: sceneIntensity, speedScale: sceneSpeed }),
    [activeSceneId, sceneIntensity, sceneSpeed]
  );
  const shouldEnableBridge = false;

  useEffect(() => {
    if (!sceneStack.includes(activeSceneId)) {
      setActiveSceneId(sceneStack[0] ?? 'kinetic_mandala');
    }
  }, [activeSceneId, sceneStack]);

  const handleStartPreview = async () => {
    if (isPreviewRunning) {
      return;
    }
    try {
      await generatorRef.current.initialize(DEFAULT_EFFECTS, { enableAudioBridge: shouldEnableBridge });
      generatorRef.current.setMasterVolume(0.32);
      generatorRef.current.setRhythmPattern({
        enabled: true,
        bpm: 92,
        subdivision: '16n',
        steps: [true, false, true, false, true, true, false, true, true, false, true, false, true, true, false, true]
      });
      generatorRef.current.setAutomation({
        modulation: {
          enabled: true,
          rateHz: 0.2,
          depthHz: 4.2,
          waveform: 'sine'
        },
        sweep: {
          enabled: false,
          targetHz: 528,
          durationSeconds: 16,
          curve: 'easeInOut'
        }
      });
      generatorRef.current.play([
        { frequency: 432, volume: 0.2, waveform: 'sine', pan: -0.15 },
        { frequency: 528, volume: 0.18, waveform: 'triangle', pan: 0.15 },
        { frequency: 639, volume: 0.12, waveform: 'sine', pan: 0 }
      ]);
      if (!mountedRef.current) {
        return;
      }
      const liveAnalyser = generatorRef.current.getAnalyser();
      setAnalyser(liveAnalyser);
      setIsPreviewRunning(true);
      setStatus(liveAnalyser ? 'Preview started.' : 'Preview started, but analyser is unavailable.');
    } catch (error) {
      console.error(error);
      setStatus('Could not start preview audio. Check browser audio permissions.');
    }
  };

  const handleStopPreview = () => {
    generatorRef.current.stop();
    setIsPreviewRunning(false);
    setAnalyser(null);
    setStatus('Preview stopped.');
  };

  const handleApplyToSetup = () => {
    const draft = loadEcstaticDraft();
    if (!draft) {
      setStatus('No active setup draft. Open Ecstatic setup first.');
      return;
    }
    saveEcstaticDraft({
      ...draft,
      visualPack
    });
    setStatus('Visual pack applied to setup draft.');
  };

  useEffect(() => {
    const draft = loadEcstaticDraft();
    if (draft) {
      setVisualPack(draft.visualPack);
    }
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      generatorRef.current.dispose();
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <Card className="p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.28em] text-ink/60">Ecstatic Visual Lab</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Scene and Transition Sandbox</h1>
        <p className="mt-3 text-sm text-ink/70">
          Audition visualization scenes, tune intensity/speed, and test transitions before a live dance session.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <Card className="space-y-4">
          <WaveformVisualizer
            analyser={analyser}
            type="multi-layer"
            layers={activeSceneRuntime.layers}
            isActive={isPreviewRunning}
          />
          <div className="rounded-2xl border border-ink/10 bg-white/76 p-3 text-xs text-ink/64">
            Active scene: <span className="font-semibold text-ink/80">{activeSceneRuntime.id}</span> • Transition:{' '}
            <span className="font-semibold text-ink/80">{transition}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isPreviewRunning ? (
              <Button onClick={handleStartPreview}>Start preview</Button>
            ) : (
              <Button variant="outline" onClick={handleStopPreview}>
                Stop preview
              </Button>
            )}
            <Button variant="ghost" onClick={handleApplyToSetup}>
              Apply pack to setup
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <section>
            <h2 className="text-xs uppercase tracking-[0.2em] text-ink/56">Visual Pack</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {VISUAL_PACKS.map((pack) => (
                <Button
                  key={pack.id}
                  size="sm"
                  variant={pack.id === visualPack ? 'solid' : 'outline'}
                  onClick={() => setVisualPack(pack.id)}
                >
                  {pack.label}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.2em] text-ink/56">Scenes</h2>
            <div className="mt-2 space-y-2">
              {sceneStack.map((sceneId) => {
                const scene = scenes.find((item) => item.id === sceneId);
                if (!scene) {
                  return null;
                }
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setActiveSceneId(scene.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                      scene.id === activeSceneId
                        ? 'border-lagoon/35 bg-lagoon/10 shadow-sm'
                        : 'border-ink/10 bg-white/74 hover:border-ink/24'
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink">{scene.name}</p>
                    <p className="mt-1 text-xs text-ink/62">{scene.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.18em] text-ink/56">
              Intensity
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={sceneIntensity}
                  onChange={(event) => setSceneIntensity(Number(event.target.value))}
                  className="w-full"
                />
                <span className="w-10 text-right text-xs text-ink/68">{Math.round(sceneIntensity * 100)}%</span>
              </div>
            </label>
            <label className="block text-xs uppercase tracking-[0.18em] text-ink/56">
              Speed
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={sceneSpeed}
                  onChange={(event) => setSceneSpeed(Number(event.target.value))}
                  className="w-full"
                />
                <span className="w-10 text-right text-xs text-ink/68">{Math.round(sceneSpeed * 100)}%</span>
              </div>
            </label>
            <label className="block text-xs uppercase tracking-[0.18em] text-ink/56">
              Transition
              <select
                value={transition}
                onChange={(event) => setTransition(event.target.value as EcstaticTransitionType)}
                className="mt-2 w-full rounded-full border border-ink/10 bg-white px-3 py-2 text-sm"
              >
                <option value="crossfade">crossfade</option>
                <option value="flash-cut">flash-cut</option>
                <option value="spiral-morph">spiral-morph</option>
                <option value="luma-dissolve">luma-dissolve</option>
              </select>
            </label>
          </section>

          <div className="pt-1">
            <Button asChild variant="outline">
              <Link href="/ecstatic">Back to setup</Link>
            </Button>
          </div>
          {status ? <p className="text-xs text-ink/62">{status}</p> : null}
        </Card>
      </div>
    </div>
  );
}
