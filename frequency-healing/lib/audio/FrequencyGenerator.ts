import * as Tone from 'tone/build/esm';
import type { EffectsConfig } from '@/lib/audio/effects';
import { DEFAULT_EFFECTS } from '@/lib/audio/effects';

export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';

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
  }

  dispose() {
    this.stop();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.master?.dispose();
    this.reverb = null;
    this.delay = null;
    this.master = null;
    this.initialized = false;
  }
}
