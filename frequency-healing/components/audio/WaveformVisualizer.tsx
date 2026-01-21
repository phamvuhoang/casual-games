'use client';

import { useEffect, useMemo, useRef } from 'react';
import { VisualizationEngine } from '@/lib/visualization/VisualizationEngine';
import { WaveformRenderer } from '@/lib/visualization/renderers/WaveformRenderer';
import { ParticleRenderer } from '@/lib/visualization/renderers/ParticleRenderer';
import { MandalaRenderer } from '@/lib/visualization/renderers/MandalaRenderer';
import type { VisualizationRenderer } from '@/lib/visualization/renderers/types';

export type VisualizerType = 'waveform' | 'particles' | 'mandala';

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  type: VisualizerType;
  isActive: boolean;
}

export default function WaveformVisualizer({ analyser, type, isActive }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizationEngine | null>(null);

  const renderer = useMemo<VisualizationRenderer>(() => {
    switch (type) {
      case 'particles':
        return new ParticleRenderer();
      case 'mandala':
        return new MandalaRenderer();
      default:
        return new WaveformRenderer();
    }
  }, [type]);

  useEffect(() => {
    if (!canvasRef.current || !analyser) {
      return;
    }

    const engine = new VisualizationEngine(canvasRef.current, analyser, renderer);
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    if (isActive) {
      engine.start();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.stop();
    };
  }, [analyser, renderer, isActive]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    engineRef.current.setRenderer(renderer);
  }, [renderer]);

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
    </div>
  );
}
