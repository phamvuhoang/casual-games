import type { VisualizationRenderer } from '@/lib/visualization/renderers/types';

export class VisualizationEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private analyser: AnalyserNode;
  private renderer: VisualizationRenderer;
  private animationId: number | null = null;
  private lastTime = 0;
  private waveformData: Uint8Array<ArrayBuffer>;
  private frequencyData: Uint8Array<ArrayBuffer>;

  constructor(canvas: HTMLCanvasElement, analyser: AnalyserNode, renderer: VisualizationRenderer) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable');
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.analyser = analyser;
    this.renderer = renderer;
    this.waveformData = new Uint8Array<ArrayBuffer>(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.frequencyData = new Uint8Array<ArrayBuffer>(new ArrayBuffer(this.analyser.frequencyBinCount));

    this.resize();
  }

  setRenderer(renderer: VisualizationRenderer) {
    this.renderer = renderer;
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * ratio);
    this.canvas.height = Math.floor(height * ratio);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);
  }

  start() {
    if (this.animationId) {
      return;
    }

    const draw = (time: number) => {
      this.animationId = requestAnimationFrame(draw);
      const delta = this.lastTime ? time - this.lastTime : 0;
      this.lastTime = time;

      this.analyser.getByteTimeDomainData(this.waveformData);
      this.analyser.getByteFrequencyData(this.frequencyData);

      const width = this.canvas.getBoundingClientRect().width;
      const height = this.canvas.getBoundingClientRect().height;

      this.ctx.clearRect(0, 0, width, height);
      this.renderer.render({
        ctx: this.ctx,
        width,
        height,
        waveformData: this.waveformData,
        frequencyData: this.frequencyData,
        time,
        delta
      });
    };

    this.animationId = requestAnimationFrame(draw);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
