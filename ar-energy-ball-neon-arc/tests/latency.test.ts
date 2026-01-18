import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createLatencyWrapper } from '../services/networking/latency';

const flushTimers = async () => {
  await vi.runAllTimersAsync();
};

describe('latency wrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays delivery by base latency', async () => {
    const received: number[] = [];
    const wrap = createLatencyWrapper<number>({ baseMs: 50, jitterMs: 0, random: () => 0.5 });
    const handler = wrap((value) => received.push(value));

    handler(42);
    vi.advanceTimersByTime(49);
    expect(received).toEqual([]);
    vi.advanceTimersByTime(1);
    await flushTimers();
    expect(received).toEqual([42]);
  });

  it('applies jitter within bounds', async () => {
    const received: number[] = [];
    const wrap = createLatencyWrapper<number>({ baseMs: 50, jitterMs: 20, random: () => 1 });
    const handler = wrap((value) => received.push(value));

    handler(7);
    vi.advanceTimersByTime(69);
    expect(received).toEqual([]);
    vi.advanceTimersByTime(1);
    await flushTimers();
    expect(received).toEqual([7]);
  });

  it('drops packets when loss is 100%', async () => {
    const received: number[] = [];
    const wrap = createLatencyWrapper<number>({ baseMs: 10, jitterMs: 0, lossPercent: 100, random: () => 0 });
    const handler = wrap((value) => received.push(value));

    handler(9);
    await flushTimers();
    expect(received).toEqual([]);
  });
});
