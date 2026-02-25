'use client';

import Button from '@/components/ui/Button';
import type { EcstaticSceneDefinition, EcstaticSceneId, EcstaticTransitionType } from '@/lib/ecstatic/types';
import { cn } from '@/lib/utils/helpers';

interface SceneStackEditorProps {
  scenes: EcstaticSceneDefinition[];
  stack: EcstaticSceneId[];
  activeSceneId: EcstaticSceneId;
  sceneIntensity: number;
  sceneSpeed: number;
  transition: EcstaticTransitionType;
  onActiveSceneChange: (sceneId: EcstaticSceneId) => void;
  onSceneIntensityChange: (value: number) => void;
  onSceneSpeedChange: (value: number) => void;
  onTransitionChange: (value: EcstaticTransitionType) => void;
}

const TRANSITIONS: EcstaticTransitionType[] = ['crossfade', 'flash-cut', 'spiral-morph', 'luma-dissolve'];

export default function SceneStackEditor({
  scenes,
  stack,
  activeSceneId,
  sceneIntensity,
  sceneSpeed,
  transition,
  onActiveSceneChange,
  onSceneIntensityChange,
  onSceneSpeedChange,
  onTransitionChange
}: SceneStackEditorProps) {
  const visibleScenes = stack
    .map((id) => scenes.find((scene) => scene.id === id))
    .filter((scene): scene is EcstaticSceneDefinition => Boolean(scene));

  return (
    <div className="rounded-3xl border border-ink/10 bg-white/78 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/60">Scene Stack</h3>
      <p className="mt-1 text-xs text-ink/60">Choose the active scene and shape visual dynamics live.</p>

      <div className="mt-3 space-y-2">
        {visibleScenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onActiveSceneChange(scene.id)}
            className={cn(
              'w-full rounded-2xl border px-3 py-2 text-left transition',
              scene.id === activeSceneId
                ? 'border-lagoon/45 bg-lagoon/10 text-ink shadow-sm'
                : 'border-ink/12 bg-white/75 text-ink/75 hover:border-ink/24 hover:text-ink'
            )}
          >
            <p className="text-sm font-semibold">{scene.name}</p>
            <p className="mt-0.5 text-xs text-ink/60">{scene.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-xs uppercase tracking-[0.18em] text-ink/55">
          Intensity
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.05}
              value={sceneIntensity}
              onChange={(event) => onSceneIntensityChange(Number(event.target.value))}
              className="w-full"
            />
            <span className="w-10 text-right text-xs text-ink/65">{Math.round(sceneIntensity * 100)}%</span>
          </div>
        </label>

        <label className="block text-xs uppercase tracking-[0.18em] text-ink/55">
          Speed
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.05}
              value={sceneSpeed}
              onChange={(event) => onSceneSpeedChange(Number(event.target.value))}
              className="w-full"
            />
            <span className="w-10 text-right text-xs text-ink/65">{Math.round(sceneSpeed * 100)}%</span>
          </div>
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/55">Transition</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRANSITIONS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === transition ? 'solid' : 'outline'}
              onClick={() => onTransitionChange(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
