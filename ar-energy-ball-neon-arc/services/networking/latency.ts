export type LatencyOptions = {
  baseMs: number;
  jitterMs?: number;
  lossPercent?: number;
  random?: () => number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeLatencyOptions = (options: LatencyOptions) => {
  const baseMs = Math.max(0, Number(options.baseMs) || 0);
  const jitterMs = Math.max(0, Number(options.jitterMs) || 0);
  const lossPercent = clamp(Number(options.lossPercent) || 0, 0, 100);
  const random = options.random ?? Math.random;

  return {
    baseMs,
    jitterMs,
    lossPercent,
    random
  };
};

export const createLatencyWrapper = <T>(options: LatencyOptions) => {
  const normalized = normalizeLatencyOptions(options);

  const shouldDrop = () => normalized.random() * 100 < normalized.lossPercent;
  const computeDelay = () => {
    if (normalized.jitterMs === 0) {
      return normalized.baseMs;
    }
    const jitterOffset = (normalized.random() * 2 - 1) * normalized.jitterMs;
    return normalized.baseMs + jitterOffset;
  };

  return (handler: (payload: T) => void) => {
    return (payload: T) => {
      if (normalized.lossPercent > 0 && shouldDrop()) {
        return;
      }
      const delay = Math.max(0, computeDelay());
      if (delay === 0) {
        handler(payload);
        return;
      }
      globalThis.setTimeout(() => handler(payload), delay);
    };
  };
};
