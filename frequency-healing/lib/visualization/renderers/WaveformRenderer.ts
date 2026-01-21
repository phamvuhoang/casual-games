import type { RenderFrame, VisualizationRenderer } from '@/lib/visualization/renderers/types';

export class WaveformRenderer implements VisualizationRenderer {
  render({ ctx, width, height, waveformData }: RenderFrame) {
    ctx.fillStyle = 'rgba(20, 27, 30, 0.18)';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f7b36a';
    ctx.beginPath();

    const sliceWidth = width / waveformData.length;
    let x = 0;

    for (let i = 0; i < waveformData.length; i += 1) {
      const v = waveformData[i] / 128.0;
      const y = (v * height) / 2;

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
    ctx.strokeStyle = 'rgba(43, 140, 140, 0.6)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
}
