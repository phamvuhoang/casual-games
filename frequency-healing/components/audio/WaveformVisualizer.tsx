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

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  type: VisualizerType;
  layers?: VisualizationLayerConfig[];
  isActive: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
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
  onCanvasReady
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizationEngine | null>(null);
  const compositorRef = useRef<CompositorRenderer | null>(null);
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

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-3xl border border-black/5 bg-black/10 md:h-72">
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
