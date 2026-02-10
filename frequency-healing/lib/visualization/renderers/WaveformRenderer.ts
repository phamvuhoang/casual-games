import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

export class WaveformRenderer implements VisualizationRenderer {
  render({ ctx, width, height, waveformData, energy, layer }: RenderFrame) {
    const intensity = layer?.intensity ?? 1;
    const primary = layer?.colorA ?? '#f7b36a';
    const secondary = layer?.colorB ?? '#2b8c8c';
    const tertiary = layer?.colorC ?? '#162325';

    ctx.fillStyle = `${tertiary}22`;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1.6 + intensity * 1.5 + energy * 2;
    ctx.strokeStyle = primary;
    ctx.beginPath();

    const sliceWidth = width / waveformData.length;
    let x = 0;

    for (let i = 0; i < waveformData.length; i += 1) {
      const v = waveformData[i] / 128.0;
      const baseline = height / 2;
      const y = baseline + (v - 1) * baseline * (0.85 + energy * 0.3) * intensity;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = `${secondary}a8`;
    ctx.lineWidth = 1;
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
}
