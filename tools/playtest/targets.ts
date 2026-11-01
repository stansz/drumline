import type { Difficulty, DifficultyId, Rules } from '../../src/config';
import { bossBound } from './bound';
import type { Summary } from './report';

export type Metric = 'winRate' | 'cleanWinRate' | 'bossBoundShare' | 'bossBotShare';

export interface Target {
  id: string;
  difficulty: DifficultyId;
  metric: Metric;
  min?: number;
  max?: number;
}

// Sweeps use random policies, not strong players, so these targets only support coarse changes.
export const TARGETS: Target[] = [
  { id: 'hard-bots-lose', difficulty: 'hard', metric: 'winRate', max: 0.01 },
  { id: 'hard-boss-killable', difficulty: 'hard', metric: 'bossBoundShare', max: 0.9 },
  { id: 'hard-bots-fall-short', difficulty: 'hard', metric: 'bossBotShare', max: 0.95 },
  { id: 'easy-bots-win', difficulty: 'easy', metric: 'winRate', min: 0.4 },
  { id: 'easy-clean-wins', difficulty: 'easy', metric: 'cleanWinRate', min: 0.5 },
  { id: 'easy-boss-killable', difficulty: 'easy', metric: 'bossBoundShare', max: 0.9 },
];

export interface TargetCheck {
  id: string;
  difficulty: DifficultyId;
  metric: Metric;
  value: number;
  min: number | null;
  max: number | null;
  pass: boolean;
  margin: number;
}

export function metricsFor(
  summary: Summary,
  difficulty: Difficulty,
  rules: Rules,
): Record<Metric, number> {
  const bound = bossBound(summary.finalBossWave, difficulty, rules);
  return {
    winRate: summary.winRate,
    cleanWinRate: summary.cleanWinRate,
    bossBoundShare: bound.bossHp / bound.boardDamage,
    bossBotShare: Math.min(1, summary.bestFinalBossDamage / bound.bossHp),
  };
}

export function checkTarget(target: Target, value: number): TargetCheck {
  const min = target.min ?? null;
  const max = target.max ?? null;
  const margins: number[] = [];
  if (min !== null) margins.push((value - min) / min);
  if (max !== null) margins.push((max - value) / max);
  const margin = margins.length === 0 ? 0 : Math.min(...margins);
  return {
    id: target.id,
    difficulty: target.difficulty,
    metric: target.metric,
    value,
    min,
    max,
    pass: margin >= 0,
    margin,
  };
}
