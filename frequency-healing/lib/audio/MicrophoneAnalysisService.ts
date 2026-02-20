export interface CaptureSpectrumOptions {
  durationMs?: number;
  fftSize?: number;
  smoothingTimeConstant?: number;
}

export interface SpectrumSnapshot {
  averageBins: Float32Array;
  sampleRate: number;
  fftSize: number;
  frameCount: number;
  captureDurationMs: number;
  noiseFloorDb: number;
  peakDb: number;
}

export interface CaptureAmplitudeOptions {
  durationMs?: number;
  sampleIntervalMs?: number;
  fftSize?: number;
}

export interface AmplitudePatternSnapshot {
  samples: number[];
  sampleIntervalMs: number;
  captureDurationMs: number;
  estimatedBreathBpm: number | null;
  confidence: number;
}

const DEFAULT_CAPTURE_MS = 5500;
const DEFAULT_FFT_SIZE = 2048;
const DEFAULT_SMOOTHING = 0.78;
const FRAME_INTERVAL_MS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNoiseFloorEstimate(values: Float32Array) {
  const sorted = Array.from(values).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return -90;
  }

  const floorCount = Math.max(1, Math.floor(sorted.length * 0.12));
  const floorSlice = sorted.slice(0, floorCount);
  const sum = floorSlice.reduce((acc, value) => acc + value, 0);
  return sum / floorSlice.length;
}

function estimateBreathFromEnvelope(samples: number[], sampleIntervalMs: number) {
  if (samples.length < 20) {
    return { estimatedBreathBpm: null, confidence: 0 };
  }

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const centered = samples.map((value) => value - mean);
  const maxValue = Math.max(...centered);
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { estimatedBreathBpm: null, confidence: 0 };
  }

  const threshold = maxValue * 0.38;
  const minPeakDistanceMs = 1200;
  const minPeakDistanceSamples = Math.max(1, Math.floor(minPeakDistanceMs / sampleIntervalMs));
  const peaks: number[] = [];

  for (let index = 1; index < centered.length - 1; index += 1) {
    const current = centered[index];
    if (current < threshold || current <= centered[index - 1] || current <= centered[index + 1]) {
      continue;
    }
    if (peaks.length > 0 && index - peaks[peaks.length - 1] < minPeakDistanceSamples) {
      continue;
    }
    peaks.push(index);
  }

  if (peaks.length < 2) {
    return { estimatedBreathBpm: null, confidence: 0 };
  }

  const intervalsMs: number[] = [];
  for (let index = 1; index < peaks.length; index += 1) {
    intervalsMs.push((peaks[index] - peaks[index - 1]) * sampleIntervalMs);
  }

  const averageIntervalMs = intervalsMs.reduce((sum, value) => sum + value, 0) / intervalsMs.length;
  const bpm = 60000 / averageIntervalMs;
  if (!Number.isFinite(bpm) || bpm < 2 || bpm > 30) {
    return { estimatedBreathBpm: null, confidence: 0 };
  }

  const variance =
    intervalsMs.reduce((sum, value) => sum + (value - averageIntervalMs) ** 2, 0) /
    Math.max(1, intervalsMs.length);
  const deviationRatio = Math.sqrt(variance) / averageIntervalMs;
  const consistency = clamp(0, 1 - deviationRatio, 1);
  const countScore = clamp(0, peaks.length / 7, 1);
  const confidence = Number((consistency * 0.7 + countScore * 0.3).toFixed(2));

  return {
    estimatedBreathBpm: Number(bpm.toFixed(2)),
    confidence
  };
}

export class MicrophoneAnalysisService {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  async start(options: Pick<CaptureSpectrumOptions, 'fftSize' | 'smoothingTimeConstant'> = {}) {
    if (this.analyser && this.stream && this.audioContext) {
      return this.analyser;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = clamp(256, options.fftSize ?? DEFAULT_FFT_SIZE, 32768);
    analyser.smoothingTimeConstant = clamp(0, options.smoothingTimeConstant ?? DEFAULT_SMOOTHING, 0.98);
    source.connect(analyser);

    this.stream = stream;
    this.audioContext = audioContext;
    this.source = source;
    this.analyser = analyser;
    return analyser;
  }

  getAnalyser() {
    return this.analyser;
  }

  async captureSpectrum(options: CaptureSpectrumOptions = {}) {
    const durationMs = clamp(1200, options.durationMs ?? DEFAULT_CAPTURE_MS, 15000);
    const analyser = await this.start({
      fftSize: options.fftSize,
      smoothingTimeConstant: options.smoothingTimeConstant
    });

    const binCount = analyser.frequencyBinCount;
    const frame = new Float32Array(binCount);
    const sum = new Float32Array(binCount);

    let frameCount = 0;
    let peakDb = -Infinity;
    let noiseFloorAccumulator = 0;

    const startedAt = performance.now();
    while (performance.now() - startedAt < durationMs) {
      analyser.getFloatFrequencyData(frame);
      frameCount += 1;

      for (let i = 0; i < frame.length; i += 1) {
        const value = Number.isFinite(frame[i]) ? frame[i] : -160;
        sum[i] += value;
        if (value > peakDb) {
          peakDb = value;
        }
      }

      noiseFloorAccumulator += getNoiseFloorEstimate(frame);
      await sleep(FRAME_INTERVAL_MS);
    }

    const averageBins = new Float32Array(binCount);
    for (let i = 0; i < binCount; i += 1) {
      averageBins[i] = frameCount > 0 ? sum[i] / frameCount : -140;
    }

    return {
      averageBins,
      sampleRate: this.audioContext?.sampleRate ?? 44100,
      fftSize: analyser.fftSize,
      frameCount,
      captureDurationMs: Math.round(performance.now() - startedAt),
      noiseFloorDb: frameCount > 0 ? noiseFloorAccumulator / frameCount : -90,
      peakDb: Number.isFinite(peakDb) ? peakDb : -90
    } satisfies SpectrumSnapshot;
  }

  async captureAmplitudePattern(options: CaptureAmplitudeOptions = {}) {
    const durationMs = clamp(3000, options.durationMs ?? 7000, 15000);
    const sampleIntervalMs = clamp(40, options.sampleIntervalMs ?? 90, 500);
    const analyser = await this.start({
      fftSize: options.fftSize ?? 1024,
      smoothingTimeConstant: 0.7
    });

    const timeDomain = new Uint8Array(analyser.fftSize);
    const samples: number[] = [];
    const startedAt = performance.now();

    while (performance.now() - startedAt < durationMs) {
      analyser.getByteTimeDomainData(timeDomain);
      let sumSquares = 0;
      for (let index = 0; index < timeDomain.length; index += 1) {
        const normalized = (timeDomain[index] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / timeDomain.length);
      samples.push(Number(rms.toFixed(5)));
      await sleep(sampleIntervalMs);
    }

    const estimate = estimateBreathFromEnvelope(samples, sampleIntervalMs);
    return {
      samples,
      sampleIntervalMs,
      captureDurationMs: Math.round(performance.now() - startedAt),
      estimatedBreathBpm: estimate.estimatedBreathBpm,
      confidence: estimate.confidence
    } satisfies AmplitudePatternSnapshot;
  }

  async stop() {
    try {
      this.source?.disconnect();
    } catch (error) {
      console.warn('Microphone source disconnect failed.', error);
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.warn('Microphone audio context close failed.', error);
      }
    }

    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.analyser = null;
  }
}
