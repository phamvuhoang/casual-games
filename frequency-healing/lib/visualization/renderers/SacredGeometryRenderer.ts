import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

export class SacredGeometryRenderer implements VisualizationRenderer {
  render({ ctx, width, height, frequencyData, energy, time, layer }: RenderFrame) {
    const intensity = layer?.intensity ?? 1;
    const speed = layer?.speed ?? 1;
    const scale = layer?.scale ?? 1;
    const colorA = layer?.colorA ?? '#f7b36a';
    const colorB = layer?.colorB ?? '#2b8c8c';
    const colorC = layer?.colorC ?? '#f8dcb3';

    ctx.fillStyle = '#10181a24';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.11 * scale;
    const ringRadius = baseRadius * 2;
    const rotation = time * 0.0002 * speed;

    const points: { x: number; y: number }[] = [{ x: centerX, y: centerY }];

    for (let i = 0; i < 6; i += 1) {
      const angle = rotation + (Math.PI * 2 * i) / 6;
      points.push({
        x: centerX + Math.cos(angle) * ringRadius,
        y: centerY + Math.sin(angle) * ringRadius
      });
    }

    for (let i = 0; i < 6; i += 1) {
      const angle = -rotation * 0.6 + (Math.PI * 2 * i) / 6 + Math.PI / 6;
      points.push({
        x: centerX + Math.cos(angle) * ringRadius * 1.72,
        y: centerY + Math.sin(angle) * ringRadius * 1.72
      });
    }

    points.forEach((point, index) => {
      const localEnergy = (frequencyData[(index * 17) % frequencyData.length] ?? 0) / 255;
      const radius = baseRadius * (0.65 + localEnergy * 0.85 + energy * 0.35 * intensity);
      ctx.strokeStyle = `${index % 2 === 0 ? colorA : colorB}${Math.round((0.18 + localEnergy * 0.5) * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.lineWidth = 1.1 + localEnergy * 2.3;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.strokeStyle = `${colorC}55`;
    ctx.lineWidth = 0.9 + energy * 1.2;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        if (j - i > 4 && i !== 0) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }
}
