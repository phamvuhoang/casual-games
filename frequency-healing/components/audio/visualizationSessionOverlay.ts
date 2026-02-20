import type { BinauralConfig, ModulationConfig, RhythmConfig, SweepConfig } from '@/lib/audio/audioConfig';
import type { MixStyle } from '@/lib/audio/mixProfiles';

export interface VisualizationSessionOverlayData {
  title: string;
  frequencies: Array<{
    frequency: number;
    gain: number;
  }>;
  mixStyle: MixStyle;
  waveform: string;
  rhythm: RhythmConfig;
  modulation: ModulationConfig;
  sweep: SweepConfig;
  binaural: BinauralConfig;
}

export interface BreathGuideOverlayData {
  phase: 'inhale' | 'exhale';
  phaseProgress: number;
  coherenceScore: number;
  breathBpm: number;
  targetBpm: number;
}

function formatFrequency(value: number) {
  return `${Math.round(value * 100) / 100}Hz`;
}

function formatPattern(steps: boolean[]) {
  const compact = steps.map((step) => (step ? '1' : '0')).join('');
  if (compact.length <= 8) {
    return compact;
  }

  const segments: string[] = [];
  for (let index = 0; index < compact.length; index += 4) {
    segments.push(compact.slice(index, index + 4));
  }
  return segments.join(' ');
}

export function getSessionOverlayLines(data: VisualizationSessionOverlayData): string[] {
  const lines: string[] = [];
  const cleanTitle = data.title.trim() || 'Untitled Session';

  const stackEntries = data.frequencies.slice(0, 6).map((entry) => {
    const gain = Math.round(Math.max(0, Math.min(1, entry.gain)) * 100);
    return `${formatFrequency(entry.frequency)} (${gain}%)`;
  });

  const hiddenCount = Math.max(0, data.frequencies.length - stackEntries.length);

  lines.push(`Session: ${cleanTitle}`);
  lines.push(`Waveform: ${data.waveform} | Mix: ${data.mixStyle === 'manual' ? 'manual' : 'golden ladder'}`);
  lines.push(
    `Stack: ${stackEntries.length > 0 ? stackEntries.join(' • ') : 'none'}${hiddenCount > 0 ? ` +${hiddenCount}` : ''}`
  );

  if (data.rhythm.enabled) {
    lines.push(
      `Rhythm: on | ${Math.round(data.rhythm.bpm)} BPM | ${data.rhythm.subdivision} | ${formatPattern(data.rhythm.steps)}`
    );
  } else {
    lines.push('Rhythm: off');
  }

  if (data.modulation.enabled) {
    lines.push(
      `Modulation: on | ${data.modulation.waveform} ${Math.round(data.modulation.rateHz * 100) / 100}Hz | depth ${
        Math.round(data.modulation.depthHz * 10) / 10
      }Hz`
    );
  } else {
    lines.push('Modulation: off');
  }

  if (data.sweep.enabled) {
    lines.push(
      `Sweep: on | target ${formatFrequency(data.sweep.targetHz)} | ${Math.round(data.sweep.durationSeconds)}s ${
        data.sweep.curve
      }`
    );
  } else {
    lines.push('Sweep: off');
  }

  if (data.binaural.enabled) {
    lines.push(
      `Binaural: on | beat ${Math.round(data.binaural.beatHz * 10) / 10}Hz | spread ${Math.round(
        data.binaural.panSpread * 100
      )}%`
    );
  }

  return lines;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.max(2, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ');
  const wrapped: string[] = [];
  let line = '';

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
      continue;
    }

    if (line) {
      wrapped.push(line);
      line = word;
    } else {
      wrapped.push(word);
    }
  }

  if (line) {
    wrapped.push(line);
  }

  return wrapped;
}

export function drawSessionOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
  energy: number
) {
  if (lines.length === 0) {
    return;
  }

  const padding = 12;
  const panelX = 12;
  const panelY = 12;
  const panelWidth = Math.min(width * 0.72, 560);
  const textMaxWidth = panelWidth - padding * 2;
  const lineHeight = 16;

  ctx.save();
  ctx.font = '600 12px "IBM Plex Sans", Arial, sans-serif';

  const wrappedLines = lines.flatMap((line) => wrapLine(ctx, line, textMaxWidth));
  const panelHeight = padding * 2 + wrappedLines.length * lineHeight + 4;

  const gradient = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
  gradient.addColorStop(0, `rgba(11, 16, 29, ${0.58 + Math.min(0.2, energy * 0.25)})`);
  gradient.addColorStop(1, `rgba(14, 20, 36, ${0.5 + Math.min(0.18, energy * 0.2)})`);

  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 14);
  ctx.fillStyle = gradient;
  ctx.fill();

  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 14);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(245, 249, 255, 0.94)';
  wrappedLines.forEach((line, index) => {
    const y = panelY + padding + 12 + index * lineHeight;
    ctx.fillText(line, panelX + padding, y);
  });

  ctx.restore();
}

export function drawBreathGuideOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: BreathGuideOverlayData
) {
  const phaseProgress = Math.max(0, Math.min(1, data.phaseProgress));
  const coherence = Math.max(0, Math.min(1, data.coherenceScore));
  const radiusBase = Math.max(24, Math.min(width, height) * 0.07);
  const radiusPulse = radiusBase * (0.35 + coherence * 0.45);
  const pulseProgress = data.phase === 'inhale' ? phaseProgress : 1 - phaseProgress;
  const radius = radiusBase + radiusPulse * pulseProgress;
  const x = width - radiusBase * 1.8;
  const y = height - radiusBase * 1.8;

  ctx.save();

  const haloGradient = ctx.createRadialGradient(x, y, radius * 0.25, x, y, radius * 2.3);
  haloGradient.addColorStop(0, `rgba(132, 237, 200, ${0.34 + coherence * 0.24})`);
  haloGradient.addColorStop(1, 'rgba(132, 237, 200, 0)');
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.3, 0, Math.PI * 2);
  ctx.fillStyle = haloGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = data.phase === 'inhale' ? 'rgba(150, 246, 220, 0.42)' : 'rgba(116, 198, 255, 0.34)';
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.42 + coherence * 0.35})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '600 11px "IBM Plex Sans", Arial, sans-serif';
  ctx.fillStyle = 'rgba(244, 252, 255, 0.95)';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.phase.toUpperCase()} ${Math.round(data.breathBpm * 10) / 10} BPM`, x, y + 4);

  ctx.font = '500 10px "IBM Plex Sans", Arial, sans-serif';
  ctx.fillStyle = 'rgba(240, 248, 255, 0.82)';
  ctx.fillText(
    `Coherence ${Math.round(coherence * 100)}% · Target ${Math.round(data.targetBpm * 10) / 10}`,
    x,
    y + 20
  );

  ctx.restore();
}
