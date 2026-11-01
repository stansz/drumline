import { ARP_STEPS, BASS_STEPS, MUSIC_CHORDS } from './config';

export type DrumPart = 'kick' | 'snare' | 'hat';

export const DRUM_PARTS: DrumPart[] = ['kick', 'snare', 'hat'];

export const BACKING_DRUMS: Record<DrumPart, number> = {
  kick: 0.22,
  snare: 0.1,
  hat: 0.04,
};

export interface Theme {
  id: string;
  name: string;
  chords: ReadonlyArray<{ name: string; pad: number[]; bass: number }>;
  bassSteps: number[];
  arpSteps: number[];
  levels: { pad: number; bass: number; arp: number };
  pad: { wave: OscillatorType; cutoffHz: number };
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  kick: { wave: OscillatorType; baseHz: number; sweep: number; decay: number };
  hat: { highpassHz: number; decay: number };
  synth: {
    waves: [OscillatorType, OscillatorType];
    cutoffHz: number;
    decay: number;
    scale: number[];
  };
  drums: Record<DrumPart, number[]>;
}

const NEON: Theme = {
  id: 'neon',
  name: 'Neon',
  chords: MUSIC_CHORDS,
  bassSteps: BASS_STEPS,
  arpSteps: ARP_STEPS,
  levels: { pad: 1, bass: 1, arp: 1 },
  pad: { wave: 'sawtooth', cutoffHz: 900 },
  bassWave: 'triangle',
  arpWave: 'triangle',
  kick: { wave: 'sine', baseHz: 52, sweep: 3.2, decay: 0.3 },
  hat: { highpassHz: 5600, decay: 0.05 },
  synth: {
    waves: ['sawtooth', 'triangle'],
    cutoffHz: 900,
    decay: 0.24,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
  drums: { kick: [], snare: [], hat: [] },
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
  bassSteps: [0, 2, 4, 6, 8, 10, 12, 14],
  arpSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  levels: { pad: 0.6, bass: 0.7, arp: 0.8 },
  pad: { wave: 'square', cutoffHz: 2200 },
  bassWave: 'square',
  arpWave: 'square',
  kick: { wave: 'square', baseHz: 60, sweep: 4, decay: 0.16 },
  hat: { highpassHz: 7000, decay: 0.03 },
  synth: {
    waves: ['square', 'square'],
    cutoffHz: 3000,
    decay: 0.18,
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
  },
  drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
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
  bassSteps: [0, 7, 10],
  arpSteps: [2, 7, 10, 15],
  levels: { pad: 1, bass: 1, arp: 1 },
  pad: { wave: 'triangle', cutoffHz: 700 },
  bassWave: 'sine',
  arpWave: 'sine',
  kick: { wave: 'sine', baseHz: 48, sweep: 2.4, decay: 0.26 },
  hat: { highpassHz: 4200, decay: 0.04 },
  synth: {
    waves: ['triangle', 'sine'],
    cutoffHz: 1200,
    decay: 0.3,
    scale: [55, 57, 60, 62, 64, 67, 69, 72],
  },
  drums: { kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 10, 14] },
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
  bassSteps: [2, 6, 10, 14],
  arpSteps: [0, 3, 6, 8, 11, 14],
  levels: { pad: 0.8, bass: 0.7, arp: 0.8 },
  pad: { wave: 'sawtooth', cutoffHz: 600 },
  bassWave: 'sawtooth',
  arpWave: 'square',
  kick: { wave: 'sine', baseHz: 46, sweep: 4.5, decay: 0.22 },
  hat: { highpassHz: 8200, decay: 0.06 },
  synth: {
    waves: ['sawtooth', 'sawtooth'],
    cutoffHz: 1400,
    decay: 0.2,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
  drums: { kick: [0, 4, 8, 12], snare: [12], hat: [2, 6, 10, 14] },
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
  bassSteps: [0, 3, 6, 8, 10, 13],
  arpSteps: [0, 3, 6, 10, 12, 14],
  levels: { pad: 0.8, bass: 0.6, arp: 0.7 },
  pad: { wave: 'sawtooth', cutoffHz: 1400 },
  bassWave: 'square',
  arpWave: 'sawtooth',
  kick: { wave: 'sine', baseHz: 56, sweep: 3, decay: 0.2 },
  hat: { highpassHz: 6400, decay: 0.04 },
  synth: {
    waves: ['sawtooth', 'square'],
    cutoffHz: 2000,
    decay: 0.16,
    scale: [55, 57, 59, 62, 64, 67, 69, 71],
  },
  drums: { kick: [0, 3, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
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
