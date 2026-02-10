import type { VisualizationLayerConfig } from '@/lib/visualization/config';

export interface RenderFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  waveformData: Uint8Array;
  frequencyData: Uint8Array;
  energy: number;
  time: number;
  delta: number;
  layer?: VisualizationLayerConfig;
}

export interface VisualizationRenderer {
  render(frame: RenderFrame): void;
  dispose?(): void;
}
