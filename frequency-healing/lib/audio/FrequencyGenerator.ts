import * as Tone from 'tone/build/esm';
import { isIOSDevice } from '@/lib/utils/platform';
import type { EffectsConfig } from '@/lib/audio/effects';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';
import {
  clamp,
  normalizeFrequency,
  normalizeRhythmSteps,
  type ModulationConfig,
  type RhythmConfig,
  type SweepConfig
} from '@/lib/audio/audioConfig';

export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';
export type AmbientType = 'none' | 'rain' | 'ocean' | 'forest' | 'bells';

export interface FrequencyConfig {
  frequency: number;
  volume: number;
  waveform: WaveformType;
  pan?: number;
  attackSeconds?: number;
  releaseSeconds?: number;
  detuneCents?: number;
  modulationRateHz?: number;
  modulationDepth?: number;
}

export interface InitializeOptions {
  enableAudioBridge?: boolean;
  enableIOSAudioBridge?: boolean;
}

export interface PlaybackAutomationConfig {
  modulation: ModulationConfig;
  sweep: SweepConfig;
}

export interface BreathControlFrame {
  phase: 'inhale' | 'exhale';
  phaseProgress: number;
  coherenceScore: number;
  gainScale: number;
  rhythmBpm?: number;
}

const DEFAULT_RHYTHM_CONFIG: RhythmConfig = {
  enabled: false,
  bpm: 72,
  subdivision: '16n',
  steps: normalizeRhythmSteps(undefined)
};

const DEFAULT_AUTOMATION_CONFIG: PlaybackAutomationConfig = {
  modulation: {
    enabled: false,
    rateHz: 0.18,
    depthHz: 12,
    waveform: 'sine'
  },
  sweep: {
    enabled: false,
    targetHz: 528,
    durationSeconds: 18,
    curve: 'easeInOut'
  }
};

type AmbientDisposable = {
  dispose: () => unknown;
};

export class FrequencyGenerator {
  private synths: Tone.Synth[] = [];
  private voicePanners: Tone.Panner[] = [];
  private voiceTremolos: Tone.Tremolo[] = [];
  private inputBus: Tone.Gain | null = null;
  private rhythmGate: Tone.Gain | null = null;
  private rhythmSequence: Tone.Sequence<number> | null = null;
  private rhythmConfig: RhythmConfig = { ...DEFAULT_RHYTHM_CONFIG };
  private automationConfig: PlaybackAutomationConfig = {
    modulation: { ...DEFAULT_AUTOMATION_CONFIG.modulation },
    sweep: { ...DEFAULT_AUTOMATION_CONFIG.sweep }
  };
  private automationEventId: number | null = null;
  private automationStartAt = 0;
  private voiceBaseFrequencies: number[] = [];
  private voiceSweepTargets: number[] = [];
  private isPlaying = false;
  private master: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private analyser: AnalyserNode | null = null;
  private ambientType: AmbientType = 'none';
  private ambientGain: Tone.Gain | null = null;
  private ambientLoop: Tone.Loop | null = null;
  private ambientNoises: Tone.Noise[] = [];
  private ambientDisposables: AmbientDisposable[] = [];
  private silentAudio: HTMLAudioElement | null = null;
  private hasUnlocked = false;
  private initialized = false;
  private lastEffects: EffectsConfig = DEFAULT_EFFECTS;
  private lastFrequencies: FrequencyConfig[] = [];
  private masterVolume = 1;
  private breathGainScale = 1;
  private resumeTask: Promise<void> | null = null;
  private iosHandlersAttached = false;
  private audioBridgeEnabled = false;
  private audioBridge: {
    element: HTMLAudioElement;
    destination: MediaStreamAudioDestinationNode;
  } | null = null;
  private masterConnected = false;

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.ensureAudioRunning();
    }
  };

  private readonly handlePageShow = () => {
    void this.ensureAudioRunning();
  };

  private readonly handleFocus = () => {
    void this.ensureAudioRunning();
  };

  async initialize(effects: EffectsConfig = DEFAULT_EFFECTS, options: InitializeOptions = {}) {
    this.lastEffects = effects;
    const requestedAudioBridge =
      typeof options.enableAudioBridge === 'boolean'
        ? options.enableAudioBridge
        : typeof options.enableIOSAudioBridge === 'boolean'
          ? options.enableIOSAudioBridge
          : undefined;

    if (typeof requestedAudioBridge === 'boolean') {
      this.audioBridgeEnabled = requestedAudioBridge;
      if (!this.audioBridgeEnabled) {
        this.teardownAudioBridge();
      }
    }

    const shouldAttachLifecycleHandlers = isIOSDevice() || this.audioBridgeEnabled;
    if (shouldAttachLifecycleHandlers) {
      this.attachIOSLifecycleHandlers();
    } else {
      this.detachIOSLifecycleHandlers();
    }

    if (isIOSDevice()) {
      this.configureIOSAudioSession();
    }

    if (this.initialized) {
      this.updateEffects(effects);
      if (this.audioBridgeEnabled && !this.audioBridge) {
        await this.setupAudioBridge();
      }
      return;
    }

    await Tone.start();

    if (isIOSDevice() && !this.hasUnlocked) {
      await this.unlockIOSAudio();
    }

    await this.createAudioGraph(effects);

    this.initialized = true;

    if (this.audioBridgeEnabled) {
      await this.setupAudioBridge();
    }
  }

  getAnalyser() {
    return this.analyser;
  }

  updateEffects(effects: EffectsConfig) {
    this.lastEffects = effects;
    if (this.reverb && effects.reverb) {
      this.reverb.decay = effects.reverb.decay;
      this.reverb.wet.value = effects.reverb.wet;
    }

    if (this.delay && effects.delay) {
      this.delay.delayTime.value = effects.delay.time;
      this.delay.feedback.value = effects.delay.feedback;
      this.delay.wet.value = effects.delay.wet;
    }
  }

  setRhythmPattern(config: RhythmConfig) {
    this.rhythmConfig = {
      enabled: Boolean(config.enabled),
      bpm: clamp(35, config.bpm, 180),
      subdivision: config.subdivision,
      steps: normalizeRhythmSteps(config.steps)
    };

    if (!this.isPlaying) {
      this.resetRhythmGate();
      return;
    }

    this.configureRhythmSequence();
  }

  setAutomation(config: PlaybackAutomationConfig) {
    this.automationConfig = {
      modulation: {
        enabled: Boolean(config.modulation.enabled),
        rateHz: clamp(0.01, config.modulation.rateHz, 24),
        depthHz: clamp(0.1, config.modulation.depthHz, 220),
        waveform: config.modulation.waveform
      },
      sweep: {
        enabled: Boolean(config.sweep.enabled),
        targetHz: normalizeFrequency(config.sweep.targetHz),
        durationSeconds: clamp(1, config.sweep.durationSeconds, 180),
        curve: config.sweep.curve
      }
    };

    if (!this.isPlaying) {
      return;
    }

    this.configureAutomationLoop();
  }

  play(frequencies: FrequencyConfig[]) {
    if (isIOSDevice() || this.audioBridgeEnabled) {
      void this.ensureAudioRunning();
    }

    if (!this.master || !this.reverb || !this.delay || !this.inputBus) {
      return;
    }

    this.stopSynths(true);
    this.lastFrequencies = frequencies.map((config) => ({ ...config }));
    this.voiceBaseFrequencies = frequencies.map((config) => normalizeFrequency(config.frequency));
    this.voiceSweepTargets = this.computeSweepTargets(this.voiceBaseFrequencies);
    this.isPlaying = this.voiceBaseFrequencies.length > 0;

    this.synths = frequencies.map((config) => {
      const synth = new Tone.Synth({
        oscillator: { type: config.waveform },
        envelope: {
          attack: config.attackSeconds ?? 1.6,
          decay: 0.2,
          sustain: 0.9,
          release: config.releaseSeconds ?? 2.2
        }
      });

      synth.volume.value = Tone.gainToDb(config.volume);
      if (typeof config.detuneCents === 'number') {
        synth.detune.value = config.detuneCents;
      }

      let destination: Tone.ToneAudioNode = synth;

      if (
        typeof config.modulationRateHz === 'number' &&
        config.modulationRateHz > 0 &&
        typeof config.modulationDepth === 'number' &&
        config.modulationDepth > 0
      ) {
        const tremolo = new Tone.Tremolo({
          frequency: config.modulationRateHz,
          depth: Math.max(0, Math.min(1, config.modulationDepth))
        }).start();
        destination.connect(tremolo);
        destination = tremolo;
        this.voiceTremolos.push(tremolo);
      }

      if (typeof config.pan === 'number') {
        const panner = new Tone.Panner(Math.max(-1, Math.min(1, config.pan)));
        destination.connect(panner);
        panner.connect(this.inputBus!);
        this.voicePanners.push(panner);
      } else {
        destination.connect(this.inputBus!);
      }
      synth.triggerAttack(config.frequency);
      return synth;
    });

    if (this.ambientType !== 'none') {
      this.setAmbientLayer(this.ambientType, true);
    }

    this.configureRhythmSequence();
    this.configureAutomationLoop();
  }

  setAmbientLayer(type: AmbientType, force = false) {
    if (!this.reverb || !this.master) {
      return;
    }

    if (!force && type === this.ambientType) {
      return;
    }

    this.stopAmbient();
    this.ambientType = type;

    if (type === 'none') {
      return;
    }

    const destination = this.reverb ?? this.master;
    const ambientBus = this.trackAmbientDisposable(new Tone.Gain(1));
    ambientBus.connect(destination);
    this.ambientGain = ambientBus;

    if (type === 'rain') {
      this.buildRainAmbient(ambientBus);
      return;
    }

    if (type === 'ocean') {
      this.buildOceanAmbient(ambientBus);
      return;
    }

    if (type === 'forest') {
      this.buildForestAmbient(ambientBus);
      return;
    }

    this.buildBellsAmbient(ambientBus);
  }

  private trackAmbientDisposable<T extends AmbientDisposable>(resource: T): T {
    this.ambientDisposables.push(resource);
    return resource;
  }

  private trackAmbientNoise(noise: Tone.Noise) {
    this.ambientNoises.push(noise);
    this.trackAmbientDisposable(noise);
    return noise;
  }

  private buildRainAmbient(destination: Tone.ToneAudioNode) {
    const rainBed = this.trackAmbientNoise(
      new Tone.Noise({ type: 'pink', playbackRate: 1.15, fadeIn: 1.2, fadeOut: 1.1 })
    );
    const rainBodyFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'bandpass', frequency: 1700, Q: 0.65, rolloff: -24 })
    );
    const rainMotion = this.trackAmbientDisposable(
      new Tone.AutoFilter({
        frequency: 0.08,
        depth: 0.5,
        type: 'sine',
        baseFrequency: 1200,
        octaves: 1.1,
        filter: { type: 'bandpass', Q: 0.8, rolloff: -24 }
      })
    ).start();
    rainMotion.wet.value = 0.45;
    const rainBedGain = this.trackAmbientDisposable(new Tone.Gain(0.11));
    rainBed.chain(rainBodyFilter, rainMotion, rainBedGain, destination);
    rainBed.start();

    const drizzle = this.trackAmbientNoise(
      new Tone.Noise({ type: 'white', playbackRate: 2.25, fadeIn: 0.8, fadeOut: 0.8 })
    );
    const drizzleFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'highpass', frequency: 4200, Q: 0.45, rolloff: -24 })
    );
    const drizzlePan = this.trackAmbientDisposable(
      new Tone.AutoPanner({ frequency: 0.045, depth: 0.35, type: 'sine' })
    ).start();
    drizzlePan.wet.value = 0.35;
    const drizzleGain = this.trackAmbientDisposable(new Tone.Gain(0.03));
    drizzle.chain(drizzleFilter, drizzlePan, drizzleGain, destination);
    drizzle.start();

    const droplets = this.trackAmbientDisposable(
      new Tone.NoiseSynth({
        noise: { type: 'white', playbackRate: 1.9 },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.08 }
      })
    );
    const dropletFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'bandpass', frequency: 3200, Q: 3.1, rolloff: -24 })
    );
    const dropletGain = this.trackAmbientDisposable(new Tone.Gain(0.065));
    droplets.chain(dropletFilter, dropletGain, destination);

    const rainLoop = new Tone.Loop((time) => {
      const primaryDuration = 0.008 + Math.random() * 0.026;
      dropletFilter.frequency.setValueAtTime(2200 + Math.random() * 2600, time);
      droplets.triggerAttackRelease(primaryDuration, time, 0.22 + Math.random() * 0.35);

      if (Math.random() < 0.38) {
        const splashDelay = 0.015 + Math.random() * 0.05;
        droplets.triggerAttackRelease(
          0.01 + Math.random() * 0.03,
          time + splashDelay,
          0.14 + Math.random() * 0.24
        );
      }

      if (Math.random() < 0.22) {
        rainBed.playbackRate = 1 + Math.random() * 0.35;
      }
    }, '16n');
    rainLoop.humanize = 0.02;
    rainLoop.probability = 0.92;
    this.ensureTransportStarted();
    rainLoop.start(0);
    this.ambientLoop = rainLoop;
  }

  private buildOceanAmbient(destination: Tone.ToneAudioNode) {
    const swell = this.trackAmbientNoise(
      new Tone.Noise({ type: 'brown', playbackRate: 0.82, fadeIn: 1.5, fadeOut: 1.4 })
    );
    const swellFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'lowpass', frequency: 420, Q: 0.7, rolloff: -48 })
    );
    const swellMotion = this.trackAmbientDisposable(
      new Tone.AutoFilter({
        frequency: 0.035,
        depth: 0.9,
        type: 'sine',
        baseFrequency: 160,
        octaves: 2.4,
        filter: { type: 'lowpass', Q: 0.8, rolloff: -24 }
      })
    ).start();
    swellMotion.wet.value = 0.55;
    const swellGain = this.trackAmbientDisposable(new Tone.Gain(0.16));
    swell.chain(swellFilter, swellMotion, swellGain, destination);
    swell.start();

    const ebbFlow = this.trackAmbientDisposable(
      new Tone.LFO({ frequency: 0.022, min: 0.12, max: 0.2, type: 'sine' })
    ).start();
    ebbFlow.connect(swellGain.gain);

    const foam = this.trackAmbientNoise(
      new Tone.Noise({ type: 'pink', playbackRate: 1.6, fadeIn: 1.0, fadeOut: 1.0 })
    );
    const foamFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 0.9, rolloff: -24 })
    );
    const foamPan = this.trackAmbientDisposable(
      new Tone.AutoPanner({ frequency: 0.018, depth: 0.25, type: 'sine' })
    ).start();
    foamPan.wet.value = 0.4;
    const foamGain = this.trackAmbientDisposable(new Tone.Gain(0.055));
    foam.chain(foamFilter, foamPan, foamGain, destination);
    foam.start();

    const waveWash = this.trackAmbientDisposable(
      new Tone.NoiseSynth({
        noise: { type: 'pink', playbackRate: 1.1 },
        envelope: { attack: 0.04, decay: 0.9, sustain: 0, release: 0.7 }
      })
    );
    const waveFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'bandpass', frequency: 560, Q: 1.1, rolloff: -24 })
    );
    const waveGain = this.trackAmbientDisposable(new Tone.Gain(0.085));
    waveWash.chain(waveFilter, waveGain, destination);

    const waveLoop = new Tone.Loop((time) => {
      waveFilter.frequency.setValueAtTime(360 + Math.random() * 520, time);
      waveWash.triggerAttackRelease(0.24 + Math.random() * 0.4, time, 0.2 + Math.random() * 0.25);

      if (Math.random() < 0.3) {
        const reboundDelay = 0.14 + Math.random() * 0.2;
        waveWash.triggerAttackRelease(
          0.12 + Math.random() * 0.22,
          time + reboundDelay,
          0.12 + Math.random() * 0.18
        );
      }

      foam.playbackRate = 1.3 + Math.random() * 0.45;
    }, '2n');
    waveLoop.humanize = 0.08;
    waveLoop.probability = 0.86;
    this.ensureTransportStarted();
    waveLoop.start(0);
    this.ambientLoop = waveLoop;
  }

  private buildForestAmbient(destination: Tone.ToneAudioNode) {
    const wind = this.trackAmbientNoise(
      new Tone.Noise({ type: 'brown', playbackRate: 0.95, fadeIn: 1.2, fadeOut: 1.2 })
    );
    const windHighpass = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'highpass', frequency: 120, Q: 0.2, rolloff: -24 })
    );
    const windLowpass = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'lowpass', frequency: 1450, Q: 0.65, rolloff: -24 })
    );
    const windGain = this.trackAmbientDisposable(new Tone.Gain(0.1));
    wind.chain(windHighpass, windLowpass, windGain, destination);
    wind.start();

    const windMotion = this.trackAmbientDisposable(
      new Tone.LFO({ frequency: 0.028, min: 900, max: 1800, type: 'sine' })
    ).start();
    windMotion.connect(windLowpass.frequency);

    const leaves = this.trackAmbientNoise(
      new Tone.Noise({ type: 'pink', playbackRate: 1.45, fadeIn: 0.9, fadeOut: 0.9 })
    );
    const leavesFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'bandpass', frequency: 2400, Q: 1.1, rolloff: -24 })
    );
    const leavesMotion = this.trackAmbientDisposable(
      new Tone.AutoFilter({
        frequency: 0.12,
        depth: 0.55,
        type: 'triangle',
        baseFrequency: 1500,
        octaves: 1.5,
        filter: { type: 'bandpass', Q: 1.2, rolloff: -24 }
      })
    ).start();
    leavesMotion.wet.value = 0.5;
    const leavesPan = this.trackAmbientDisposable(
      new Tone.AutoPanner({ frequency: 0.026, depth: 0.22, type: 'sine' })
    ).start();
    leavesPan.wet.value = 0.35;
    const leavesGain = this.trackAmbientDisposable(new Tone.Gain(0.05));
    leaves.chain(leavesFilter, leavesMotion, leavesPan, leavesGain, destination);
    leaves.start();

    const chirpSynth = this.trackAmbientDisposable(
      new Tone.FMSynth({
        harmonicity: 2.7,
        modulationIndex: 7,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.008, decay: 0.16, sustain: 0, release: 0.22 },
        modulationEnvelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.12 }
      })
    );
    const chirpFilter = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'bandpass', frequency: 1850, Q: 4, rolloff: -24 })
    );
    const chirpGain = this.trackAmbientDisposable(new Tone.Gain(0.045));
    chirpSynth.chain(chirpFilter, chirpGain, destination);

    const chirpNotes = [1046.5, 1174.66, 1318.51, 1567.98, 1760];
    const forestLoop = new Tone.Loop((time) => {
      if (Math.random() < 0.72) {
        const note = chirpNotes[Math.floor(Math.random() * chirpNotes.length)];
        chirpFilter.frequency.setValueAtTime(1500 + Math.random() * 900, time);
        chirpSynth.triggerAttackRelease(note, 0.08 + Math.random() * 0.08, time, 0.16 + Math.random() * 0.2);

        if (Math.random() < 0.35) {
          const replyDelay = 0.08 + Math.random() * 0.11;
          const step = Math.random() < 0.5 ? 1.12246 : 0.94387;
          chirpSynth.triggerAttackRelease(
            note * step,
            0.06 + Math.random() * 0.06,
            time + replyDelay,
            0.12 + Math.random() * 0.16
          );
        }
      }

      if (Math.random() < 0.25) {
        leaves.playbackRate = 1.25 + Math.random() * 0.5;
      }
    }, '1m');
    forestLoop.humanize = 0.12;
    forestLoop.probability = 0.88;
    this.ensureTransportStarted();
    forestLoop.start(0);
    this.ambientLoop = forestLoop;
  }

  private buildBellsAmbient(destination: Tone.ToneAudioNode) {
    const strike = this.trackAmbientDisposable(
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 2.4, release: 3.2 },
        harmonicity: 5.8,
        modulationIndex: 45,
        resonance: 3200,
        octaves: 2.8
      })
    );
    const resonance = this.trackAmbientDisposable(
      new Tone.FMSynth({
        harmonicity: 1.45,
        modulationIndex: 14,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 1.6, sustain: 0.25, release: 4.4 },
        modulationEnvelope: { attack: 0.01, decay: 1.1, sustain: 0, release: 2.2 }
      })
    );
    const bellHighpass = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'highpass', frequency: 280, Q: 0.5, rolloff: -24 })
    );
    const bellLowpass = this.trackAmbientDisposable(
      new Tone.Filter({ type: 'lowpass', frequency: 5400, Q: 0.7, rolloff: -24 })
    );
    const bellBus = this.trackAmbientDisposable(new Tone.Gain(1));
    const bellPan = this.trackAmbientDisposable(
      new Tone.AutoPanner({ frequency: 0.012, depth: 0.28, type: 'sine' })
    ).start();
    bellPan.wet.value = 0.45;
    const bellGain = this.trackAmbientDisposable(new Tone.Gain(0.11));
    strike.connect(bellBus);
    resonance.connect(bellBus);
    bellBus.chain(bellHighpass, bellLowpass, bellPan, bellGain, destination);

    const bellNotes = [329.63, 392, 493.88, 523.25, 659.25, 783.99];
    const bellLoop = new Tone.Loop((time) => {
      const base = bellNotes[Math.floor(Math.random() * bellNotes.length)];
      const velocity = 0.28 + Math.random() * 0.24;
      const strikeFrequency = base * (0.96 + Math.random() * 0.08);
      bellLowpass.frequency.setValueAtTime(4200 + Math.random() * 1600, time);

      strike.triggerAttackRelease(strikeFrequency, 1.6 + Math.random() * 1.2, time, velocity);
      resonance.triggerAttackRelease(base, 2.2 + Math.random() * 1.4, time + 0.01, velocity * 0.8);

      if (Math.random() < 0.4) {
        const answerDelay = 0.35 + Math.random() * 0.55;
        const answerNote = bellNotes[Math.floor(Math.random() * bellNotes.length)];
        resonance.triggerAttackRelease(
          answerNote,
          1.8 + Math.random() * 1.2,
          time + answerDelay,
          0.16 + Math.random() * 0.2
        );
      }
    }, '2m');
    bellLoop.humanize = 0.08;
    bellLoop.probability = 0.92;
    this.ensureTransportStarted();
    bellLoop.start(0);
    this.ambientLoop = bellLoop;
  }

  setMasterVolume(value: number) {
    this.masterVolume = value;
    if (this.master) {
      this.master.gain.value = this.masterVolume * this.breathGainScale;
    }
  }

  applyBreathControl(frame: BreathControlFrame) {
    const nextGainScale = clamp(0.75, frame.gainScale, 1.25);
    this.breathGainScale = nextGainScale;

    if (this.master) {
      const now = Tone.now();
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(this.masterVolume * this.breathGainScale, now + 0.12);
    }

    if (
      this.isPlaying &&
      this.rhythmConfig.enabled &&
      this.rhythmSequence &&
      typeof frame.rhythmBpm === 'number' &&
      Number.isFinite(frame.rhythmBpm)
    ) {
      Tone.Transport.bpm.rampTo(clamp(35, frame.rhythmBpm, 180), 0.4);
    }
  }

  stop() {
    this.stopSynths();
  }

  dispose() {
    this.stop();
    this.stopAmbient();
    this.stopRhythmSequence();
    this.stopAutomationLoop();
    this.teardownAudioBridge();
    this.inputBus?.dispose();
    this.rhythmGate?.dispose();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.master?.dispose();
    this.detachIOSLifecycleHandlers();
    if (this.silentAudio) {
      this.silentAudio.pause();
      this.silentAudio.remove();
      this.silentAudio = null;
      this.hasUnlocked = false;
    }
    this.reverb = null;
    this.delay = null;
    this.inputBus = null;
    this.rhythmGate = null;
    this.master = null;
    this.initialized = false;
    this.masterConnected = false;
    this.resumeTask = null;
    this.breathGainScale = 1;
    this.voiceBaseFrequencies = [];
    this.voiceSweepTargets = [];
    this.isPlaying = false;
  }

  private stopAmbient(preserveType = false) {
    this.ambientLoop?.stop();
    this.ambientLoop?.dispose();
    this.ambientNoises.forEach((noise) => noise.stop());
    this.ambientDisposables.forEach((resource) => resource.dispose());

    this.ambientLoop = null;
    this.ambientNoises = [];
    this.ambientDisposables = [];
    this.ambientGain = null;
    if (!preserveType) {
      this.ambientType = 'none';
    }
    this.maybeStopTransport();
  }

  private stopSynths(preserveFrequencies = false) {
    this.stopAutomationLoop(false);
    this.stopRhythmSequence(false);
    this.synths.forEach((synth) => {
      synth.triggerRelease();
      synth.dispose();
    });
    this.synths = [];
    this.voicePanners.forEach((panner) => panner.dispose());
    this.voicePanners = [];
    this.voiceTremolos.forEach((tremolo) => tremolo.dispose());
    this.voiceTremolos = [];
    this.stopAmbient(preserveFrequencies);
    this.isPlaying = false;
    this.breathGainScale = 1;
    if (this.master) {
      this.master.gain.value = this.masterVolume;
    }
    this.voiceBaseFrequencies = [];
    this.voiceSweepTargets = [];
    this.resetRhythmGate();
    if (!preserveFrequencies) {
      this.lastFrequencies = [];
    }
  }

  private async createAudioGraph(effects: EffectsConfig) {
    this.master = new Tone.Gain(1);
    this.inputBus = new Tone.Gain(1);
    this.rhythmGate = new Tone.Gain(1);
    this.connectMasterToDestination();

    this.reverb = new Tone.Reverb({
      decay: effects.reverb?.decay ?? DEFAULT_EFFECTS.reverb!.decay,
      wet: effects.reverb?.wet ?? DEFAULT_EFFECTS.reverb!.wet
    });
    this.delay = new Tone.FeedbackDelay(
      effects.delay?.time ?? DEFAULT_EFFECTS.delay!.time,
      effects.delay?.feedback ?? DEFAULT_EFFECTS.delay!.feedback
    );
    this.delay.wet.value = effects.delay?.wet ?? DEFAULT_EFFECTS.delay!.wet;

    await this.reverb.generate();

    this.inputBus.connect(this.rhythmGate);
    this.rhythmGate.connect(this.reverb);
    this.reverb.connect(this.delay);
    this.delay.connect(this.master);

    const rawContext = Tone.getContext().rawContext;
    this.analyser = rawContext.createAnalyser();
    this.analyser.fftSize = 2048;

    this.master.connect(this.analyser);
  }

  private attachIOSLifecycleHandlers() {
    if (this.iosHandlersAttached) {
      return;
    }

    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true });
    window.addEventListener('pageshow', this.handlePageShow);
    window.addEventListener('focus', this.handleFocus);
    this.iosHandlersAttached = true;
  }

  private detachIOSLifecycleHandlers() {
    if (!this.iosHandlersAttached) {
      return;
    }

    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pageshow', this.handlePageShow);
    window.removeEventListener('focus', this.handleFocus);
    this.iosHandlersAttached = false;
  }

  private configureIOSAudioSession() {
    if (typeof navigator === 'undefined') {
      return;
    }

    const nav = navigator as Navigator & { audioSession?: { type?: string } };
    if (!nav.audioSession) {
      return;
    }

    try {
      nav.audioSession.type = 'playback';
    } catch (error) {
      console.warn('Failed to configure iOS audio session.', error);
    }
  }

  private async ensureAudioRunning() {
    if (!this.initialized) {
      return;
    }

    if (this.resumeTask) {
      await this.resumeTask;
      return;
    }

    this.resumeTask = this.resumeAudioInternal();
    try {
      await this.resumeTask;
    } finally {
      this.resumeTask = null;
    }
  }

  private async resumeAudioInternal() {
    const rawContext = Tone.getContext().rawContext;

    if (!this.isRealtimeAudioContext(rawContext)) {
      return;
    }

    if (rawContext.state === 'running') {
      if (this.audioBridgeEnabled) {
        await this.startAudioBridgeElement();
      }
      return;
    }

    const resumed = await this.resumeContextWithTimeout(rawContext);
    if (resumed) {
      if (this.audioBridgeEnabled) {
        await this.startAudioBridgeElement();
      }
      return;
    }

    await this.rebuildAudioGraph();
  }

  private async resumeContextWithTimeout(context: AudioContext | OfflineAudioContext) {
    if (!this.isRealtimeAudioContext(context)) {
      return false;
    }

    try {
      await Promise.race([
        context.resume(),
        new Promise((_, reject) => {
          globalThis.setTimeout(() => reject(new Error('resume-timeout')), 1500);
        })
      ]);
      return context.state === 'running';
    } catch (error) {
      console.warn('Failed to resume AudioContext.', error);
      return false;
    }
  }

  private async rebuildAudioGraph() {
    const previousFrequencies = this.lastFrequencies.map((config) => ({ ...config }));
    const previousAmbient = this.ambientType;
    const previousVolume = this.masterVolume;
    const previousEffects = this.lastEffects;
    const shouldBridge = this.audioBridgeEnabled;

    this.teardownGraphForRebuild();

    const newContext = new Tone.Context();
    Tone.setContext(newContext);

    try {
      await newContext.resume();
    } catch (error) {
      console.warn('Failed to resume rebuilt AudioContext.', error);
    }

    await this.createAudioGraph(previousEffects);
    this.initialized = true;

    this.setMasterVolume(previousVolume);

    if (previousFrequencies.length > 0) {
      this.play(previousFrequencies);
    }

    if (previousAmbient !== 'none') {
      this.setAmbientLayer(previousAmbient, true);
    }

    if (shouldBridge) {
      await this.setupAudioBridge();
    }
  }

  private teardownGraphForRebuild() {
    this.synths.forEach((synth) => {
      synth.triggerRelease();
      synth.dispose();
    });
    this.synths = [];
    this.voicePanners.forEach((panner) => panner.dispose());
    this.voicePanners = [];
    this.voiceTremolos.forEach((tremolo) => tremolo.dispose());
    this.voiceTremolos = [];
    this.stopRhythmSequence(false);
    this.stopAutomationLoop(false);
    this.stopAmbient(true);
    this.teardownAudioBridge();
    this.inputBus?.dispose();
    this.rhythmGate?.dispose();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.master?.dispose();
    this.inputBus = null;
    this.rhythmGate = null;
    this.reverb = null;
    this.delay = null;
    this.master = null;
    this.analyser = null;
    this.masterConnected = false;
    this.initialized = false;
    this.isPlaying = false;
    this.voiceBaseFrequencies = [];
    this.voiceSweepTargets = [];
  }

  private ensureTransportStarted() {
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  private maybeStopTransport() {
    if (this.rhythmSequence || this.automationEventId !== null || this.ambientLoop || this.isPlaying) {
      return;
    }

    if (Tone.Transport.state === 'started') {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }
  }

  private resetRhythmGate() {
    if (!this.rhythmGate) {
      return;
    }
    this.rhythmGate.gain.cancelScheduledValues(Tone.now());
    this.rhythmGate.gain.value = 1;
  }

  private stopRhythmSequence(resetGate = true) {
    this.rhythmSequence?.stop();
    this.rhythmSequence?.dispose();
    this.rhythmSequence = null;
    if (resetGate) {
      this.resetRhythmGate();
    }
    this.maybeStopTransport();
  }

  private configureRhythmSequence() {
    this.stopRhythmSequence(false);

    if (!this.isPlaying || !this.rhythmConfig.enabled || !this.rhythmGate) {
      this.resetRhythmGate();
      return;
    }

    Tone.Transport.bpm.rampTo(this.rhythmConfig.bpm, 0.12);

    const values = this.rhythmConfig.steps.map((step) => (step ? 1 : 0));
    this.rhythmSequence = new Tone.Sequence<number>(
      (time, value) => {
        if (!this.rhythmGate) {
          return;
        }
        const target = value === 1 ? 1 : 0.001;
        this.rhythmGate.gain.cancelScheduledValues(time);
        this.rhythmGate.gain.setTargetAtTime(target, time, 0.01);
      },
      values,
      this.rhythmConfig.subdivision
    );
    this.rhythmSequence.loop = true;
    this.ensureTransportStarted();
    this.rhythmSequence.start(0);
  }

  private computeSweepTargets(baseFrequencies: number[]) {
    if (baseFrequencies.length === 0) {
      return [];
    }

    if (!this.automationConfig.sweep.enabled) {
      return [...baseFrequencies];
    }

    const anchor = Math.max(20, baseFrequencies[0]);
    const ratio = this.automationConfig.sweep.targetHz / anchor;
    return baseFrequencies.map((frequency) => clamp(20, frequency * ratio, 10000));
  }

  private stopAutomationLoop(resetToBase = true) {
    if (this.automationEventId !== null) {
      Tone.Transport.clear(this.automationEventId);
      this.automationEventId = null;
    }

    if (resetToBase && this.voiceBaseFrequencies.length > 0) {
      const now = Tone.now();
      this.synths.forEach((synth, index) => {
        const base = this.voiceBaseFrequencies[index];
        if (typeof base === 'number') {
          synth.frequency.setValueAtTime(base, now);
        }
      });
    }

    this.maybeStopTransport();
  }

  private configureAutomationLoop() {
    this.stopAutomationLoop(false);

    if (!this.isPlaying || this.synths.length === 0) {
      return;
    }

    const modulationEnabled =
      this.automationConfig.modulation.enabled && this.automationConfig.modulation.depthHz > 0;
    const sweepEnabled = this.automationConfig.sweep.enabled;

    this.voiceSweepTargets = this.computeSweepTargets(this.voiceBaseFrequencies);

    if (!modulationEnabled && !sweepEnabled) {
      this.stopAutomationLoop(true);
      return;
    }

    this.automationStartAt = Tone.now();
    this.ensureTransportStarted();
    this.automationEventId = Tone.Transport.scheduleRepeat((time) => {
      this.applyAutomationAtTime(time);
    }, '16n');
    this.applyAutomationAtTime(Tone.now());
  }

  private resolveSweepProgress(progress: number, curve: SweepConfig['curve']) {
    const clamped = clamp(0, progress, 1);
    if (curve === 'linear') {
      return clamped;
    }

    if (curve === 'exponential') {
      return clamped <= 0 ? 0 : clamped ** 2.2;
    }

    return 0.5 - Math.cos(clamped * Math.PI) / 2;
  }

  private sampleLfoWaveform(phase: number, waveform: ModulationConfig['waveform']) {
    if (waveform === 'triangle') {
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    }

    if (waveform === 'square') {
      return Math.sin(phase) >= 0 ? 1 : -1;
    }

    if (waveform === 'sawtooth') {
      const wrapped = phase / (Math.PI * 2);
      return 2 * (wrapped - Math.floor(wrapped + 0.5));
    }

    return Math.sin(phase);
  }

  private applyAutomationAtTime(time: number) {
    if (this.synths.length === 0 || this.voiceBaseFrequencies.length === 0) {
      return;
    }

    const elapsed = Math.max(0, time - this.automationStartAt);
    const { modulation, sweep } = this.automationConfig;
    const sweepEnabled = sweep.enabled;
    const modulationEnabled = modulation.enabled && modulation.depthHz > 0;
    const sweepProgress = sweepEnabled ? Math.min(1, elapsed / sweep.durationSeconds) : 0;
    const sweepAmount = this.resolveSweepProgress(sweepProgress, sweep.curve);
    const phase = elapsed * Math.PI * 2 * modulation.rateHz;
    const lfoValue = modulationEnabled ? this.sampleLfoWaveform(phase, modulation.waveform) : 0;

    this.synths.forEach((synth, index) => {
      const base = this.voiceBaseFrequencies[index];
      const target = this.voiceSweepTargets[index] ?? base;
      const sweptFrequency = sweepEnabled ? base + (target - base) * sweepAmount : base;
      const modulationOffset = modulationEnabled ? lfoValue * modulation.depthHz : 0;
      const nextFrequency = clamp(20, sweptFrequency + modulationOffset, 10000);
      synth.frequency.setValueAtTime(nextFrequency, time);
    });

    if (sweepEnabled && sweepProgress >= 1 && !modulationEnabled) {
      this.stopAutomationLoop(false);
    }
  }

  private connectMasterToDestination() {
    if (!this.master || this.masterConnected) {
      return;
    }

    this.master.connect(Tone.Destination);
    this.masterConnected = true;
  }

  private async setupAudioBridge() {
    if (typeof document === 'undefined' || !this.master) {
      return;
    }

    if (this.audioBridge) {
      return;
    }

    const rawContext = Tone.getContext().rawContext;
    if (!this.isRealtimeAudioContext(rawContext)) {
      return;
    }
    const destination = rawContext.createMediaStreamDestination();
    this.master.connect(destination);

    const element = document.createElement('audio');
    element.setAttribute('x-webkit-airplay', 'deny');
    element.setAttribute('playsinline', 'true');
    element.setAttribute('webkit-playsinline', 'true');
    element.preload = 'auto';
    element.loop = true;
    element.volume = 0.001;
    element.srcObject = destination.stream;

    this.audioBridge = { element, destination };

    const started = await this.startAudioBridgeElement();
    if (!started) {
      this.connectMasterToDestination();
    }
  }

  private async startAudioBridgeElement() {
    if (!this.audioBridge) {
      return false;
    }

    try {
      await this.audioBridge.element.play();
      return true;
    } catch (error) {
      console.warn('Failed to start audio bridge element.', error);
      return false;
    }
  }

  private isRealtimeAudioContext(
    context: AudioContext | OfflineAudioContext
  ): context is AudioContext {
    return typeof (context as AudioContext).resume === 'function';
  }

  private teardownAudioBridge() {
    if (!this.audioBridge) {
      return;
    }

    const { element, destination } = this.audioBridge;
    element.pause();
    element.srcObject = null;
    element.remove();

    try {
      if (this.master) {
        this.master.disconnect(destination);
      }
      destination.disconnect();
    } catch (error) {
      console.warn('Failed to disconnect audio bridge destination.', error);
    }

    this.audioBridge = null;
    this.connectMasterToDestination();
  }

  private async unlockIOSAudio() {
    if (this.hasUnlocked) {
      return;
    }

    if (typeof document === 'undefined') {
      return;
    }

    const silentAudio = document.createElement('audio');
    silentAudio.setAttribute('x-webkit-airplay', 'deny');
    silentAudio.setAttribute('playsinline', 'true');
    silentAudio.setAttribute('webkit-playsinline', 'true');
    silentAudio.preload = 'auto';
    silentAudio.loop = true;
    silentAudio.volume = 0;
    silentAudio.src =
      'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAQKAAAAAAAAA4SE0lWPAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';

    this.silentAudio = silentAudio;

    try {
      await silentAudio.play();
      this.hasUnlocked = true;
    } catch (error) {
      console.warn('Failed to unlock iOS audio.', error);
    }
  }
}
