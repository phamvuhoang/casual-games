import { clamp } from '@/lib/audio/audioConfig';

export type BrainState = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
export type JourneyIntent = 'sleep' | 'focus' | 'meditation' | 'creative';

export interface AdaptiveJourneyStep {
  state: BrainState;
  beatHz: number;
  minutes: number;
}

export interface AdaptiveJourneyTemplate {
  intent: JourneyIntent;
  title: string;
  description: string;
  defaultDurationMinutes: number;
  steps: AdaptiveJourneyStep[];
}

export interface JourneyRuntimePoint {
  beatHz: number;
  state: BrainState;
  stepIndex: number;
  stepProgress: number;
  overallProgress: number;
  elapsedSeconds: number;
  durationSeconds: number;
}

const JOURNEY_TEMPLATES: Record<JourneyIntent, AdaptiveJourneyTemplate> = {
  sleep: {
    intent: 'sleep',
    title: 'Deep Sleep Ramp',
    description: 'Downshifts from alert states into deep-rest pacing.',
    defaultDurationMinutes: 28,
    steps: [
      { state: 'beta', beatHz: 14, minutes: 4 },
      { state: 'alpha', beatHz: 10, minutes: 7 },
      { state: 'theta', beatHz: 6, minutes: 10 },
      { state: 'delta', beatHz: 2.5, minutes: 7 }
    ]
  },
  focus: {
    intent: 'focus',
    title: 'Focused Clarity',
    description: 'Centers in alpha then rises into sustained focus.',
    defaultDurationMinutes: 26,
    steps: [
      { state: 'alpha', beatHz: 9, minutes: 5 },
      { state: 'beta', beatHz: 14, minutes: 11 },
      { state: 'beta', beatHz: 18, minutes: 7 },
      { state: 'gamma', beatHz: 32, minutes: 3 }
    ]
  },
  meditation: {
    intent: 'meditation',
    title: 'Meditative Descent',
    description: 'Settles into stable alpha/theta meditation depth.',
    defaultDurationMinutes: 24,
    steps: [
      { state: 'alpha', beatHz: 10, minutes: 6 },
      { state: 'theta', beatHz: 7, minutes: 10 },
      { state: 'theta', beatHz: 5.5, minutes: 5 },
      { state: 'delta', beatHz: 3.5, minutes: 3 }
    ]
  },
  creative: {
    intent: 'creative',
    title: 'Creative Flow',
    description: 'Alternates alpha/theta and returns to active ideation.',
    defaultDurationMinutes: 30,
    steps: [
      { state: 'alpha', beatHz: 10.5, minutes: 6 },
      { state: 'theta', beatHz: 7.5, minutes: 9 },
      { state: 'alpha', beatHz: 9.5, minutes: 7 },
      { state: 'beta', beatHz: 16, minutes: 8 }
    ]
  }
};

function scaleStepsToDuration(steps: AdaptiveJourneyStep[], durationMinutes: number) {
  const totalMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);
  if (totalMinutes <= 0) {
    return steps.map((step) => ({ ...step }));
  }

  const target = clamp(8, durationMinutes, 60);
  const ratio = target / totalMinutes;
  return steps.map((step) => ({
    ...step,
    minutes: Math.max(1, Number((step.minutes * ratio).toFixed(2)))
  }));
}

export function getAdaptiveJourneyTemplate(intent: JourneyIntent) {
  return JOURNEY_TEMPLATES[intent];
}

export function getAdaptiveJourneyTemplates() {
  return (Object.values(JOURNEY_TEMPLATES) as AdaptiveJourneyTemplate[]).map((item) => ({ ...item }));
}

export function createAdaptiveJourneySteps(intent: JourneyIntent, durationMinutes: number) {
  const template = getAdaptiveJourneyTemplate(intent);
  return scaleStepsToDuration(template.steps, durationMinutes);
}

export function resolveJourneyRuntimePoint(options: {
  steps: AdaptiveJourneyStep[];
  elapsedSeconds: number;
  adaptiveBeatOffset?: number;
}) {
  const { steps, elapsedSeconds, adaptiveBeatOffset = 0 } = options;
  if (steps.length === 0) {
    return {
      beatHz: 8,
      state: 'alpha',
      stepIndex: 0,
      stepProgress: 0,
      overallProgress: 0,
      elapsedSeconds: Math.max(0, elapsedSeconds),
      durationSeconds: 1
    } satisfies JourneyRuntimePoint;
  }

  const durations = steps.map((step) => Math.max(1, step.minutes) * 60);
  const totalDuration = durations.reduce((sum, item) => sum + item, 0);
  const elapsed = clamp(0, elapsedSeconds, totalDuration);

  let consumed = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const duration = durations[index];
    const segmentEnd = consumed + duration;
    if (elapsed <= segmentEnd || index === steps.length - 1) {
      const localElapsed = elapsed - consumed;
      const localProgress = clamp(0, localElapsed / duration, 1);
      const current = steps[index];
      const next = steps[index + 1] ?? current;
      const interpolatedBeat = current.beatHz + (next.beatHz - current.beatHz) * localProgress;
      return {
        beatHz: clamp(0.5, interpolatedBeat + adaptiveBeatOffset, 40),
        state: current.state,
        stepIndex: index,
        stepProgress: localProgress,
        overallProgress: clamp(0, elapsed / totalDuration, 1),
        elapsedSeconds: elapsed,
        durationSeconds: totalDuration
      } satisfies JourneyRuntimePoint;
    }
    consumed += duration;
  }

  const last = steps[steps.length - 1];
  return {
    beatHz: clamp(0.5, last.beatHz + adaptiveBeatOffset, 40),
    state: last.state,
    stepIndex: steps.length - 1,
    stepProgress: 1,
    overallProgress: 1,
    elapsedSeconds: totalDuration,
    durationSeconds: totalDuration
  } satisfies JourneyRuntimePoint;
}

export function suggestAdaptiveOffsetByBreath(options: {
  breathBpm: number;
  intent: JourneyIntent;
}) {
  const { breathBpm, intent } = options;
  const targetBpm = 5.5;
  const drift = clamp(-6, breathBpm - targetBpm, 6);
  const scale = intent === 'focus' || intent === 'creative' ? 0.15 : -0.22;
  return clamp(-2, drift * scale, 2);
}

export function stateVisualModifiers(state: BrainState) {
  if (state === 'delta') {
    return { intensity: 0.68, speed: 0.62 };
  }
  if (state === 'theta') {
    return { intensity: 0.78, speed: 0.74 };
  }
  if (state === 'alpha') {
    return { intensity: 0.9, speed: 0.9 };
  }
  if (state === 'gamma') {
    return { intensity: 1.15, speed: 1.24 };
  }
  return { intensity: 1.04, speed: 1.08 };
}

