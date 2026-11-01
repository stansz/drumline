import { ARP_STEPS, BASS_STEPS, MIX, MUSIC_CHORDS } from './config';

export type DrumPart = 'kick' | 'snare' | 'hat';
export type Wave = OscillatorType | 'pulse';
export type NoiseKind = 'white' | 'chip' | 'metal';

export const DRUM_PARTS: DrumPart[] = ['kick', 'snare', 'hat'];

export interface Theme {
  id: string;
  name: string;
  chords: ReadonlyArray<{ name: string; pad: number[]; bass: number }>;
  swing: number;
  crackle: number;
  space: {
    reverbSend: number;
    reverbSeconds: number;
    trim: number;
    delaySend: number;
    delayFeedback: number;
    toneHz: number;
    crush: number;
  };
  chord: {
    style: 'hold' | 'stab' | 'none';
    steps: number[];
    wave: Wave;
    cutoffHz: number;
    decay: number;
    level: number;
    wobbleCents: number;
  };
  bass: {
    steps: number[];
    wave: Wave;
    decay: number;
    level: number;
    filter: { startHz: number; endHz: number; q: number } | null;
    octaveSteps: number[];
    ghostSteps: number[];
    sweepBars: number;
  };
  arp: {
    steps: number[];
    rate: number;
    wave: Wave;
    decay: number;
    level: number;
    minLevel: number;
  };
  drums: Record<DrumPart, number[]>;
  drumLevels: Record<DrumPart, number>;
  drumKit: { snareHz: number; snareDecay: number; hatDecay: number };
  kick: {
    wave: Wave;
    baseHz: number;
    sweep: number;
    sweepTime: number;
    attack: number;
    decay: number;
    click: number;
  };
  hat: {
    noise: NoiseKind;
    filter: BiquadFilterType;
    filterHz: number;
    q: number;
    decay: number;
    level: number;
  };
  synth: {
    waves: [Wave, Wave];
    secondRatio: number;
    filter: BiquadFilterType;
    filterHz: number;
    filterEndHz: number | null;
    q: number;
    attack: number;
    decay: number;
    scale: number[];
  };
}

const NEON: Theme = {
  id: 'neon',
  name: 'Neon',
  chords: MUSIC_CHORDS,
  swing: 0,
  crackle: 0,
  space: {
    reverbSend: MIX.reverbSend,
    reverbSeconds: 2.2,
    trim: 1,
    delaySend: MIX.delaySend,
    delayFeedback: MIX.delayFeedback,
    toneHz: 20000,
    crush: 0,
  },
  chord: {
    style: 'hold',
    steps: [0],
    wave: 'sawtooth',
    cutoffHz: 900,
    decay: 0,
    level: 1,
    wobbleCents: 0,
  },
  bass: {
    steps: BASS_STEPS,
    wave: 'triangle',
    decay: 0.3,
    level: 1,
    filter: null,
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 0,
  },
  arp: { steps: ARP_STEPS, rate: 2, wave: 'triangle', decay: 0.18, level: 1, minLevel: 0 },
  drums: { kick: [], snare: [], hat: [] },
  drumLevels: { kick: 0, snare: 0, hat: 0 },
  drumKit: { snareHz: 1800, snareDecay: 0.12, hatDecay: 0.03 },
  kick: { wave: 'sine', baseHz: 52, sweep: 3.2, sweepTime: 0.14, attack: 0.005, decay: 0.3, click: 0 },
  hat: { noise: 'white', filter: 'highpass', filterHz: 5600, q: 0.8, decay: 0.05, level: 1 },
  synth: {
    waves: ['sawtooth', 'triangle'],
    secondRatio: 0.5,
    filter: 'lowpass',
    filterHz: 900,
    filterEndHz: null,
    q: 1.5,
    attack: 0.01,
    decay: 0.24,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
};

const CHIPTUNE: Theme = {
  id: 'chiptune',
  name: 'Chiptune',
  chords: [
    { name: 'C', pad: [60, 64, 67, 72], bass: 48 },
    { name: 'G', pad: [59, 62, 67, 71], bass: 43 },
    { name: 'Am', pad: [57, 60, 64, 69], bass: 45 },
    { name: 'F', pad: [57, 60, 65, 69], bass: 41 },
  ],
  swing: 0,
  crackle: 0,
  space: {
    reverbSend: 0,
    reverbSeconds: 0.4,
    trim: 2.7,
    delaySend: 0,
    delayFeedback: 0.2,
    toneHz: 12000,
    crush: 0.6,
  },
  chord: {
    style: 'none',
    steps: [],
    wave: 'square',
    cutoffHz: 2200,
    decay: 0,
    level: 0,
    wobbleCents: 0,
  },
  bass: {
    steps: [0, 2, 4, 6, 8, 10, 12, 14],
    wave: 'triangle',
    decay: 0.12,
    level: 1.2,
    filter: null,
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 0,
  },
  arp: {
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    rate: 1,
    wave: 'pulse',
    decay: 0.08,
    level: 1.1,
    minLevel: 0.7,
  },
  drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 6, 10, 14] },
  drumLevels: { kick: 0.3, snare: 0.16, hat: 0.07 },
  drumKit: { snareHz: 2600, snareDecay: 0.07, hatDecay: 0.02 },
  kick: { wave: 'square', baseHz: 90, sweep: 5, sweepTime: 0.05, attack: 0.002, decay: 0.09, click: 0 },
  hat: { noise: 'chip', filter: 'highpass', filterHz: 3000, q: 0.8, decay: 0.035, level: 1 },
  synth: {
    waves: ['pulse', 'pulse'],
    secondRatio: 1,
    filter: 'lowpass',
    filterHz: 6000,
    filterEndHz: null,
    q: 0.7,
    attack: 0.002,
    decay: 0.12,
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
  },
};

const LOFI: Theme = {
  id: 'lofi',
  name: 'Lo-fi',
  chords: [
    { name: 'Dm9', pad: [53, 57, 60, 64], bass: 38 },
    { name: 'G13', pad: [53, 59, 64, 69], bass: 43 },
    { name: 'Cmaj9', pad: [52, 59, 62, 67], bass: 48 },
    { name: 'Am9', pad: [55, 60, 64, 71], bass: 45 },
  ],
  swing: 0.22,
  crackle: 0.12,
  space: {
    reverbSend: 0.12,
    reverbSeconds: 0.9,
    trim: 1,
    delaySend: 0.1,
    delayFeedback: 0.25,
    toneHz: 3600,
    crush: 0,
  },
  chord: {
    style: 'stab',
    steps: [0, 10],
    wave: 'sine',
    cutoffHz: 1500,
    decay: 1.1,
    level: 1.7,
    wobbleCents: 9,
  },
  bass: {
    steps: [0, 7, 10],
    wave: 'sine',
    decay: 0.45,
    level: 1.1,
    filter: null,
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 0,
  },
  arp: { steps: [6, 14], rate: 2, wave: 'sine', decay: 0.3, level: 0.8, minLevel: 0 },
  drums: { kick: [0, 10], snare: [8], hat: [0, 3, 6, 8, 11, 14] },
  drumLevels: { kick: 0.34, snare: 0.19, hat: 0.06 },
  drumKit: { snareHz: 1300, snareDecay: 0.16, hatDecay: 0.04 },
  kick: { wave: 'sine', baseHz: 44, sweep: 2, sweepTime: 0.08, attack: 0.012, decay: 0.24, click: 0 },
  hat: { noise: 'white', filter: 'bandpass', filterHz: 3400, q: 0.7, decay: 0.05, level: 0.7 },
  synth: {
    waves: ['sine', 'triangle'],
    secondRatio: 2,
    filter: 'lowpass',
    filterHz: 1400,
    filterEndHz: null,
    q: 0.7,
    attack: 0.02,
    decay: 0.45,
    scale: [55, 57, 60, 62, 64, 67, 69, 72],
  },
};

const TECHNO: Theme = {
  id: 'techno',
  name: 'Techno',
  chords: [
    { name: 'Am', pad: [57, 60, 64], bass: 45 },
    { name: 'Am', pad: [57, 60, 64], bass: 45 },
    { name: 'F', pad: [57, 60, 65], bass: 41 },
    { name: 'Em', pad: [55, 59, 64], bass: 40 },
  ],
  swing: 0,
  crackle: 0,
  space: {
    reverbSend: 0.45,
    reverbSeconds: 3.2,
    trim: 1,
    delaySend: 0.32,
    delayFeedback: 0.5,
    toneHz: 9000,
    crush: 0,
  },
  chord: {
    style: 'stab',
    steps: [3, 6, 11],
    wave: 'sawtooth',
    cutoffHz: 1800,
    decay: 0.16,
    level: 1.5,
    wobbleCents: 0,
  },
  bass: {
    steps: [2, 6, 10, 14],
    wave: 'sawtooth',
    decay: 0.18,
    level: 0.8,
    filter: { startHz: 2400, endHz: 180, q: 12 },
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 8,
  },
  arp: { steps: [], rate: 2, wave: 'square', decay: 0.1, level: 0, minLevel: 0 },
  drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  drumLevels: { kick: 0.42, snare: 0.12, hat: 0.1 },
  drumKit: { snareHz: 3200, snareDecay: 0.1, hatDecay: 0.09 },
  kick: { wave: 'sine', baseHz: 42, sweep: 6, sweepTime: 0.06, attack: 0.002, decay: 0.32, click: 0.25 },
  hat: { noise: 'metal', filter: 'highpass', filterHz: 7000, q: 1, decay: 0.05, level: 1 },
  synth: {
    waves: ['sawtooth', 'sawtooth'],
    secondRatio: 1.005,
    filter: 'lowpass',
    filterHz: 2400,
    filterEndHz: 500,
    q: 8,
    attack: 0.002,
    decay: 0.16,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
};

const FUNK: Theme = {
  id: 'funk',
  name: 'Funk',
  chords: [
    { name: 'E9', pad: [56, 62, 66, 71], bass: 40 },
    { name: 'A13', pad: [55, 61, 66, 71], bass: 45 },
    { name: 'E9', pad: [56, 62, 66, 71], bass: 40 },
    { name: 'B9', pad: [57, 61, 63, 66], bass: 47 },
  ],
  swing: 0.14,
  crackle: 0,
  space: {
    reverbSend: 0.08,
    reverbSeconds: 0.35,
    trim: 2.4,
    delaySend: 0,
    delayFeedback: 0.1,
    toneHz: 12000,
    crush: 0,
  },
  chord: {
    style: 'stab',
    steps: [2, 5, 10, 13],
    wave: 'sawtooth',
    cutoffHz: 1700,
    decay: 0.09,
    level: 1.7,
    wobbleCents: 0,
  },
  bass: {
    steps: [0, 3, 6, 8, 10, 13],
    wave: 'sawtooth',
    decay: 0.16,
    level: 0.85,
    filter: { startHz: 1800, endHz: 350, q: 3 },
    octaveSteps: [6, 13],
    ghostSteps: [3, 8],
    sweepBars: 0,
  },
  arp: { steps: [], rate: 2, wave: 'sawtooth', decay: 0.1, level: 0, minLevel: 0 },
  drums: { kick: [0, 3, 10], snare: [4, 7, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  drumLevels: { kick: 0.36, snare: 0.18, hat: 0.06 },
  drumKit: { snareHz: 1900, snareDecay: 0.1, hatDecay: 0.02 },
  kick: { wave: 'sine', baseHz: 62, sweep: 3, sweepTime: 0.05, attack: 0.002, decay: 0.13, click: 0.15 },
  hat: { noise: 'white', filter: 'highpass', filterHz: 9000, q: 2, decay: 0.018, level: 1 },
  synth: {
    waves: ['sawtooth', 'square'],
    secondRatio: 0.5,
    filter: 'bandpass',
    filterHz: 500,
    filterEndHz: 2400,
    q: 6,
    attack: 0.005,
    decay: 0.2,
    scale: [55, 57, 59, 62, 64, 67, 69, 71],
  },
};

export const DEFAULT_THEME = NEON;

export const THEMES: Theme[] = [NEON, CHIPTUNE, LOFI, TECHNO, FUNK];

export function themeById(id: string | null): Theme {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

export function nextTheme(current: Theme): Theme {
  const index = THEMES.indexOf(current);
  return THEMES[(index + 1) % THEMES.length] ?? DEFAULT_THEME;
}
