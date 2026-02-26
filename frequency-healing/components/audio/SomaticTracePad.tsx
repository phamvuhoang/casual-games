'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SomaticTracePoint } from '@/lib/audio/SomaticTraceEngine';
import { clamp } from '@/lib/audio/audioConfig';
import { cn } from '@/lib/utils/helpers';
import Button from '@/components/ui/Button';

const DEFAULT_MIN_DURATION_MS = 20_000;
const DEFAULT_MAX_DURATION_MS = 30_000;

export interface SomaticTraceCapture {
  points: SomaticTracePoint[];
  durationMs: number;
}

interface SomaticTracePadProps {
  enabled: boolean;
  onAnalyze: (capture: SomaticTraceCapture) => void;
  cacheKey?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  className?: string;
  clearLabel?: string;
  analyzeLabel?: string;
}

interface CachedTracePayload {
  version: 1;
  points: SomaticTracePoint[];
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0d111f');
  gradient.addColorStop(0.48, '#12233a');
  gradient.addColorStop(1, '#1f2f3e');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  const grid = 34;
  for (let x = grid; x < width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = grid; y < height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function localizePoint(point: SomaticTracePoint, width: number, height: number) {
  return {
    x: clamp(0, point.x, 1) * width,
    y: clamp(0, point.y, 1) * height
  };
}

function toRelativePoints(points: SomaticTracePoint[]) {
  if (points.length === 0) {
    return points;
  }

  const start = points[0].t;
  return points.map((point) => ({
    ...point,
    t: point.t - start
  }));
}

export default function SomaticTracePad({
  enabled,
  onAnalyze,
  cacheKey,
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  className,
  clearLabel = 'Clear',
  analyzeLabel = 'Analyze trace'
}: SomaticTracePadProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<SomaticTracePoint[]>([]);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastPointRef = useRef<SomaticTracePoint | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const hasTrace = pointCount > 0;
  const ready = hasTrace && elapsedMs >= minDurationMs;

  const timerLabel = useMemo(() => {
    const seconds = (elapsedMs / 1000).toFixed(1);
    return `${seconds}s`;
  }, [elapsedMs]);

  const persistCache = useCallback(() => {
    if (!cacheKey || typeof window === 'undefined') {
      return;
    }

    const payload: CachedTracePayload = {
      version: 1,
      points: toRelativePoints(pointsRef.current)
    };

    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  }, [cacheKey]);

  const drawSegment = useCallback((from: SomaticTracePoint, to: SomaticTracePoint) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const fromPoint = localizePoint(from, width, height);
    const toPoint = localizePoint(to, width, height);
    const dt = Math.max(1, to.t - from.t);
    const distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
    const speed = distance / dt;
    const pressure = typeof to.pressure === 'number' ? to.pressure : 0.5;

    const hue = 190 + Math.min(120, speed * 2200);
    const alpha = clamp(0.18, 0.28 + pressure * 0.42, 0.92);
    const widthPx = clamp(0.8, 1.8 + speed * 52 + pressure * 2.2, 6.2);

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = `hsla(${Math.round(hue)}, 88%, 72%, ${alpha})`;
    context.shadowColor = `hsla(${Math.round(hue + 12)}, 90%, 70%, 0.35)`;
    context.shadowBlur = 16;
    context.lineWidth = widthPx;

    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();

    context.shadowBlur = 0;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    drawBackground(context, canvas.width, canvas.height);

    const points = pointsRef.current;
    for (let index = 1; index < points.length; index += 1) {
      drawSegment(points[index - 1], points[index]);
    }
  }, [drawSegment]);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));

    if (canvas.width === width && canvas.height === height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;
    redraw();
  }, [redraw]);

  const stopDrawing = useCallback((event?: PointerEvent | ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && pointerIdRef.current !== null) {
      try {
        canvas.releasePointerCapture(pointerIdRef.current);
      } catch {
        // no-op
      }
    }

    drawingRef.current = false;
    pointerIdRef.current = null;
    if (event && 'preventDefault' in event) {
      event.preventDefault();
    }

    persistCache();
  }, [persistCache]);

  const clearTrace = useCallback(() => {
    pointsRef.current = [];
    drawingRef.current = false;
    pointerIdRef.current = null;
    startTimeRef.current = null;
    lastPointRef.current = null;
    setPointCount(0);
    setElapsedMs(0);
    setIsLocked(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        drawBackground(context, canvas.width, canvas.height);
      }
    }

    if (cacheKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(cacheKey);
    }
  }, [cacheKey]);

  const appendPoint = useCallback(
    (point: SomaticTracePoint) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = point.t;
      }

      const previous = lastPointRef.current;
      pointsRef.current.push(point);
      lastPointRef.current = point;
      setPointCount(pointsRef.current.length);

      if (previous) {
        drawSegment(previous, point);
      }

      const durationMs = Math.max(0, point.t - (startTimeRef.current ?? point.t));
      setElapsedMs(durationMs);

      if (durationMs >= maxDurationMs) {
        setIsLocked(true);
        drawingRef.current = false;
        persistCache();
      }
    },
    [drawSegment, maxDurationMs, persistCache]
  );

  const pointerToPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): SomaticTracePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clamp(0, (event.clientX - rect.left) / Math.max(1, rect.width), 1);
    const y = clamp(0, (event.clientY - rect.top) / Math.max(1, rect.height), 1);

    return {
      x,
      y,
      t: performance.now(),
      pressure: Number.isFinite(event.pressure) ? clamp(0, event.pressure, 1) : undefined
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!enabled || isLocked) {
        return;
      }

      const canvas = canvasRef.current;
      const point = pointerToPoint(event);
      if (!canvas || !point) {
        return;
      }

      drawingRef.current = true;
      pointerIdRef.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);

      appendPoint(point);
      event.preventDefault();
    },
    [appendPoint, enabled, isLocked, pointerToPoint]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!enabled || !drawingRef.current || pointerIdRef.current !== event.pointerId || isLocked) {
        return;
      }

      const point = pointerToPoint(event);
      if (!point) {
        return;
      }

      const previous = lastPointRef.current;
      if (previous) {
        const deltaTime = point.t - previous.t;
        const deltaDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
        if (deltaTime < 8 && deltaDistance < 0.002) {
          return;
        }
      }

      appendPoint(point);
      event.preventDefault();
    },
    [appendPoint, enabled, isLocked, pointerToPoint]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      stopDrawing(event);
    },
    [stopDrawing]
  );

  const handleAnalyze = useCallback(() => {
    const points = pointsRef.current;
    if (points.length < 3) {
      return;
    }

    const relativePoints = toRelativePoints(points).map((point) => ({
      x: clamp(0, point.x, 1),
      y: clamp(0, point.y, 1),
      t: Math.max(0, point.t),
      pressure: typeof point.pressure === 'number' ? clamp(0, point.pressure, 1) : undefined
    }));

    const durationMs = relativePoints[relativePoints.length - 1]?.t ?? 0;
    onAnalyze({
      points: relativePoints,
      durationMs
    });

    persistCache();
  }, [onAnalyze, persistCache]);

  useEffect(() => {
    if (!enabled) {
      stopDrawing();
    }
  }, [enabled, stopDrawing]);

  useEffect(() => {
    syncCanvasSize();
    const observer = new ResizeObserver(() => syncCanvasSize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [syncCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    drawBackground(context, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!cacheKey || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as CachedTracePayload;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.points) || parsed.points.length === 0) {
        return;
      }

      const base = performance.now();
      pointsRef.current = parsed.points.map((point) => ({
        x: clamp(0, point.x, 1),
        y: clamp(0, point.y, 1),
        t: base + Math.max(0, point.t),
        pressure: typeof point.pressure === 'number' ? clamp(0, point.pressure, 1) : undefined
      }));

      startTimeRef.current = pointsRef.current[0]?.t ?? null;
      lastPointRef.current = pointsRef.current[pointsRef.current.length - 1] ?? null;
      setPointCount(pointsRef.current.length);
      if (startTimeRef.current && lastPointRef.current) {
        setElapsedMs(Math.max(0, lastPointRef.current.t - startTimeRef.current));
      }

      redraw();
    } catch (error) {
      console.warn('Unable to restore somatic trace cache.', error);
    }
  }, [cacheKey, redraw]);

  useEffect(() => {
    if (!hasTrace || isLocked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const started = startTimeRef.current;
      if (!started) {
        return;
      }

      const now = performance.now();
      const durationMs = now - started;
      setElapsedMs(durationMs);

      if (durationMs >= maxDurationMs) {
        setIsLocked(true);
        drawingRef.current = false;
      }
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [hasTrace, isLocked, maxDurationMs]);

  return (
    <div className={cn('rounded-3xl border border-ink/10 bg-white/85 p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/65">
        <span>Trace {timerLabel} · {pointCount} pts</span>
        <span>
          {ready ? 'Ready to map' : `Target ${(minDurationMs / 1000).toFixed(0)}-${(maxDurationMs / 1000).toFixed(0)}s`}
        </span>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'relative h-48 overflow-hidden rounded-2xl border border-white/20 bg-slate-950/70 md:h-56',
          !enabled && 'opacity-55'
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn('h-full w-full touch-none', enabled ? 'cursor-crosshair' : 'cursor-not-allowed')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!enabled ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/35 text-xs uppercase tracking-[0.24em] text-white/70">
            Somatic trace disabled
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={clearTrace} disabled={!hasTrace}>
          {clearLabel}
        </Button>
        <Button size="sm" onClick={handleAnalyze} disabled={!hasTrace || !ready}>
          {analyzeLabel}
        </Button>
      </div>
      {!ready && hasTrace ? (
        <p className="mt-2 text-xs text-ink/58">
          Keep tracing a little longer to improve gesture analysis confidence.
        </p>
      ) : null}
    </div>
  );
}
