import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

const RIPPLES = 8;

export class RippleRenderer implements VisualizationRenderer {
  render({ ctx, width, height, energy, time, layer }: RenderFrame) {
    const intensity = layer?.intensity ?? 1;
    const speed = layer?.speed ?? 1;
    const scale = layer?.scale ?? 1;
    const colorA = layer?.colorA ?? '#f8dcb3';
    const colorB = layer?.colorB ?? '#2b8c8c';
    const colorC = layer?.colorC ?? '#f7b36a';

    ctx.fillStyle = `${colorB}16`;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.55 * scale;

    for (let i = 0; i < RIPPLES; i += 1) {
      const progress = ((time * 0.00025 * speed + i / RIPPLES) % 1 + 1) % 1;
      const eased = 1 - (1 - progress) * (1 - progress);
      const radius = maxRadius * eased;
      const alpha = (1 - progress) * (0.22 + energy * 0.5) * intensity;

      ctx.strokeStyle = `${i % 2 === 0 ? colorA : colorC}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.lineWidth = 1 + (1 - progress) * 6 * intensity;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.45);
    glow.addColorStop(0, `${colorB}64`);
    glow.addColorStop(1, `${colorB}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}
