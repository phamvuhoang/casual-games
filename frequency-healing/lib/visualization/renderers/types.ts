export interface RenderFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  waveformData: Uint8Array;
  frequencyData: Uint8Array;
  time: number;
  delta: number;
}

export interface VisualizationRenderer {
  render(frame: RenderFrame): void;
}
