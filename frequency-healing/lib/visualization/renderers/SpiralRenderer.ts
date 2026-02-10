import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

const ARM_COUNT = 4;
const POINTS_PER_ARM = 170;

export class SpiralRenderer implements VisualizationRenderer {
  render({ ctx, width, height, frequencyData, energy, time, layer }: RenderFrame) {
    const intensity = layer?.intensity ?? 1;
    const speed = layer?.speed ?? 1;
    const scale = layer?.scale ?? 1;
    const colorA = layer?.colorA ?? '#de443b';
    const colorB = layer?.colorB ?? '#006bb4';
    const colorC = layer?.colorC ?? '#162325';

    ctx.fillStyle = `${colorC}24`;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radiusLimit = Math.min(width, height) * 0.52 * scale;
    const spin = time * 0.00022 * speed;

    for (let arm = 0; arm < ARM_COUNT; arm += 1) {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, `${colorA}c8`);
      gradient.addColorStop(1, `${colorB}c8`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2 + intensity * 1.6 + energy * 2;
      ctx.beginPath();

      for (let i = 0; i < POINTS_PER_ARM; i += 1) {
        const t = i / (POINTS_PER_ARM - 1);
        const dataIndex = Math.floor(t * (frequencyData.length - 1));
        const localEnergy = (frequencyData[dataIndex] ?? 0) / 255;
        const radius = radiusLimit * t * (0.45 + intensity * 0.6 + localEnergy * 0.25);
        const angle =
          spin +
          arm * (Math.PI / 2) +
          t * Math.PI * (6.2 + intensity * 4) +
          localEnergy * 0.7;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusLimit * 0.55);
    halo.addColorStop(0, `${colorA}45`);
    halo.addColorStop(1, `${colorA}00`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusLimit * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}
