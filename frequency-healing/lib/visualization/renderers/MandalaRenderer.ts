import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

export class MandalaRenderer implements VisualizationRenderer {
  render({ ctx, width, height, frequencyData, time, energy, layer }: RenderFrame) {
    const intensity = layer?.intensity ?? 1;
    const speed = layer?.speed ?? 1;
    const scale = layer?.scale ?? 1;
    const primary = layer?.colorA ?? '#6a92c2';
    const secondary = layer?.colorB ?? '#8f7adb';

    ctx.fillStyle = '#1720341f';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.18 * scale;
    const maxRadius = Math.min(width, height) * 0.43 * scale;
    const petals = 32;
    const rotation = time * 0.00035 * speed;

    for (let i = 0; i < petals; i += 1) {
      const amplitude = frequencyData[i] / 255;
      const radius = baseRadius + amplitude * (maxRadius - baseRadius) * (0.8 + intensity * 0.5);
      const angle = (i / petals) * Math.PI * 2 + rotation;

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.strokeStyle = `${primary}${Math.round((0.12 + amplitude * 0.66 + energy * 0.2) * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.lineWidth = 0.8 + amplitude * 2.7;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = `${secondary}${Math.round((0.14 + amplitude * 0.5 + energy * 0.2) * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + amplitude * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = `${secondary}6b`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * (0.58 + energy * 0.2), 0, Math.PI * 2);
    ctx.stroke();
  }
}
