import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
}

export class ParticleRenderer implements VisualizationRenderer {
  private particles: Particle[] = [];

  constructor(count = 60) {
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 1 + Math.random() * 3,
      speed: 0.15 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 0.3
    }));
  }

  render({ ctx, width, height, frequencyData, delta }: RenderFrame) {
    ctx.fillStyle = 'rgba(22, 31, 34, 0.15)';
    ctx.fillRect(0, 0, width, height);

    const energy = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
    const energyScale = 1 + energy / 180;

    this.particles.forEach((particle) => {
      particle.y -= particle.speed * (delta / 16) * energyScale;
      particle.x += particle.drift * (delta / 16);

      if (particle.y < -0.1) {
        particle.y = 1.1;
        particle.x = Math.random();
      }

      if (particle.x < -0.1) {
        particle.x = 1.1;
      }

      if (particle.x > 1.1) {
        particle.x = -0.1;
      }

      const x = particle.x * width;
      const y = particle.y * height;
      const radius = particle.radius * energyScale;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      gradient.addColorStop(0, 'rgba(247, 179, 106, 0.7)');
      gradient.addColorStop(1, 'rgba(247, 179, 106, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
