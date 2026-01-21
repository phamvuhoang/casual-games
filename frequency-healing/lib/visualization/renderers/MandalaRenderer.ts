import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

export class MandalaRenderer implements VisualizationRenderer {
  render({ ctx, width, height, frequencyData, time }: RenderFrame) {
    ctx.fillStyle = 'rgba(15, 22, 24, 0.12)';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.22;
    const maxRadius = Math.min(width, height) * 0.45;
    const petals = 32;
    const rotation = time * 0.00035;

    for (let i = 0; i < petals; i += 1) {
      const amplitude = frequencyData[i] / 255;
      const radius = baseRadius + amplitude * (maxRadius - baseRadius);
      const angle = (i / petals) * Math.PI * 2 + rotation;

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.strokeStyle = `rgba(43, 140, 140, ${0.15 + amplitude * 0.6})`;
      ctx.lineWidth = 1 + amplitude * 3;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = `rgba(247, 179, 106, ${0.1 + amplitude * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + amplitude * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(247, 179, 106, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
