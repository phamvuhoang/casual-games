import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

const BASE_PARTICLE_COUNT = 120;

export class ParticleRenderer implements VisualizationRenderer {
  private positionsX = new Float32Array(BASE_PARTICLE_COUNT);
  private positionsY = new Float32Array(BASE_PARTICLE_COUNT);
  private velocitiesX = new Float32Array(BASE_PARTICLE_COUNT);
  private velocitiesY = new Float32Array(BASE_PARTICLE_COUNT);
  private seeds = new Float32Array(BASE_PARTICLE_COUNT);
  private initialized = false;

  private ensureInitialized() {
    if (this.initialized) {
      return;
    }

    for (let i = 0; i < BASE_PARTICLE_COUNT; i += 1) {
      this.positionsX[i] = Math.random();
      this.positionsY[i] = Math.random();
      this.velocitiesX[i] = (Math.random() - 0.5) * 0.16;
      this.velocitiesY[i] = 0.15 + Math.random() * 0.42;
      this.seeds[i] = Math.random();
    }

    this.initialized = true;
  }

  render({ ctx, width, height, frequencyData, energy, delta, time, layer }: RenderFrame) {
    this.ensureInitialized();

    const intensity = layer?.intensity ?? 1;
    const speed = layer?.speed ?? 1;
    const scale = layer?.scale ?? 1;
    const colorA = layer?.colorA ?? '#8f7adb';
    const colorB = layer?.colorB ?? '#6a92c2';
    const colorC = layer?.colorC ?? '#eee0d1';

    ctx.fillStyle = `${colorC}18`;
    ctx.fillRect(0, 0, width, height);

    const dt = Math.min(32, Math.max(8, delta || 16));
    const motion = (dt / 16) * speed;
    const audioBurst = 0.55 + energy * intensity * 1.6;
    const activeCount = Math.round(BASE_PARTICLE_COUNT * Math.min(1, 0.4 + intensity * 0.7));

    for (let i = 0; i < activeCount; i += 1) {
      const frequencyIndex = Math.floor((i / activeCount) * frequencyData.length);
      const localEnergy = (frequencyData[frequencyIndex] ?? 0) / 255;
      const burst = 0.75 + localEnergy * audioBurst;

      this.positionsY[i] -= this.velocitiesY[i] * motion * burst * 0.0045;
      this.positionsX[i] += this.velocitiesX[i] * motion * 0.0042;

      const drift = Math.sin(time * 0.0004 * speed + this.seeds[i] * Math.PI * 2) * 0.0008 * intensity;
      this.positionsX[i] += drift;

      if (this.positionsY[i] < -0.15) {
        this.positionsY[i] = 1.12;
        this.positionsX[i] = Math.random();
      }

      if (this.positionsX[i] < -0.1) {
        this.positionsX[i] = 1.12;
      } else if (this.positionsX[i] > 1.12) {
        this.positionsX[i] = -0.12;
      }

      const x = this.positionsX[i] * width;
      const y = this.positionsY[i] * height;
      const radius = (2 + this.seeds[i] * 3.4) * scale * (0.55 + burst * 0.8);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
      const alphaCore = Math.min(0.86, 0.22 + localEnergy * 0.62);
      gradient.addColorStop(0, `${colorA}${Math.round(alphaCore * 255)
        .toString(16)
        .padStart(2, '0')}`);
      gradient.addColorStop(0.65, `${colorB}80`);
      gradient.addColorStop(1, `${colorB}00`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
