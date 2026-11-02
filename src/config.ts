import type { EnemyType, TowerType } from './sim';

export const GRID_COLS = 16;
export const GRID_ROWS = 8;
export const STEPS_PER_BAR = 16;
export const AUTO_WAVE_STEPS = 4 * STEPS_PER_BAR;

export const BPM = 120;
export const stepSeconds = (bpm: number): number => 60 / bpm / 4;
export const SPEED_BPMS = [BPM, 180, 240];

export const PATH_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [13, 1],
  [13, 4],
  [2, 4],
  [2, 6],
  [15, 6],
];

export const SELL_REFUND = 0.7;

// Lives lost when each boss gets through, in order. Later bosses use ENEMIES.boss.leak.
export const BOSS_LEAKS: readonly number[] = [5, 10, 20];

export const CHORD_BONUS_PER_TOWER = 0.25;
export const CHORD_MAX_TOWERS = 6;

// How many of each sound can start on one step, because each one costs audio CPU.
// Towers past the limit still fire and deal damage.
export const TOWER_VOICE_LIMITS: Record<TowerType, number> = { kick: 2, hat: 2, synth: 3 };
export const KILL_VOICE_LIMIT = 2;

export interface TowerStats {
  cost: number;
  range: number;
  damage: number;
  splash: number;
  chain: number;
}

export const TOWERS: Record<TowerType, TowerStats> = {
  kick: { cost: 50, range: 2.5, damage: 12, splash: 1.0, chain: 0 },
  hat: { cost: 40, range: 3.5, damage: 3, splash: 0, chain: 0 },
  synth: { cost: 70, range: 4, damage: 18, splash: 0, chain: 2 },
};

export const MAX_TOWER_LEVEL = 3;

// One level bought on a tower: its price as a share of the tower's cost, and what it adds.
export interface TowerUpgrade {
  costShare: number;
  damage?: number;
  range?: number;
  splash?: number;
  chain?: number;
}

// Levels 2 and 3 of each tower, in order. They never change when a tower fires or chords.
export const TOWER_UPGRADES: Record<TowerType, readonly TowerUpgrade[]> = {
  kick: [
    { costShare: 1, damage: 24 },
    { costShare: 1.5, damage: 36, splash: 0.75 },
  ],
  hat: [
    { costShare: 1, range: 1 },
    { costShare: 1.5, damage: 3 },
  ],
  synth: [
    { costShare: 1, damage: 12 },
    { costShare: 1.5, damage: 42, chain: 1 },
  ],
};

export const TOWER_INFO: Record<
  TowerType,
  { name: string; role: string; description: string; upgrades: readonly [string, string] }
> = {
  kick: { name: 'Kick', role: 'Splash', description: 'Hits everything near its target, once per bar.', upgrades: ['more damage', 'wider splash and more damage'] },
  hat: { name: 'Hat', role: 'Rapid', description: 'Small hits, four times per bar.', upgrades: ['more range', 'more damage'] },
  synth: { name: 'Synth', role: 'Chain', description: 'Zaps its target, then arcs to 2 more enemies at half damage, once per bar.', upgrades: ['more damage', 'much more damage and one more chain link'] },
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

// Every game value the sim reads. Balance sweeps pass their own; the game uses DEFAULT_RULES.
export interface Rules {
  towers: Record<TowerType, TowerStats>;
  enemies: Record<EnemyType, EnemyStats>;
  chordBonusPerTower: number;
  chordMaxTowers: number;
  sellRefund: number;
  bossLeaks: readonly number[];
  upgrades: Record<TowerType, readonly TowerUpgrade[]>;
}

export const DEFAULT_RULES: Rules = {
  towers: TOWERS,
  enemies: ENEMIES,
  chordBonusPerTower: CHORD_BONUS_PER_TOWER,
  chordMaxTowers: CHORD_MAX_TOWERS,
  sellRefund: SELL_REFUND,
  bossLeaks: BOSS_LEAKS,
  upgrades: TOWER_UPGRADES,
};

export function towerStats(rules: Rules, type: TowerType, level: number): TowerStats {
  const stats = { ...rules.towers[type] };
  for (const upgrade of rules.upgrades[type].slice(0, level - 1)) {
    stats.damage += upgrade.damage ?? 0;
    stats.range += upgrade.range ?? 0;
    stats.splash += upgrade.splash ?? 0;
    stats.chain += upgrade.chain ?? 0;
  }
  return stats;
}

// The price of the level after `level`, or null when there isn't one.
export function upgradeCost(rules: Rules, type: TowerType, level: number): number | null {
  const upgrade = rules.upgrades[type][level - 1];
  if (!upgrade) return null;
  return Math.round(rules.towers[type].cost * upgrade.costShare);
}

export function towerSpent(rules: Rules, type: TowerType, level: number): number {
  let spent = rules.towers[type].cost;
  for (let current = 1; current < level; current += 1) {
    spent += upgradeCost(rules, type, current) ?? 0;
  }
  return spent;
}

export interface WaveGroup {
  type: EnemyType;
  count: number;
  gapSteps: number;
  hp: number;
}

// See docs/balance.md for how these numbers were chosen and how to retune them.
export interface WaveCurve {
  waves: number;
  bossEvery: number;
  bossBudget: number;
  bossHealthCap: number;
  baseHealth: number;
  ramp: number;
  growth: number;
  baseEnemies: number;
  enemiesPerWave: number;
  maxEnemies: number;
}

export const WAVE_CURVE: WaveCurve = {
  waves: 30,
  bossEvery: 10,
  bossBudget: 1,
  bossHealthCap: 21000,
  baseHealth: 240,
  ramp: 0.3,
  growth: 1.1,
  baseEnemies: 8,
  enemiesPerWave: 0.6,
  maxEnemies: 30,
};

export type DifficultyId = 'easy' | 'hard';

export interface Difficulty {
  id: DifficultyId;
  name: string;
  startMoney: number;
  startLives: number;
  waveBonus: number;
  healthScale: number;
  curve: WaveCurve;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    startMoney: 150,
    startLives: 30,
    waveBonus: 40,
    healthScale: 0.5,
    curve: WAVE_CURVE,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    startMoney: 100,
    startLives: 20,
    waveBonus: 20,
    healthScale: 1,
    curve: WAVE_CURVE,
  },
};

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
