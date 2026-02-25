'use client';

import { useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { DEFAULT_ECSTATIC_SETUP, getEcstaticScenePack, getEcstaticTemplate, getEcstaticTemplates } from '@/lib/ecstatic/templates';
import { saveEcstaticDraft } from '@/lib/ecstatic/storage';
import type { EcstaticAutomationLevel, EcstaticTemplateId, EcstaticVisualPack } from '@/lib/ecstatic/types';

const VISUAL_PACKS: Array<{ id: EcstaticVisualPack; name: string; detail: string }> = [
  { id: 'organic', name: 'Organic', detail: 'Fluid gradients, ripples, and soft geometry.' },
  { id: 'tribal', name: 'Tribal', detail: 'High-energy particles and rhythmic constellation layers.' },
  { id: 'cosmic', name: 'Cosmic', detail: 'Prism bloom, tunnel motion, and deep contrast.' },
  { id: 'minimal', name: 'Minimal', detail: 'Low-motion visuals for quieter integration-focused sessions.' }
];

const AUTOMATION_LEVELS: Array<{ id: EcstaticAutomationLevel; name: string; detail: string }> = [
  { id: 'manual', name: 'Manual', detail: 'You drive every phase and transition.' },
  { id: 'assisted', name: 'Assisted', detail: 'System suggests actions while you stay in control.' },
  { id: 'adaptive-light', name: 'Adaptive-light', detail: 'System nudges intensity and speed, with manual phase confirmation.' }
];

async function runMicPreflight() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('MIC_UNAVAILABLE');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      noiseSuppression: false,
      echoCancellation: false,
      autoGainControl: false
    }
  });
  stream.getTracks().forEach((track) => track.stop());
}

export default function EcstaticSessionSetup() {
  const router = useRouter();
  const templates = useMemo(() => getEcstaticTemplates(), []);

  const [templateId, setTemplateId] = useState<EcstaticTemplateId>(DEFAULT_ECSTATIC_SETUP.templateId);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_ECSTATIC_SETUP.durationMinutes);
  const [automationLevel, setAutomationLevel] = useState<EcstaticAutomationLevel>(DEFAULT_ECSTATIC_SETUP.automationLevel);
  const [visualPack, setVisualPack] = useState<EcstaticVisualPack>(DEFAULT_ECSTATIC_SETUP.visualPack);
  const [isCheckingMic, setIsCheckingMic] = useState(false);
  const [preflightMessage, setPreflightMessage] = useState<string | null>(null);
  const [isPreflightReady, setIsPreflightReady] = useState(false);

  const selectedTemplate = getEcstaticTemplate(templateId);
  const selectedPackScenes = getEcstaticScenePack(visualPack);

  const handleRunPreflight = async () => {
    if (isCheckingMic) {
      return;
    }
    setIsCheckingMic(true);
    setPreflightMessage(null);
    setIsPreflightReady(false);

    try {
      await runMicPreflight();
      setPreflightMessage('Preflight complete. Audio and microphone are ready.');
      setIsPreflightReady(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setPreflightMessage('Microphone permission denied. Enable mic access to continue.');
      } else {
        setPreflightMessage('Microphone is unavailable on this device/browser.');
      }
    } finally {
      setIsCheckingMic(false);
    }
  };

  const handleStartLive = () => {
    saveEcstaticDraft({
      templateId,
      durationMinutes,
      automationLevel,
      visualPack
    });
    router.push('/ecstatic/live');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <Card className="p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.28em] text-ink/60">Ecstatic Dance</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Resonance Wave Conductor</h1>
        <p className="mt-3 max-w-3xl text-sm text-ink/70">
          Build a guided dance arc, calibrate your room, and run a non-verbal live session with adaptive audio-reactive
          visuals.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <Card className="space-y-5">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-ink/58">Arc Template</h2>
            <div className="mt-3 space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    template.id === templateId
                      ? 'border-lagoon/35 bg-lagoon/10 shadow-sm'
                      : 'border-ink/10 bg-white/72 hover:border-ink/25'
                  }`}
                >
                  <p className="text-sm font-semibold text-ink">{template.name}</p>
                  <p className="mt-1 text-xs text-ink/65">{template.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="rounded-2xl border border-ink/10 bg-white/72 p-3 text-sm text-ink/70">
              Session length (minutes)
              <input
                type="number"
                min={20}
                max={120}
                value={durationMinutes}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setDurationMinutes(Number.isFinite(next) ? Math.min(120, Math.max(20, next)) : 60);
                }}
                className="mt-2 w-full rounded-full border border-ink/10 bg-white px-3 py-2 text-right text-sm"
              />
            </label>

            <label className="rounded-2xl border border-ink/10 bg-white/72 p-3 text-sm text-ink/70">
              Automation level
              <select
                value={automationLevel}
                onChange={(event) => setAutomationLevel(event.target.value as EcstaticAutomationLevel)}
                className="mt-2 w-full rounded-full border border-ink/10 bg-white px-3 py-2 text-sm"
              >
                {AUTOMATION_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-ink/55">
                {AUTOMATION_LEVELS.find((level) => level.id === automationLevel)?.detail}
              </p>
            </label>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-ink/58">Visual Pack</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {VISUAL_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setVisualPack(pack.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    visualPack === pack.id
                      ? 'border-lagoon/35 bg-lagoon/10 shadow-sm'
                      : 'border-ink/10 bg-white/72 hover:border-ink/25'
                  }`}
                >
                  <p className="text-sm font-semibold text-ink">{pack.name}</p>
                  <p className="mt-1 text-xs text-ink/62">{pack.detail}</p>
                </button>
              ))}
            </div>
          </section>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-ink/58">Preflight</h2>
          <p className="text-sm text-ink/70">
            Run a quick mic and audio check before entering fullscreen live mode.
          </p>
          <div className="rounded-2xl border border-ink/10 bg-white/75 p-3 text-xs text-ink/64">
            <p>
              Template: <span className="font-semibold text-ink/80">{selectedTemplate.name}</span>
            </p>
            <p className="mt-1">
              Scene pack: <span className="font-semibold text-ink/80">{visualPack}</span> ({selectedPackScenes.length}{' '}
              scenes)
            </p>
            <p className="mt-1">
              Est. arc: {selectedTemplate.phasePlan.map((item) => `${item.phase}:${item.minutes}m`).join(' • ')}
            </p>
          </div>
          <Button onClick={handleRunPreflight} disabled={isCheckingMic} size="md">
            {isCheckingMic ? 'Running preflight...' : 'Run preflight'}
          </Button>
          {preflightMessage ? (
            <p
              className={`rounded-2xl border px-3 py-2 text-xs ${
                isPreflightReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {preflightMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={handleStartLive} disabled={!isPreflightReady}>
              Start live session
            </Button>
            <Button variant="ghost" onClick={() => router.push('/ecstatic/visual-lab')}>
              Open visual lab
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
