import type { EnemyType, TowerType } from './sim';

export const GRID_COLS = 16;
export const GRID_ROWS = 8;
export const STEPS_PER_BAR = 16;

export const BPM = 120;
export const stepSeconds = (bpm: number): number => 60 / bpm / 4;
export const FAST_BPM = 240;

export const PATH_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [13, 1],
  [13, 4],
  [2, 4],
  [2, 6],
  [15, 6],
];

export const START_MONEY = 100;
export const START_LIVES = 20;
export const WAVE_CLEAR_BONUS = 40;
export const SELL_REFUND = 0.7;

export const CHORD_BONUS_PER_TOWER = 0.25;
export const CHORD_MAX_TOWERS = 4;

export interface TowerStats {
  cost: number;
  range: number;
  damage: number;
  splash: number;
  chain: number;
}

export const TOWERS: Record<TowerType, TowerStats> = {
  kick: { cost: 50, range: 2.5, damage: 12, splash: 1.0, chain: 0 },
  hat: { cost: 35, range: 3.5, damage: 3, splash: 0, chain: 0 },
  synth: { cost: 70, range: 4, damage: 14, splash: 0, chain: 2 },
};

export const TOWER_INFO: Record<TowerType, { name: string; role: string; description: string }> = {
  kick: { name: 'Kick', role: 'Splash', description: 'Hits everything near its target, once per bar.' },
  hat: { name: 'Hat', role: 'Rapid', description: 'Small hits, four times per bar.' },
  synth: { name: 'Synth', role: 'Chain', description: 'Zaps its target, then arcs to 2 more enemies at half damage, once per bar.' },
};

export interface EnemyStats {
  hp: number;
  speed: number;
  bounty: number;
  leak: number;
}

export const ENEMIES: Record<EnemyType, EnemyStats> = {
  blip: { hp: 30, speed: 0.16, bounty: 5, leak: 1 },
  runner: { hp: 16, speed: 0.3, bounty: 4, leak: 1 },
  brute: { hp: 120, speed: 0.1, bounty: 15, leak: 3 },
  boss: { hp: 900, speed: 0.07, bounty: 0, leak: 20 },
};

export interface WaveGroup {
  type: EnemyType;
  count: number;
  gapSteps: number;
}

export const WAVES: WaveGroup[][] = [
  [{ type: 'blip', count: 8, gapSteps: 8 }],
  [
    { type: 'blip', count: 10, gapSteps: 6 },
    { type: 'runner', count: 6, gapSteps: 8 },
  ],
  [
    { type: 'brute', count: 6, gapSteps: 16 },
    { type: 'runner', count: 10, gapSteps: 4 },
  ],
  [
    { type: 'blip', count: 14, gapSteps: 4 },
    { type: 'brute', count: 8, gapSteps: 12 },
  ],
  [
    { type: 'boss', count: 1, gapSteps: 0 },
    { type: 'runner', count: 12, gapSteps: 6 },
  ],
];

export const MUSIC_CHORDS = [
  { name: 'Am7', pad: [57, 60, 64, 67], bass: 45 },
  { name: 'Fmaj7', pad: [53, 57, 60, 64], bass: 41 },
  { name: 'Cadd9', pad: [55, 60, 62, 64], bass: 48 },
  { name: 'Gsus', pad: [55, 60, 62, 67], bass: 43 },
];

export const BASS_STEPS = [0, 6, 10];
export const ARP_STEPS = [0, 2, 4, 6, 8, 10, 12, 14];

export const MIX = {
  pad: 0.16,
  bass: 0.3,
  arp: 0.08,
  kick: 0.85,
  hat: 0.2,
  synth: 0.2,
  kill: 0.08,
  metronome: 0.04,
  reverbSend: 0.3,
  delaySend: 0.22,
  delayFeedback: 0.35,
  duckAmount: 0.45,
  duckRelease: 0.18,
} as const;

export const PALETTE = {
  bg: '#12101a',
  path: '#5a4d85',
  grid: '#1c1829',
  kick: '#ff3d81',
  hat: '#2de2e6',
  synth: '#f9f871',
  enemy: '#f5f1ff',
  playhead: '#ffffff',
} as const;
