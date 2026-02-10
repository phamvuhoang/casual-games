import * as Tone from 'tone/build/esm';
import { isIOSDevice } from '@/lib/utils/platform';
import type { EffectsConfig } from '@/lib/audio/effects';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';

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
  enableIOSAudioBridge?: boolean;
}

export class FrequencyGenerator {
  private synths: Tone.Synth[] = [];
  private voicePanners: Tone.Panner[] = [];
  private voiceTremolos: Tone.Tremolo[] = [];
  private master: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private analyser: AnalyserNode | null = null;
  private ambientType: AmbientType = 'none';
  private ambientNoise: Tone.Noise | null = null;
  private ambientFilter: Tone.Filter | null = null;
  private ambientGain: Tone.Gain | null = null;
  private ambientLoop: Tone.Loop | null = null;
  private ambientSynth: Tone.MetalSynth | null = null;
  private silentAudio: HTMLAudioElement | null = null;
  private hasUnlocked = false;
  private initialized = false;
  private lastEffects: EffectsConfig = DEFAULT_EFFECTS;
  private lastFrequencies: FrequencyConfig[] = [];
  private masterVolume = 1;
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

    if (isIOSDevice()) {
      this.attachIOSLifecycleHandlers();
      this.configureIOSAudioSession();

      if (typeof options.enableIOSAudioBridge === 'boolean') {
        this.audioBridgeEnabled = options.enableIOSAudioBridge;
        if (!this.audioBridgeEnabled) {
          this.teardownAudioBridge();
        }
      }
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

  play(frequencies: FrequencyConfig[]) {
    if (isIOSDevice()) {
      void this.ensureAudioRunning();
    }

    if (!this.master || !this.reverb || !this.delay) {
      return;
    }

    this.stopSynths(true);
    this.lastFrequencies = frequencies.map((config) => ({ ...config }));

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
        panner.connect(this.reverb!);
        this.voicePanners.push(panner);
      } else {
        destination.connect(this.reverb!);
      }
      synth.triggerAttack(config.frequency);
      return synth;
    });
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

    if (type === 'bells') {
      const synth = new Tone.MetalSynth({
        envelope: { attack: 0.01, decay: 1.6, release: 2.2 },
        harmonicity: 4.5,
        modulationIndex: 28,
        resonance: 6000,
        octaves: 1.5
      });
      synth.frequency.value = 280;
      const gain = new Tone.Gain(0.12);
      synth.connect(gain);
      gain.connect(destination);

      const notes = [440, 523.25, 659.25, 783.99, 987.77];
      const loop = new Tone.Loop((time) => {
        const note = notes[Math.floor(Math.random() * notes.length)];
        synth.triggerAttackRelease(note, '2n', time, 0.6);
      }, '2n');

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
      loop.start(0);

      this.ambientSynth = synth;
      this.ambientGain = gain;
      this.ambientLoop = loop;
      return;
    }

    const noiseType = type === 'forest' ? 'brown' : 'pink';
    const filterFrequency = type === 'ocean' ? 320 : type === 'forest' ? 520 : 800;
    const gainLevel = type === 'ocean' ? 0.18 : type === 'forest' ? 0.14 : 0.22;

    const noise = new Tone.Noise(noiseType).start();
    const filter = new Tone.Filter({ type: 'lowpass', frequency: filterFrequency, Q: 1 });
    const gain = new Tone.Gain(gainLevel);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    this.ambientNoise = noise;
    this.ambientFilter = filter;
    this.ambientGain = gain;
  }

  setMasterVolume(value: number) {
    this.masterVolume = value;
    if (this.master) {
      this.master.gain.value = value;
    }
  }

  stop() {
    this.stopSynths();
  }

  dispose() {
    this.stop();
    this.stopAmbient();
    this.teardownAudioBridge();
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
    this.master = null;
    this.initialized = false;
    this.masterConnected = false;
    this.resumeTask = null;
  }

  private stopAmbient(preserveType = false) {
    if (this.ambientLoop) {
      Tone.Transport.stop();
    }
    this.ambientLoop?.stop();
    this.ambientLoop?.dispose();
    this.ambientSynth?.dispose();
    this.ambientNoise?.stop();
    this.ambientNoise?.dispose();
    this.ambientFilter?.dispose();
    this.ambientGain?.dispose();

    this.ambientLoop = null;
    this.ambientSynth = null;
    this.ambientNoise = null;
    this.ambientFilter = null;
    this.ambientGain = null;
    if (!preserveType) {
      this.ambientType = 'none';
    }
  }

  private stopSynths(preserveFrequencies = false) {
    this.synths.forEach((synth) => {
      synth.triggerRelease();
      synth.dispose();
    });
    this.synths = [];
    this.voicePanners.forEach((panner) => panner.dispose());
    this.voicePanners = [];
    this.voiceTremolos.forEach((tremolo) => tremolo.dispose());
    this.voiceTremolos = [];
    this.stopAmbient();
    if (!preserveFrequencies) {
      this.lastFrequencies = [];
    }
  }

  private async createAudioGraph(effects: EffectsConfig) {
    this.master = new Tone.Gain(1);
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
    this.stopAmbient(true);
    this.teardownAudioBridge();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.master?.dispose();
    this.reverb = null;
    this.delay = null;
    this.master = null;
    this.analyser = null;
    this.masterConnected = false;
    this.initialized = false;
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
