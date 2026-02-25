'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { VisualizationEngine } from '@/lib/visualization/VisualizationEngine';
import {
  createLayersForType,
  type BaseVisualizationType,
  type VisualizationLayerConfig,
  type VisualizerType
} from '@/lib/visualization/config';
import { CompositorRenderer } from '@/lib/visualization/renderers/CompositorRenderer';
import { cn } from '@/lib/utils/helpers';
import {
  drawBreathGuideOverlay,
  drawSessionOverlay,
  getSessionOverlayLines,
  type BreathGuideOverlayData,
  type VisualizationSessionOverlayData
} from '@/components/audio/visualizationSessionOverlay';

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  type: VisualizerType;
  layers?: VisualizationLayerConfig[];
  isActive: boolean;
  showSessionInfo?: boolean;
  sessionInfo?: VisualizationSessionOverlayData | null;
  breathGuide?: BreathGuideOverlayData | null;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  className?: string;
}

function toBaseType(type: VisualizerType): BaseVisualizationType {
  if (type === 'multi-layer' || type === 'orbital') {
    return 'particles';
  }
  return type;
}

export default function WaveformVisualizer({
  analyser,
  type,
  layers,
  isActive,
  showSessionInfo = false,
  sessionInfo = null,
  breathGuide = null,
  onCanvasReady,
  className
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizationEngine | null>(null);
  const compositorRef = useRef<CompositorRenderer | null>(null);
  const fallbackFrameRef = useRef<number | null>(null);
  const [isLowPower, setIsLowPower] = useState(false);

  if (!compositorRef.current) {
    compositorRef.current = new CompositorRenderer();
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const evaluate = () => {
      const mobile = window.matchMedia('(max-width: 820px)').matches;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
      setIsLowPower(mobile || reducedMotion || lowCores);
    };

    evaluate();
    window.addEventListener('resize', evaluate);

    return () => {
      window.removeEventListener('resize', evaluate);
    };
  }, []);

  const effectiveLayers = useMemo(() => {
    const initialLayers = layers && layers.length > 0 ? layers : createLayersForType(type);
    const sourceLayers =
      type === 'multi-layer' ? initialLayers : initialLayers.filter((layer) => layer.type === toBaseType(type));
    const withFallback = sourceLayers.length > 0 ? sourceLayers : createLayersForType(type);

    if (!isLowPower) {
      return withFallback;
    }

    return withFallback.slice(0, 2).map((layer, index) => ({
      ...layer,
      blendMode: index === 0 ? 'source-over' : layer.blendMode,
      intensity: Math.min(layer.intensity, 0.9),
      speed: Math.min(layer.speed, 1.1)
    }));
  }, [isLowPower, layers, type]);

  const overlayLines = useMemo(
    () => (sessionInfo ? getSessionOverlayLines(sessionInfo) : []),
    [sessionInfo]
  );

  useEffect(() => {
    if (analyser) {
      if (fallbackFrameRef.current) {
        cancelAnimationFrame(fallbackFrameRef.current);
        fallbackFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !isActive) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const renderFallback = (time: number) => {
      fallbackFrameRef.current = requestAnimationFrame(renderFallback);

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width <= 0 || height <= 0) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const targetWidth = Math.max(1, Math.floor(width * ratio));
      const targetHeight = Math.max(1, Math.floor(height * ratio));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
      }

      const pulse = (Math.sin(time * 0.0026) + 1) / 2;
      const glow = (Math.cos(time * 0.0018) + 1) / 2;

      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.08,
        width * 0.5,
        height * 0.5,
        width * 0.62
      );
      gradient.addColorStop(0, `rgba(252, 163, 17, ${0.32 + pulse * 0.2})`);
      gradient.addColorStop(0.55, `rgba(72, 161, 255, ${0.22 + glow * 0.16})`);
      gradient.addColorStop(1, 'rgba(10, 16, 34, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = `rgba(255,255,255,${0.25 + pulse * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const y =
          height * 0.5 +
          Math.sin(x * 0.02 + time * 0.005) * (height * 0.1 + pulse * height * 0.06) +
          Math.sin(x * 0.007 - time * 0.0032) * (height * 0.04);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    fallbackFrameRef.current = requestAnimationFrame(renderFallback);
    return () => {
      if (fallbackFrameRef.current) {
        cancelAnimationFrame(fallbackFrameRef.current);
        fallbackFrameRef.current = null;
      }
    };
  }, [analyser, isActive]);

  useEffect(() => {
    if (!canvasRef.current || !analyser || !compositorRef.current) {
      return;
    }

    const engine = new VisualizationEngine(canvasRef.current, analyser, compositorRef.current);
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    if (isActive) {
      engine.start();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.stop();
      engineRef.current = null;
    };
  }, [analyser, isActive]);

  useEffect(() => {
    compositorRef.current?.setLayers(effectiveLayers);
  }, [effectiveLayers]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    if ((!showSessionInfo || overlayLines.length === 0) && !breathGuide) {
      engineRef.current.setOverlayRenderer(null);
      return;
    }

    engineRef.current.setOverlayRenderer((frame) => {
      if (showSessionInfo && overlayLines.length > 0) {
        drawSessionOverlay(frame.ctx, frame.width, frame.height, overlayLines, frame.energy);
      }
      if (breathGuide) {
        drawBreathGuideOverlay(frame.ctx, frame.width, frame.height, breathGuide);
      }
    });
  }, [analyser, breathGuide, overlayLines, showSessionInfo]);

  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => {
      onCanvasReady?.(null);
    };
  }, [onCanvasReady]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    if (isActive) {
      engineRef.current.start();
    } else {
      engineRef.current.stop();
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (fallbackFrameRef.current) {
        cancelAnimationFrame(fallbackFrameRef.current);
        fallbackFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div className={cn('relative h-64 w-full overflow-hidden rounded-3xl border border-black/5 bg-black/10 md:h-72', className)}>
      <canvas ref={canvasRef} className="h-full w-full" />
      {isLowPower ? (
        <span className="absolute bottom-2 right-3 rounded-full bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
          Eco visuals
        </span>
      ) : null}
    </div>
  );
}

export type { VisualizerType };
