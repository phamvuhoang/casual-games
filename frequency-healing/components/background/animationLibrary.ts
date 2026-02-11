export type BackgroundAnimationId =
  | 'psychedelic_spiral'
  | 'gradient_flow'
  | 'ripple_pulse'
  | 'ethereal_shadow'
  | 'aurora_veil'
  | 'starlit_bloom';

export interface BackgroundAnimationOption {
  id: BackgroundAnimationId;
  label: string;
  description: string;
  isAudioReactive: boolean;
}

export interface AudioSnapshot {
  energy: number;
  bass: number;
  mid: number;
  treble: number;
}

export interface RenderBackgroundFrameInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  delta: number;
  audio: AudioSnapshot;
  animationId: BackgroundAnimationId;
  lowPower: boolean;
  seed: number;
}

export const BACKGROUND_ANIMATION_OPTIONS: BackgroundAnimationOption[] = [
  {
    id: 'psychedelic_spiral',
    label: 'Psychedelic Spiral',
    description: 'Hypnotic spiral arcs with gentle audio pulse.',
    isAudioReactive: true
  },
  {
    id: 'gradient_flow',
    label: 'Gradient Flow',
    description: 'Slow floating gradients and luminous orbs.',
    isAudioReactive: true
  },
  {
    id: 'ripple_pulse',
    label: 'Ripple Pulse',
    description: 'Concentric breath-like ripples expanding outward.',
    isAudioReactive: true
  },
  {
    id: 'ethereal_shadow',
    label: 'Ethereal Shadow',
    description: 'Atmospheric drifting shadow layers.',
    isAudioReactive: false
  },
  {
    id: 'aurora_veil',
    label: 'Aurora Veil',
    description: 'Vertical aurora ribbons with soft gradients.',
    isAudioReactive: true
  },
  {
    id: 'starlit_bloom',
    label: 'Starlit Bloom',
    description: 'Field of twinkling lights and ambient bloom.',
    isAudioReactive: false
  }
];

const palettes: Record<BackgroundAnimationId, [string, string, string, string]> = {
  psychedelic_spiral: ['#8f7adb', '#4f8fc0', '#c8a683', '#101425'],
  gradient_flow: ['#8ea1d5', '#9ec5c9', '#d4af92', '#111a2a'],
  ripple_pulse: ['#8f7adb', '#67a0be', '#b88f71', '#0f1424'],
  ethereal_shadow: ['#6f6aa8', '#638d9a', '#7e6d6a', '#101423'],
  aurora_veil: ['#9f8ae0', '#79acc5', '#9ec3b4', '#121a2c'],
  starlit_bloom: ['#9d8ee3', '#87adc7', '#d2b6a0', '#090d1a']
};

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function colorWithAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    return `rgba(255, 255, 255, ${clamp(0, alpha, 1)})`;
  }

  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(0, alpha, 1)})`;
}

function drawBaseGradient(ctx: CanvasRenderingContext2D, width: number, height: number, colors: [string, string, string, string], time: number) {
  const shift = (Math.sin(time * 0.00008) + 1) / 2;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorWithAlpha(colors[3], 0.95));
  gradient.addColorStop(0.45 + shift * 0.15, colorWithAlpha(colors[0], 0.34));
  gradient.addColorStop(1, colorWithAlpha(colors[1], 0.28));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawSpiral(input: RenderBackgroundFrameInput, colors: [string, string, string, string]) {
  const { ctx, width, height, time, audio, lowPower } = input;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.52;
  const armCount = lowPower ? 3 : 4;
  const points = lowPower ? 110 : 170;
  const spin = time * (0.0002 + audio.bass * 0.00035);

  drawBaseGradient(ctx, width, height, colors, time);

  for (let arm = 0; arm < armCount; arm += 1) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, colorWithAlpha(colors[0], 0.7));
    gradient.addColorStop(0.5, colorWithAlpha(colors[1], 0.65));
    gradient.addColorStop(1, colorWithAlpha(colors[2], 0.55));

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.1 + audio.energy * 4;

    for (let i = 0; i < points; i += 1) {
      const t = i / (points - 1);
      const wobble = Math.sin(t * 26 + time * 0.001 + arm) * (8 + audio.mid * 18);
      const localRadius = radius * t * (0.18 + 0.9 * t + audio.energy * 0.24) + wobble;
      const angle =
        spin +
        arm * ((Math.PI * 2) / armCount) +
        t * (Math.PI * 2) * (4.8 + audio.treble * 4 + audio.energy * 1.6);
      const x = centerX + Math.cos(angle) * localRadius;
      const y = centerY + Math.sin(angle) * localRadius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.65);
  glow.addColorStop(0, colorWithAlpha(colors[2], 0.16 + audio.energy * 0.2));
  glow.addColorStop(1, colorWithAlpha(colors[2], 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();
}

function drawGradientFlow(input: RenderBackgroundFrameInput, colors: [string, string, string, string]) {
  const { ctx, width, height, time, audio, lowPower } = input;
  drawBaseGradient(ctx, width, height, colors, time);

  const orbCount = lowPower ? 4 : 6;
  const minDim = Math.min(width, height);

  for (let i = 0; i < orbCount; i += 1) {
    const phase = i * 1.37;
    const x = width * (0.2 + 0.6 * ((Math.sin(time * 0.00006 * (i + 2) + phase) + 1) / 2));
    const y = height * (0.15 + 0.7 * ((Math.cos(time * 0.00005 * (i + 3) + phase) + 1) / 2));
    const radius = minDim * (0.22 + ((i % 3) * 0.08 + 0.1 * audio.energy));

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const core = i % 2 === 0 ? colors[0] : colors[1];
    const edge = i % 3 === 0 ? colors[2] : colors[1];

    gradient.addColorStop(0, colorWithAlpha(core, 0.34 + audio.energy * 0.22));
    gradient.addColorStop(0.62, colorWithAlpha(edge, 0.2));
    gradient.addColorStop(1, colorWithAlpha(edge, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRipple(input: RenderBackgroundFrameInput, colors: [string, string, string, string]) {
  const { ctx, width, height, time, audio, lowPower } = input;
  drawBaseGradient(ctx, width, height, colors, time);

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.64;
  const rippleCount = lowPower ? 6 : 9;

  for (let i = 0; i < rippleCount; i += 1) {
    const cycle = (time * (0.00015 + audio.energy * 0.00018) + i / rippleCount) % 1;
    const radius = maxRadius * (cycle * cycle);
    const alpha = (1 - cycle) * (0.1 + audio.energy * 0.38);
    const stroke = i % 2 === 0 ? colors[0] : colors[2];

    ctx.strokeStyle = colorWithAlpha(stroke, alpha);
    ctx.lineWidth = 1 + (1 - cycle) * (4 + audio.bass * 5);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const bloom = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.5);
  bloom.addColorStop(0, colorWithAlpha(colors[1], 0.28 + audio.energy * 0.26));
  bloom.addColorStop(1, colorWithAlpha(colors[1], 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(centerX, centerY, maxRadius * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEtherealShadow(input: RenderBackgroundFrameInput, colors: [string, string, string, string]) {
  const { ctx, width, height, time, lowPower } = input;
  drawBaseGradient(ctx, width, height, colors, time);

  const layers = lowPower ? 3 : 5;
  const minDim = Math.min(width, height);

  for (let i = 0; i < layers; i += 1) {
    const shiftX = Math.sin(time * 0.00004 * (i + 1) + i) * width * 0.22;
    const shiftY = Math.cos(time * 0.00005 * (i + 1) + i * 0.7) * height * 0.2;
    const x = width * 0.5 + shiftX;
    const y = height * 0.5 + shiftY;
    const radius = minDim * (0.35 + i * 0.08);

    const haze = ctx.createRadialGradient(x, y, 0, x, y, radius);
    haze.addColorStop(0, colorWithAlpha(colors[i % 2 === 0 ? 0 : 1], 0.18));
    haze.addColorStop(1, colorWithAlpha(colors[3], 0));

    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!lowPower) {
    const grainCount = 160;
    for (let i = 0; i < grainCount; i += 1) {
      const x = ((i * 97) % width) + Math.sin(time * 0.0004 + i) * 6;
      const y = ((i * 57) % height) + Math.cos(time * 0.0005 + i) * 6;
      ctx.fillStyle = colorWithAlpha(colors[2], 0.02);
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  }
}

function drawAurora(input: RenderBackgroundFrameInput, colors: [string, string, string, string]) {
  const { ctx, width, height, time, audio } = input;
  drawBaseGradient(ctx, width, height, colors, time);

  const ribbons = 4;
  for (let i = 0; i < ribbons; i += 1) {
    const bandGradient = ctx.createLinearGradient(0, 0, 0, height);
    const baseColor = i % 2 === 0 ? colors[0] : colors[1];
    bandGradient.addColorStop(0, colorWithAlpha(baseColor, 0));
    bandGradient.addColorStop(0.35, colorWithAlpha(baseColor, 0.24 + audio.energy * 0.26));
    bandGradient.addColorStop(1, colorWithAlpha(colors[2], 0));

    ctx.fillStyle = bandGradient;
    ctx.beginPath();

    const startX = (width / ribbons) * i;
    ctx.moveTo(startX, 0);
    for (let y = 0; y <= height; y += 18) {
      const drift = Math.sin(y * 0.01 + time * 0.00045 * (0.8 + i * 0.12) + i) * (28 + audio.bass * 36);
      const taper = 1 - y / height;
      const x = startX + drift * taper;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(startX + width / ribbons, height);
    ctx.lineTo(startX + width / ribbons, 0);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStarlitBloom(input: RenderBackgroundFrameInput, colors: [string, string, string, string]) {
  const { ctx, width, height, time, seed, lowPower } = input;
  drawBaseGradient(ctx, width, height, colors, time);

  const starCount = lowPower ? 90 : 170;

  for (let i = 0; i < starCount; i += 1) {
    const hash = i * 2654435761 + Math.floor(seed * 1000);
    const x = Math.abs((hash % 10000) / 10000) * width;
    const y = Math.abs((((hash * 13) % 10000) / 10000)) * height;
    const twinkle = 0.45 + 0.55 * Math.sin(time * 0.0012 + i * 0.27);
    const radius = 0.4 + ((i % 3) * 0.45 + twinkle * 0.7);

    ctx.fillStyle = colorWithAlpha(i % 2 === 0 ? colors[2] : colors[1], 0.16 + twinkle * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const centerGlow = ctx.createRadialGradient(width / 2, height * 0.45, 0, width / 2, height * 0.45, Math.min(width, height) * 0.6);
  centerGlow.addColorStop(0, colorWithAlpha(colors[0], 0.2));
  centerGlow.addColorStop(1, colorWithAlpha(colors[0], 0));
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);
}

export function renderBackgroundFrame(input: RenderBackgroundFrameInput) {
  const colors = palettes[input.animationId];

  switch (input.animationId) {
    case 'psychedelic_spiral':
      drawSpiral(input, colors);
      break;
    case 'gradient_flow':
      drawGradientFlow(input, colors);
      break;
    case 'ripple_pulse':
      drawRipple(input, colors);
      break;
    case 'ethereal_shadow':
      drawEtherealShadow(input, colors);
      break;
    case 'aurora_veil':
      drawAurora(input, colors);
      break;
    case 'starlit_bloom':
      drawStarlitBloom(input, colors);
      break;
    default:
      drawGradientFlow(input, colors);
      break;
  }
}
