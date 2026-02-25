import { clamp } from '@/lib/audio/audioConfig';
import type {
  EcstaticPhase,
  EcstaticSceneChangeEvent,
  EcstaticSceneDefinition,
  EcstaticSceneId,
  EcstaticSceneLayerPreset,
  EcstaticSceneRuntime,
  EcstaticSessionSetupDraft,
  EcstaticTemplate,
  EcstaticTemplateId,
  EcstaticTransitionType,
  EcstaticVisualPack
} from '@/lib/ecstatic/types';
import type { VisualizationLayerConfig } from '@/lib/visualization/config';

const PHASE_ORDER: EcstaticPhase[] = ['arrival', 'grounding', 'build', 'peak', 'release', 'integration'];
const DEFAULT_TRANSITION: EcstaticTransitionType = 'crossfade';

const TEMPLATES: Record<EcstaticTemplateId, EcstaticTemplate> = {
  gentle_wave: {
    id: 'gentle_wave',
    name: 'Gentle Wave',
    description: 'Soft build with a long landing and breath-oriented integration.',
    phasePlan: [
      { phase: 'arrival', minutes: 6 },
      { phase: 'grounding', minutes: 9 },
      { phase: 'build', minutes: 15 },
      { phase: 'peak', minutes: 10 },
      { phase: 'release', minutes: 8 },
      { phase: 'integration', minutes: 12 }
    ],
    baseFrequencies: {
      arrival: [396, 432],
      grounding: [396, 432, 528],
      build: [417, 528, 639],
      peak: [528, 639, 741],
      release: [432, 528, 639],
      integration: [396, 432, 528]
    },
    targetBpm: {
      arrival: 68,
      grounding: 74,
      build: 92,
      peak: 108,
      release: 82,
      integration: 66
    }
  },
  tribal_rise: {
    id: 'tribal_rise',
    name: 'Tribal Rise',
    description: 'Rhythmic and grounded rise with a dynamic crest.',
    phasePlan: [
      { phase: 'arrival', minutes: 5 },
      { phase: 'grounding', minutes: 7 },
      { phase: 'build', minutes: 18 },
      { phase: 'peak', minutes: 14 },
      { phase: 'release', minutes: 7 },
      { phase: 'integration', minutes: 7 }
    ],
    baseFrequencies: {
      arrival: [396, 417],
      grounding: [396, 417, 528],
      build: [417, 528, 639],
      peak: [528, 639, 741, 852],
      release: [417, 528, 639],
      integration: [396, 432]
    },
    targetBpm: {
      arrival: 72,
      grounding: 82,
      build: 102,
      peak: 118,
      release: 88,
      integration: 70
    }
  },
  cathartic_arc: {
    id: 'cathartic_arc',
    name: 'Cathartic Arc',
    description: 'Long tension and release arc with stronger emotional crest.',
    phasePlan: [
      { phase: 'arrival', minutes: 5 },
      { phase: 'grounding', minutes: 8 },
      { phase: 'build', minutes: 20 },
      { phase: 'peak', minutes: 16 },
      { phase: 'release', minutes: 8 },
      { phase: 'integration', minutes: 7 }
    ],
    baseFrequencies: {
      arrival: [396, 432],
      grounding: [396, 417, 528],
      build: [417, 528, 639, 741],
      peak: [528, 639, 741, 852],
      release: [417, 528, 639],
      integration: [396, 432, 528]
    },
    targetBpm: {
      arrival: 70,
      grounding: 80,
      build: 104,
      peak: 122,
      release: 90,
      integration: 68
    }
  },
  integration_heavy: {
    id: 'integration_heavy',
    name: 'Integration Heavy',
    description: 'Extended landing and deep closing for gentle nervous-system reset.',
    phasePlan: [
      { phase: 'arrival', minutes: 6 },
      { phase: 'grounding', minutes: 8 },
      { phase: 'build', minutes: 12 },
      { phase: 'peak', minutes: 8 },
      { phase: 'release', minutes: 10 },
      { phase: 'integration', minutes: 16 }
    ],
    baseFrequencies: {
      arrival: [396, 432],
      grounding: [396, 432, 528],
      build: [417, 528, 639],
      peak: [528, 639, 741],
      release: [432, 528, 639],
      integration: [396, 432, 528, 639]
    },
    targetBpm: {
      arrival: 66,
      grounding: 74,
      build: 90,
      peak: 102,
      release: 80,
      integration: 62
    }
  }
};

const SCENE_DEFINITIONS: Record<EcstaticSceneId, EcstaticSceneDefinition> = {
  pulse_tunnel: {
    id: 'pulse_tunnel',
    name: 'Pulse Tunnel',
    description: 'Spiral corridor illusion with audio energy warp.',
    mode: 'waveform',
    baseType: 'spiral',
    layers: [
      {
        type: 'spiral',
        opacity: 0.95,
        blendMode: 'screen',
        intensity: 1.05,
        speed: 1.25,
        scale: 1.2,
        colorA: '#FCA311',
        colorB: '#14213D',
        colorC: '#0F172A'
      },
      {
        type: 'ripple',
        opacity: 0.55,
        blendMode: 'overlay',
        intensity: 0.86,
        speed: 1.18,
        scale: 1,
        colorA: '#E5E5E5',
        colorB: '#FCA311',
        colorC: '#1F2937'
      }
    ]
  },
  tribal_constellation: {
    id: 'tribal_constellation',
    name: 'Tribal Constellation',
    description: 'Particle clusters drifting through geometric rhythm.',
    mode: 'waveform',
    baseType: 'particles',
    layers: [
      {
        type: 'particles',
        opacity: 0.86,
        blendMode: 'lighter',
        intensity: 1.08,
        speed: 1.2,
        scale: 1.08,
        colorA: '#FF7D00',
        colorB: '#FFB703',
        colorC: '#0B1E2D'
      },
      {
        type: 'sacred_geometry',
        opacity: 0.62,
        blendMode: 'screen',
        intensity: 0.82,
        speed: 0.95,
        scale: 1.06,
        colorA: '#E9D8A6',
        colorB: '#EE9B00',
        colorC: '#001219'
      }
    ]
  },
  kinetic_mandala: {
    id: 'kinetic_mandala',
    name: 'Kinetic Mandala',
    description: 'Sacred geometry core with rotational parallax.',
    mode: 'waveform',
    baseType: 'mandala',
    layers: [
      {
        type: 'mandala',
        opacity: 0.92,
        blendMode: 'screen',
        intensity: 0.98,
        speed: 0.78,
        scale: 1.04,
        colorA: '#88C0D0',
        colorB: '#B48EAD',
        colorC: '#2E3440'
      },
      {
        type: 'gradient',
        opacity: 0.82,
        blendMode: 'source-over',
        intensity: 0.7,
        speed: 0.65,
        scale: 1,
        colorA: '#2E3440',
        colorB: '#5E81AC',
        colorC: '#A3BE8C'
      }
    ]
  },
  liquid_ripple_field: {
    id: 'liquid_ripple_field',
    name: 'Liquid Ripple Field',
    description: 'Fluid ripple bursts with bass-driven distortion.',
    mode: 'waveform',
    baseType: 'ripple',
    layers: [
      {
        type: 'ripple',
        opacity: 0.92,
        blendMode: 'overlay',
        intensity: 1.1,
        speed: 1.06,
        scale: 1.18,
        colorA: '#73D2DE',
        colorB: '#2A9D8F',
        colorC: '#0B132B'
      },
      {
        type: 'gradient',
        opacity: 0.7,
        blendMode: 'source-over',
        intensity: 0.62,
        speed: 0.58,
        scale: 1,
        colorA: '#0B132B',
        colorB: '#1C2541',
        colorC: '#5BC0BE'
      }
    ]
  },
  ember_rain: {
    id: 'ember_rain',
    name: 'Ember Rain',
    description: 'Descending warm particles ideal for release phases.',
    mode: 'waveform',
    baseType: 'particles',
    layers: [
      {
        type: 'particles',
        opacity: 0.74,
        blendMode: 'lighter',
        intensity: 0.82,
        speed: 0.62,
        scale: 0.9,
        colorA: '#E76F51',
        colorB: '#F4A261',
        colorC: '#1A1A1D'
      },
      {
        type: 'gradient',
        opacity: 0.9,
        blendMode: 'source-over',
        intensity: 0.56,
        speed: 0.48,
        scale: 1,
        colorA: '#1A1A1D',
        colorB: '#3A2E39',
        colorC: '#9A8C98'
      }
    ]
  },
  body_echo_trails: {
    id: 'body_echo_trails',
    name: 'Body Echo Trails',
    description: 'Waveform ribbons with trailing temporal blur.',
    mode: 'waveform',
    baseType: 'waveform',
    layers: [
      {
        type: 'waveform',
        opacity: 0.86,
        blendMode: 'screen',
        intensity: 1.12,
        speed: 1.06,
        scale: 1.16,
        colorA: '#F72585',
        colorB: '#4CC9F0',
        colorC: '#1F2041'
      },
      {
        type: 'spiral',
        opacity: 0.44,
        blendMode: 'soft-light',
        intensity: 0.7,
        speed: 0.76,
        scale: 1,
        colorA: '#4CC9F0',
        colorB: '#F72585',
        colorC: '#10002B'
      }
    ]
  },
  prism_bloom: {
    id: 'prism_bloom',
    name: 'Prism Bloom',
    description: 'Bursting gradient prism that reacts to transients.',
    mode: 'waveform',
    baseType: 'gradient',
    layers: [
      {
        type: 'gradient',
        opacity: 0.96,
        blendMode: 'source-over',
        intensity: 1.1,
        speed: 1.2,
        scale: 1.18,
        colorA: '#7B2CBF',
        colorB: '#C77DFF',
        colorC: '#3C096C'
      },
      {
        type: 'ripple',
        opacity: 0.58,
        blendMode: 'overlay',
        intensity: 0.88,
        speed: 1.15,
        scale: 1.08,
        colorA: '#9D4EDD',
        colorB: '#E0AAFF',
        colorC: '#10002B'
      }
    ]
  },
  void_breath_orb: {
    id: 'void_breath_orb',
    name: 'Void Breath Orb',
    description: 'Minimal low-motion orb with calm breathing pulse.',
    mode: 'three',
    baseType: 'particles',
    layers: [
      {
        type: 'particles',
        opacity: 0.64,
        blendMode: 'screen',
        intensity: 0.66,
        speed: 0.48,
        scale: 0.82,
        colorA: '#A8DADC',
        colorB: '#457B9D',
        colorC: '#1D3557'
      }
    ]
  }
};

const SCENE_PACKS: Record<EcstaticVisualPack, EcstaticSceneId[]> = {
  organic: ['kinetic_mandala', 'liquid_ripple_field', 'ember_rain', 'void_breath_orb'],
  tribal: ['tribal_constellation', 'pulse_tunnel', 'body_echo_trails', 'ember_rain'],
  cosmic: ['prism_bloom', 'pulse_tunnel', 'body_echo_trails', 'void_breath_orb'],
  minimal: ['void_breath_orb', 'kinetic_mandala', 'liquid_ripple_field']
};

const PHASE_SCENE_DEFAULTS: Record<EcstaticPhase, EcstaticSceneId> = {
  arrival: 'void_breath_orb',
  grounding: 'kinetic_mandala',
  build: 'pulse_tunnel',
  peak: 'tribal_constellation',
  release: 'liquid_ripple_field',
  integration: 'ember_rain'
};

function clamp01(value: number) {
  return clamp(0.1, value, 2);
}

function scaleLayerPreset(
  layer: EcstaticSceneLayerPreset,
  sceneId: EcstaticSceneId,
  index: number,
  intensityScale: number,
  speedScale: number
): VisualizationLayerConfig {
  return {
    id: `${sceneId}-${index}`,
    type: layer.type,
    enabled: true,
    opacity: clamp(0.08, layer.opacity, 1),
    blendMode: layer.blendMode,
    intensity: clamp(0.1, layer.intensity * intensityScale, 1.5),
    speed: clamp(0.1, layer.speed * speedScale, 2.5),
    scale: clamp(0.35, layer.scale, 2),
    colorA: layer.colorA,
    colorB: layer.colorB,
    colorC: layer.colorC
  };
}

export const DEFAULT_ECSTATIC_SETUP: EcstaticSessionSetupDraft = {
  templateId: 'gentle_wave',
  durationMinutes: 60,
  automationLevel: 'assisted',
  visualPack: 'organic'
};

export function getEcstaticTemplates() {
  return Object.values(TEMPLATES) as EcstaticTemplate[];
}

export function getEcstaticTemplate(templateId: EcstaticTemplateId) {
  return TEMPLATES[templateId] ?? TEMPLATES.gentle_wave;
}

export function getEcstaticScene(sceneId: EcstaticSceneId) {
  return SCENE_DEFINITIONS[sceneId];
}

export function getEcstaticScenes() {
  return Object.values(SCENE_DEFINITIONS) as EcstaticSceneDefinition[];
}

export function getEcstaticScenePack(pack: EcstaticVisualPack) {
  return SCENE_PACKS[pack] ?? SCENE_PACKS.organic;
}

export function getDefaultSceneForPhase(phase: EcstaticPhase) {
  return PHASE_SCENE_DEFAULTS[phase];
}

export function buildSceneRuntime(options: {
  sceneId: EcstaticSceneId;
  intensityScale: number;
  speedScale: number;
}): EcstaticSceneRuntime {
  const scene = SCENE_DEFINITIONS[options.sceneId] ?? SCENE_DEFINITIONS.kinetic_mandala;
  const intensityScale = clamp01(options.intensityScale);
  const speedScale = clamp01(options.speedScale);
  const layers = scene.layers.map((layer, index) =>
    scaleLayerPreset(layer, scene.id, index, intensityScale, speedScale)
  );

  return {
    id: scene.id,
    mode: scene.mode,
    baseType: scene.baseType ?? layers[0]?.type ?? 'particles',
    layers
  };
}

export function buildPhasePlanTimeline(template: EcstaticTemplate, durationMinutes: number) {
  const totalBaseMinutes = template.phasePlan.reduce((sum, item) => sum + item.minutes, 0);
  const target = clamp(20, durationMinutes, 120);

  return template.phasePlan.map((item) => {
    const ratio = totalBaseMinutes > 0 ? item.minutes / totalBaseMinutes : 1 / template.phasePlan.length;
    const scaledMinutes = Math.max(1, Math.round(target * ratio));
    return {
      ...item,
      minutes: scaledMinutes,
      seconds: scaledMinutes * 60
    };
  });
}

export function sceneChangeEvent(from: EcstaticSceneId | null, to: EcstaticSceneId, transition: EcstaticTransitionType): EcstaticSceneChangeEvent {
  return {
    at: new Date().toISOString(),
    from,
    to,
    transition
  };
}

export function defaultSceneTransition() {
  return DEFAULT_TRANSITION;
}
