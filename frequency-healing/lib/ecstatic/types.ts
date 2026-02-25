import type { BaseVisualizationType, LayerBlendMode, VisualizationLayerConfig } from '@/lib/visualization/config';

export type EcstaticPhase = 'arrival' | 'grounding' | 'build' | 'peak' | 'release' | 'integration';
export type EcstaticAutomationLevel = 'manual' | 'assisted' | 'adaptive-light';
export type EcstaticTemplateId = 'gentle_wave' | 'tribal_rise' | 'cathartic_arc' | 'integration_heavy';
export type EcstaticVisualPack = 'organic' | 'tribal' | 'cosmic' | 'minimal';
export type EcstaticSceneId =
  | 'pulse_tunnel'
  | 'tribal_constellation'
  | 'kinetic_mandala'
  | 'liquid_ripple_field'
  | 'ember_rain'
  | 'body_echo_trails'
  | 'prism_bloom'
  | 'void_breath_orb';
export type EcstaticTransitionType = 'crossfade' | 'flash-cut' | 'spiral-morph' | 'luma-dissolve';
export type EcstaticStageStatus = 'draft' | 'live' | 'paused' | 'completed' | 'abandoned';
export type EcstaticAction = 'hold' | 'advance' | 'deepen' | 'soften' | 'land';

export interface EcstaticPhasePlanItem {
  phase: EcstaticPhase;
  minutes: number;
}

export interface EcstaticTemplate {
  id: EcstaticTemplateId;
  name: string;
  description: string;
  phasePlan: EcstaticPhasePlanItem[];
  baseFrequencies: Record<EcstaticPhase, number[]>;
  targetBpm: Record<EcstaticPhase, number>;
}

export interface EcstaticSceneLayerPreset {
  type: BaseVisualizationType;
  opacity: number;
  blendMode: LayerBlendMode;
  intensity: number;
  speed: number;
  scale: number;
  colorA: string;
  colorB: string;
  colorC: string;
}

export interface EcstaticSceneDefinition {
  id: EcstaticSceneId;
  name: string;
  description: string;
  mode: 'waveform' | 'three';
  baseType?: BaseVisualizationType;
  layers: EcstaticSceneLayerPreset[];
}

export interface EcstaticSignalSample {
  at: string;
  phase: EcstaticPhase;
  energy: number;
  bass: number;
  breathBpm: number | null;
  breathConfidence: number;
  roomConfidence: number;
  recommendation: EcstaticAction;
}

export interface EcstaticPhaseEvent {
  phase: EcstaticPhase;
  at: string;
  type: 'manual' | 'suggested';
}

export interface EcstaticSceneChangeEvent {
  at: string;
  from: EcstaticSceneId | null;
  to: EcstaticSceneId;
  transition: EcstaticTransitionType;
}

export interface EcstaticSessionSetupDraft {
  templateId: EcstaticTemplateId;
  durationMinutes: number;
  automationLevel: EcstaticAutomationLevel;
  visualPack: EcstaticVisualPack;
}

export interface EcstaticSessionSnapshot extends EcstaticSessionSetupDraft {
  version: 1;
  id: string;
  status: EcstaticStageStatus;
  startedAt: string;
  endedAt: string | null;
  phaseEvents: EcstaticPhaseEvent[];
  samples: EcstaticSignalSample[];
  sceneChanges: EcstaticSceneChangeEvent[];
  sceneIntensity: number;
  sceneSpeed: number;
  sceneTransition: EcstaticTransitionType;
  activeSceneId: EcstaticSceneId;
  sceneStack: EcstaticSceneId[];
  audioConfig: Record<string, unknown>;
  visualConfig: Record<string, unknown>;
}

export interface EcstaticRecommendation {
  action: EcstaticAction;
  confidence: number;
  reasons: string[];
}

export interface EcstaticLiveMetrics {
  energy: number;
  bass: number;
  breathBpm: number | null;
  breathConfidence: number;
  roomConfidence: number;
}

export interface EcstaticSceneRuntime {
  id: EcstaticSceneId;
  mode: 'waveform' | 'three';
  baseType: BaseVisualizationType;
  layers: VisualizationLayerConfig[];
}
