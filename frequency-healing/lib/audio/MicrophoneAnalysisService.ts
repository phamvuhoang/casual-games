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

