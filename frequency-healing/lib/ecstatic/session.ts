import { clamp } from '@/lib/audio/audioConfig';
import type {
  EcstaticPhase,
  EcstaticSceneId,
  EcstaticSessionSetupDraft,
  EcstaticSessionSnapshot,
  EcstaticTemplate
} from '@/lib/ecstatic/types';
import { buildPhasePlanTimeline, defaultSceneTransition, getDefaultSceneForPhase, getEcstaticScenePack } from '@/lib/ecstatic/templates';

const PHASE_ORDER: EcstaticPhase[] = ['arrival', 'grounding', 'build', 'peak', 'release', 'integration'];

export function createEcstaticSessionId() {
  return `ec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initialEcstaticSnapshot(options: {
  setup: EcstaticSessionSetupDraft;
  template: EcstaticTemplate;
}): EcstaticSessionSnapshot {
  const sceneStack = getEcstaticScenePack(options.setup.visualPack);
  const initialScene = sceneStack[0] ?? getDefaultSceneForPhase('arrival');
  return {
    version: 1,
    id: createEcstaticSessionId(),
    status: 'draft',
    startedAt: new Date().toISOString(),
    endedAt: null,
    templateId: options.setup.templateId,
    durationMinutes: options.setup.durationMinutes,
    automationLevel: options.setup.automationLevel,
    visualPack: options.setup.visualPack,
    phaseEvents: [
      {
        phase: 'arrival',
        at: new Date().toISOString(),
        type: 'manual'
      }
    ],
    samples: [],
    sceneChanges: [],
    sceneIntensity: 1,
    sceneSpeed: 1,
    sceneTransition: defaultSceneTransition(),
    activeSceneId: initialScene,
    sceneStack,
    audioConfig: {
      templateId: options.template.id
    },
    visualConfig: {
      phaseToScene: {
        arrival: getDefaultSceneForPhase('arrival'),
        grounding: getDefaultSceneForPhase('grounding'),
        build: getDefaultSceneForPhase('build'),
        peak: getDefaultSceneForPhase('peak'),
        release: getDefaultSceneForPhase('release'),
        integration: getDefaultSceneForPhase('integration')
      }
    }
  };
}

export function getPhaseIndex(phase: EcstaticPhase) {
  return PHASE_ORDER.indexOf(phase);
}

export function getNextPhase(current: EcstaticPhase) {
  const index = getPhaseIndex(current);
  if (index < 0) {
    return 'arrival' as EcstaticPhase;
  }
  return PHASE_ORDER[Math.min(PHASE_ORDER.length - 1, index + 1)];
}

export function getPreviousPhase(current: EcstaticPhase) {
  const index = getPhaseIndex(current);
  if (index < 0) {
    return 'arrival' as EcstaticPhase;
  }
  return PHASE_ORDER[Math.max(0, index - 1)];
}

export function resolveOverallProgress(options: {
  phase: EcstaticPhase;
  phaseProgress: number;
  template: EcstaticTemplate;
  durationMinutes: number;
}) {
  const timeline = buildPhasePlanTimeline(options.template, options.durationMinutes);
  const totalSeconds = timeline.reduce((sum, item) => sum + item.seconds, 0);
  const currentIndex = timeline.findIndex((item) => item.phase === options.phase);
  if (currentIndex < 0 || totalSeconds <= 0) {
    return 0;
  }

  const elapsedBefore = timeline.slice(0, currentIndex).reduce((sum, item) => sum + item.seconds, 0);
  const currentPhaseSeconds = timeline[currentIndex].seconds;
  const elapsed = elapsedBefore + currentPhaseSeconds * clamp(0, options.phaseProgress, 1);
  return clamp(0, elapsed / totalSeconds, 1);
}

export function pickSceneForPhase(phase: EcstaticPhase, sceneStack: EcstaticSceneId[]): EcstaticSceneId {
  const preferred = getDefaultSceneForPhase(phase);
  if (sceneStack.includes(preferred)) {
    return preferred;
  }
  return sceneStack[0] ?? preferred;
}
