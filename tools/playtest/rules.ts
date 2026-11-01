import {
  DEFAULT_RULES,
  DIFFICULTIES,
  type Difficulty,
  type DifficultyId,
  type EnemyStats,
  type Rules,
  type TowerStats,
  type WaveCurve,
} from '../../src/config';
import type { EnemyType, TowerType } from '../../src/sim';

export interface RulesPatch {
  towers?: Partial<Record<TowerType, Partial<TowerStats>>>;
  enemies?: Partial<Record<EnemyType, Partial<EnemyStats>>>;
  chordBonusPerTower?: number;
  chordMaxTowers?: number;
  sellRefund?: number;
}

export interface DifficultyPatch {
  startMoney?: number;
  startLives?: number;
  waveBonus?: number;
  healthScale?: number;
  curve?: Partial<WaveCurve>;
}

const TOWER_TYPES = Object.keys(DEFAULT_RULES.towers) as TowerType[];
const ENEMY_TYPES = Object.keys(DEFAULT_RULES.enemies) as EnemyType[];

export function resolveRules(patch: RulesPatch = {}): Rules {
  const towers = {} as Record<TowerType, TowerStats>;
  for (const type of TOWER_TYPES) {
    towers[type] = { ...DEFAULT_RULES.towers[type], ...patch.towers?.[type] };
  }

  const enemies = {} as Record<EnemyType, EnemyStats>;
  for (const type of ENEMY_TYPES) {
    enemies[type] = { ...DEFAULT_RULES.enemies[type], ...patch.enemies?.[type] };
  }

  return {
    towers,
    enemies,
    chordBonusPerTower: patch.chordBonusPerTower ?? DEFAULT_RULES.chordBonusPerTower,
    chordMaxTowers: patch.chordMaxTowers ?? DEFAULT_RULES.chordMaxTowers,
    sellRefund: patch.sellRefund ?? DEFAULT_RULES.sellRefund,
  };
}

export function resolveDifficulty(id: DifficultyId, patch: DifficultyPatch = {}): Difficulty {
  const base = DIFFICULTIES[id];
  return {
    ...base,
    ...patch,
    curve: { ...base.curve, ...patch.curve },
  };
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function configHash(rules: Rules, difficulty: Difficulty): string {
  return fnv1a(JSON.stringify({ rules, difficulty }));
}
