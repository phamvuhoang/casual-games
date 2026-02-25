import { clamp } from '@/lib/audio/audioConfig';
import type {
  EcstaticAction,
  EcstaticLiveMetrics,
  EcstaticPhase,
  EcstaticRecommendation
} from '@/lib/ecstatic/types';

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function confidenceFromMetric(value: number, center: number, tolerance: number) {
  const drift = Math.abs(value - center);
  const normalized = clamp(0, 1 - drift / tolerance, 1);
  return round(normalized, 3);
}

function phaseDefaults(phase: EcstaticPhase) {
  if (phase === 'arrival') return { targetEnergy: 0.22, energyBand: 0.18, targetCoherence: 0.58 };
  if (phase === 'grounding') return { targetEnergy: 0.34, energyBand: 0.2, targetCoherence: 0.62 };
  if (phase === 'build') return { targetEnergy: 0.58, energyBand: 0.22, targetCoherence: 0.56 };
  if (phase === 'peak') return { targetEnergy: 0.78, energyBand: 0.2, targetCoherence: 0.48 };
  if (phase === 'release') return { targetEnergy: 0.44, energyBand: 0.24, targetCoherence: 0.6 };
  return { targetEnergy: 0.26, energyBand: 0.18, targetCoherence: 0.66 };
}

function decideAction(phase: EcstaticPhase, metrics: EcstaticLiveMetrics): EcstaticAction {
  const config = phaseDefaults(phase);
  const coherence = clamp(0, metrics.breathConfidence * 0.55 + metrics.roomConfidence * 0.45, 1);

  if (phase === 'integration') {
    if (metrics.energy > config.targetEnergy + 0.12) {
      return 'soften';
    }
    return 'hold';
  }

  if (phase === 'release' && coherence >= 0.72 && metrics.energy < config.targetEnergy - 0.12) {
    return 'land';
  }

  if (metrics.energy > config.targetEnergy + config.energyBand) {
    return coherence < config.targetCoherence ? 'soften' : 'hold';
  }

  if (metrics.energy < config.targetEnergy - config.energyBand * 0.65) {
    return phase === 'arrival' ? 'advance' : 'deepen';
  }

  if (coherence >= config.targetCoherence + 0.1 && phase !== 'peak') {
    return 'advance';
  }

  if (phase === 'peak' && coherence < 0.42) {
    return 'soften';
  }

  return 'hold';
}

export function recommendEcstaticAction(phase: EcstaticPhase, metrics: EcstaticLiveMetrics): EcstaticRecommendation {
  const action = decideAction(phase, metrics);
  const defaults = phaseDefaults(phase);
  const energyAlignment = confidenceFromMetric(metrics.energy, defaults.targetEnergy, defaults.energyBand + 0.2);
  const coherence = clamp(0, metrics.breathConfidence * 0.55 + metrics.roomConfidence * 0.45, 1);
  const confidence = round(
    clamp(
      0.2,
      energyAlignment * 0.45 + coherence * 0.35 + (metrics.breathBpm ? 0.2 : 0.08),
      0.98
    ),
    3
  );

  const reasons: string[] = [
    `Energy ${round(metrics.energy * 100, 1)}% in ${phase} phase`,
    `Coherence signal ${round(coherence * 100, 1)}%`
  ];

  if (typeof metrics.breathBpm === 'number' && Number.isFinite(metrics.breathBpm)) {
    reasons.push(`Breath cadence ${round(metrics.breathBpm, 1)} bpm`);
  }

  if (action === 'soften') {
    reasons.push('Peak guardrail: stabilize before intensifying');
  } else if (action === 'advance') {
    reasons.push('Signals indicate readiness for transition');
  } else if (action === 'land') {
    reasons.push('Landing conditions reached for integration');
  } else if (action === 'deepen') {
    reasons.push('Room can support a deeper energetic lift');
  } else {
    reasons.push('Hold trajectory for smoother phase continuity');
  }

  return {
    action,
    confidence,
    reasons
  };
}
