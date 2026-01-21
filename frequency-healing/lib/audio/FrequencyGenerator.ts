import * as Tone from 'tone/build/esm';
import type { EffectsConfig } from '@/lib/audio/effects';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';

export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';
export type AmbientType = 'none' | 'rain' | 'ocean' | 'forest' | 'bells';

export interface FrequencyConfig {
  frequency: number;
  volume: number;
  waveform: WaveformType;
}

export class FrequencyGenerator {
  private synths: Tone.Synth[] = [];
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
  private initialized = false;

  async initialize(effects: EffectsConfig = DEFAULT_EFFECTS) {
    if (this.initialized) {
      this.updateEffects(effects);
      return;
    }

    await Tone.start();

    this.master = new Tone.Gain(1).toDestination();
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

    this.initialized = true;
  }

  getAnalyser() {
    return this.analyser;
  }

  updateEffects(effects: EffectsConfig) {
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
    if (!this.master || !this.reverb || !this.delay) {
      return;
    }

    this.stop();

    this.synths = frequencies.map((config) => {
      const synth = new Tone.Synth({
        oscillator: { type: config.waveform },
        envelope: { attack: 1.6, decay: 0.2, sustain: 0.9, release: 2.2 }
      });

      synth.volume.value = Tone.gainToDb(config.volume);
      synth.connect(this.reverb!);
      synth.triggerAttack(config.frequency);
      return synth;
    });
  }

  setAmbientLayer(type: AmbientType) {
    if (!this.reverb || !this.master) {
      return;
    }

    if (type === this.ambientType) {
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
    if (this.master) {
      this.master.gain.value = value;
    }
  }

  stop() {
    this.synths.forEach((synth) => {
      synth.triggerRelease();
      synth.dispose();
    });
    this.synths = [];
    this.stopAmbient();
  }

  dispose() {
    this.stop();
    this.stopAmbient();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.master?.dispose();
    this.reverb = null;
    this.delay = null;
    this.master = null;
    this.initialized = false;
  }

  private stopAmbient() {
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
    this.ambientType = 'none';
  }
}
