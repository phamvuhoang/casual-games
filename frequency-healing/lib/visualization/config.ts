import type { Json } from '@/lib/supabase/types';

export type BaseVisualizationType =
  | 'waveform'
  | 'particles'
  | 'mandala'
  | 'spiral'
  | 'gradient'
  | 'ripple'
  | 'sacred_geometry';

export type VisualizerType = BaseVisualizationType | 'multi-layer' | 'orbital';

export type LayerBlendMode =
  | 'source-over'
  | 'screen'
  | 'overlay'
  | 'lighter'
  | 'multiply'
  | 'soft-light';

export interface VisualizationLayerConfig {
  id: string;
  type: BaseVisualizationType;
  enabled: boolean;
  opacity: number;
  blendMode: LayerBlendMode;
  intensity: number;
  speed: number;
  scale: number;
  colorA: string;
  colorB: string;
  colorC: string;
}

const DEFAULT_LAYER: Record<BaseVisualizationType, Omit<VisualizationLayerConfig, 'id'>> = {
  waveform: {
    type: 'waveform',
    enabled: true,
    opacity: 1,
    blendMode: 'source-over',
    intensity: 0.75,
    speed: 1,
    scale: 1,
    colorA: '#8f7adb',
    colorB: '#6a92c2',
    colorC: '#172034'
  },
  particles: {
    type: 'particles',
    enabled: true,
    opacity: 0.84,
    blendMode: 'lighter',
    intensity: 0.82,
    speed: 1,
    scale: 1,
    colorA: '#8f7adb',
    colorB: '#b9ccc4',
    colorC: '#6a92c2'
  },
  mandala: {
    type: 'mandala',
    enabled: true,
    opacity: 0.92,
    blendMode: 'screen',
    intensity: 0.8,
    speed: 0.8,
    scale: 1,
    colorA: '#6a92c2',
    colorB: '#8f7adb',
    colorC: '#eee0d1'
  },
  spiral: {
    type: 'spiral',
    enabled: true,
    opacity: 0.94,
    blendMode: 'screen',
    intensity: 0.9,
    speed: 1.2,
    scale: 1,
    colorA: '#8f7adb',
    colorB: '#6a92c2',
    colorC: '#172034'
  },
  gradient: {
    type: 'gradient',
    enabled: true,
    opacity: 1,
    blendMode: 'source-over',
    intensity: 0.82,
    speed: 0.62,
    scale: 1,
    colorA: '#6a92c2',
    colorB: '#8f7adb',
    colorC: '#b9ccc4'
  },
  ripple: {
    type: 'ripple',
    enabled: true,
    opacity: 0.86,
    blendMode: 'overlay',
    intensity: 0.76,
    speed: 1,
    scale: 1,
    colorA: '#eee0d1',
    colorB: '#6a92c2',
    colorC: '#b9ccc4'
  },
  sacred_geometry: {
    type: 'sacred_geometry',
    enabled: true,
    opacity: 0.88,
    blendMode: 'screen',
    intensity: 0.88,
    speed: 0.72,
    scale: 1,
    colorA: '#8f7adb',
    colorB: '#6a92c2',
    colorC: '#eee0d1'
  }
};

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toColor(value: unknown, fallback: string) {
  if (typeof value === 'string' && COLOR_PATTERN.test(value)) {
    return value;
  }
  return fallback;
}

function toObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toType(value: unknown, fallback: BaseVisualizationType): BaseVisualizationType {
  const allowed: BaseVisualizationType[] = [
    'waveform',
    'particles',
    'mandala',
    'spiral',
    'gradient',
    'ripple',
    'sacred_geometry'
  ];
  if (typeof value === 'string' && allowed.includes(value as BaseVisualizationType)) {
    return value as BaseVisualizationType;
  }
  return fallback;
}

function toBlend(value: unknown, fallback: LayerBlendMode): LayerBlendMode {
  const allowed: LayerBlendMode[] = ['source-over', 'screen', 'overlay', 'lighter', 'multiply', 'soft-light'];
  if (typeof value === 'string' && allowed.includes(value as LayerBlendMode)) {
    return value as LayerBlendMode;
  }
  return fallback;
}

export function createVisualizationLayer(type: BaseVisualizationType): VisualizationLayerConfig {
  const preset = DEFAULT_LAYER[type];
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    ...preset
  };
}

export function createDefaultVisualizationLayers(): VisualizationLayerConfig[] {
  return [createVisualizationLayer('sacred_geometry'), createVisualizationLayer('gradient')];
}

export function createLayersForType(type: VisualizerType): VisualizationLayerConfig[] {
  if (type === 'multi-layer') {
    return createDefaultVisualizationLayers();
  }

  if (type === 'orbital') {
    return [createVisualizationLayer('particles')];
  }

  return [createVisualizationLayer(type as BaseVisualizationType)];
}

export function normalizeVisualizationLayers(
  raw: Json | null | undefined,
  fallbackType: VisualizerType = 'waveform'
): VisualizationLayerConfig[] {
  const fallback = createLayersForType(fallbackType);

  if (!raw) {
    return fallback;
  }

  const object = toObject(raw);
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(object?.layers)
      ? object.layers
      : null;

  if (!source || source.length === 0) {
    return fallback;
  }

  const layers = source
    .map((entry, index) => {
      const item = toObject(entry);
      if (!item) {
        return null;
      }

      const type = toType(item.type, 'waveform');
      const preset = DEFAULT_LAYER[type];
      return {
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `${type}-${index}`,
        type,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : preset.enabled,
        opacity: clamp(0.08, typeof item.opacity === 'number' ? item.opacity : preset.opacity, 1),
        blendMode: toBlend(item.blendMode, preset.blendMode),
        intensity: clamp(0.1, typeof item.intensity === 'number' ? item.intensity : preset.intensity, 1.5),
        speed: clamp(0.1, typeof item.speed === 'number' ? item.speed : preset.speed, 2.5),
        scale: clamp(0.35, typeof item.scale === 'number' ? item.scale : preset.scale, 2),
        colorA: toColor(item.colorA, preset.colorA),
        colorB: toColor(item.colorB, preset.colorB),
        colorC: toColor(item.colorC, preset.colorC)
      } satisfies VisualizationLayerConfig;
    })
    .filter((value): value is VisualizationLayerConfig => Boolean(value));

  return layers.length > 0 ? layers : fallback;
}

export function toVisualizationLayersPayload(layers: VisualizationLayerConfig[]) {
  return {
    version: 1,
    layers: layers.map((layer) => ({ ...layer }))
  } as unknown as Json;
}
