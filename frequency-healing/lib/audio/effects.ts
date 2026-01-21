export interface ReverbSettings {
  decay: number;
  wet: number;
}

export interface DelaySettings {
  time: string;
  feedback: number;
  wet: number;
}

export interface EffectsConfig {
  reverb?: ReverbSettings;
  delay?: DelaySettings;
}

export const DEFAULT_EFFECTS: EffectsConfig = {
  reverb: { decay: 4.2, wet: 0.3 },
  delay: { time: '8n', feedback: 0.2, wet: 0.2 }
};
