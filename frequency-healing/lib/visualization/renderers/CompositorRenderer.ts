import type { BaseVisualizationType, VisualizationLayerConfig } from '@/lib/visualization/config';
import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';
import { GradientRenderer } from '@/lib/visualization/renderers/GradientRenderer';
import { MandalaRenderer } from '@/lib/visualization/renderers/MandalaRenderer';
import { ParticleRenderer } from '@/lib/visualization/renderers/ParticleRenderer';
import { RippleRenderer } from '@/lib/visualization/renderers/RippleRenderer';
import { SacredGeometryRenderer } from '@/lib/visualization/renderers/SacredGeometryRenderer';
import { SpiralRenderer } from '@/lib/visualization/renderers/SpiralRenderer';
import { WaveformRenderer } from '@/lib/visualization/renderers/WaveformRenderer';

function createRenderer(type: BaseVisualizationType): VisualizationRenderer {
  if (type === 'particles') {
    return new ParticleRenderer();
  }

  if (type === 'mandala') {
    return new MandalaRenderer();
  }

  if (type === 'spiral') {
    return new SpiralRenderer();
  }

  if (type === 'gradient') {
    return new GradientRenderer();
  }

  if (type === 'ripple') {
    return new RippleRenderer();
  }

  if (type === 'sacred_geometry') {
    return new SacredGeometryRenderer();
  }

  return new WaveformRenderer();
}

export class CompositorRenderer implements VisualizationRenderer {
  private layers: VisualizationLayerConfig[] = [];
  private renderers = new Map<string, VisualizationRenderer>();

  setLayers(nextLayers: VisualizationLayerConfig[]) {
    const nextIds = new Set(nextLayers.map((layer) => layer.id));
    for (const [id, renderer] of this.renderers.entries()) {
      if (!nextIds.has(id)) {
        renderer.dispose?.();
        this.renderers.delete(id);
      }
    }

    this.layers = nextLayers.map((layer) => ({ ...layer }));
  }

  render(frame: RenderFrame) {
    if (this.layers.length === 0) {
      return;
    }

    for (const layer of this.layers) {
      if (!layer.enabled || layer.opacity <= 0) {
        continue;
      }

      const renderer = this.getRenderer(layer);
      frame.ctx.save();
      frame.ctx.globalAlpha = Math.min(1, Math.max(0.01, layer.opacity));
      frame.ctx.globalCompositeOperation = layer.blendMode;
      renderer.render({ ...frame, layer });
      frame.ctx.restore();
    }
  }

  dispose() {
    for (const renderer of this.renderers.values()) {
      renderer.dispose?.();
    }
    this.renderers.clear();
  }

  private getRenderer(layer: VisualizationLayerConfig) {
    const existing = this.renderers.get(layer.id);
    if (existing) {
      return existing;
    }

    const created = createRenderer(layer.type);
    this.renderers.set(layer.id, created);
    return created;
  }
}
