import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

interface Orb {
  radius: number;
  speed: number;
  phase: number;
  orbit: number;
}

const ORBS: Orb[] = [
  { radius: 0.24, speed: 0.00012, phase: 0.2, orbit: 0.22 },
  { radius: 0.28, speed: 0.00016, phase: 1.1, orbit: 0.26 },
  { radius: 0.22, speed: -0.00009, phase: 2.4, orbit: 0.2 },
  { radius: 0.31, speed: -0.00013, phase: 3.2, orbit: 0.3 },
  { radius: 0.25, speed: 0.0001, phase: 4.1, orbit: 0.24 }
];

export class GradientRenderer implements VisualizationRenderer {
  render({ ctx, width, height, energy, time, layer }: RenderFrame) {
    const intensity = layer?.intensity ?? 1;
    const speed = layer?.speed ?? 1;
    const scale = layer?.scale ?? 1;
    const colorA = layer?.colorA ?? '#2b8c8c';
    const colorB = layer?.colorB ?? '#f7b36a';
    const colorC = layer?.colorC ?? '#a6d3c8';

    const baseGradient = ctx.createLinearGradient(0, 0, width, height);
    baseGradient.addColorStop(0, `${colorA}90`);
    baseGradient.addColorStop(0.55, `${colorC}88`);
    baseGradient.addColorStop(1, `${colorB}8f`);
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    ORBS.forEach((orb, index) => {
      const theta = time * orb.speed * speed + orb.phase;
      const orbitX = (Math.cos(theta) * width * orb.orbit * scale) / 2;
      const orbitY = (Math.sin(theta * 1.3) * height * orb.orbit * scale) / 2;
      const x = centerX + orbitX;
      const y = centerY + orbitY;
      const radius = Math.min(width, height) * orb.radius * (0.65 + intensity * 0.6 + energy * 0.5);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const orbColor = index % 2 === 0 ? colorA : colorB;
      const tailColor = index % 2 === 0 ? colorB : colorC;
      gradient.addColorStop(0, `${orbColor}b0`);
      gradient.addColorStop(0.6, `${tailColor}58`);
      gradient.addColorStop(1, `${tailColor}00`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
