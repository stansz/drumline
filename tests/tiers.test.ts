import { describe, expect, it } from 'vitest';
import { makeRng } from '../tools/playtest/bots';
import { runGame, type Job } from '../tools/playtest/job';
import { buildableCells, type BuildPlan } from '../tools/playtest/plans';
import type { Summary } from '../tools/playtest/report';
import { formatTierTable, tierPolicy } from '../tools/playtest/tiers';

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    config: 'config-a',
    difficulty: 'hard',
    games: 10,
    wins: 5,
    winRate: 0.5,
    cleanWinRate: 0.4,
    waveP10: 10,
    waveP50: 20,
    waveP90: 30,
    deathsByWave: {},
    damageShare: { kick: 0.2, hat: 0.3, synth: 0.5 },
    meanChordAverage: 1,
    meanIdleNoteShare: 0,
    finalBossWave: 30,
    bestFinalBossDamage: 1000,
    damagePerDollar: { kick: 1, hat: 2, synth: 3 },
    byWave: [],
    ...overrides,
  };
}

function plan(): BuildPlan {
  const cells = buildableCells();
  const steps: BuildPlan = [];
  for (const cell of cells.slice(0, 3)) {
    steps.push({ type: 'hat', col: cell[0], row: cell[1] });
  }
  return steps;
}

describe('tierPolicy', () => {
  it('sets the casual limits', () => {
    const policy = tierPolicy('casual', makeRng(1));
    expect(policy.maxTowersPerWave).toBe(1);
    expect(policy.topK).toBe(6);
    expect(policy.midWave).toBe(false);
    expect(policy.classMask).toBe(15);
    expect(policy.earlyBias).toBe(0);
  });

  it('sets the strong limits', () => {
    const policy = tierPolicy('strong', makeRng(1));
    expect(policy.maxTowersPerWave).toBeNull();
    expect(policy.topK).toBe(2);
    expect(policy.midWave).toBe(true);
  });

  it('gives every type a weight of at least 0.2', () => {
    const policy = tierPolicy('competent', makeRng(1));
    expect(policy.weights.kick).toBeGreaterThanOrEqual(0.2);
    expect(policy.weights.hat).toBeGreaterThanOrEqual(0.2);
    expect(policy.weights.synth).toBeGreaterThanOrEqual(0.2);
  });
});

describe('runGame with a tier bot', () => {
  const job: Job = {
    id: 'tiers-test',
    difficulty: 'hard',
    seed: 1,
    games: 3,
    bot: { kind: 'tier', tier: 'casual' },
  };

  it('is deterministic and buys at most one tower a wave', () => {
    expect(runGame(job, 0)).toBe(runGame(job, 0));
    const record = JSON.parse(runGame(job, 0));
    expect(record.towers).toBeLessThanOrEqual(record.wave);
  });

  it('records the policy that played', () => {
    const record = JSON.parse(runGame(job, 0));
    expect(record.policy.topK).toBe(6);
  });
});

describe('runGame with a plan bot', () => {
  it('has no policy', () => {
    const job: Job = {
      id: 'tiers-plan-test',
      difficulty: 'hard',
      seed: 1,
      games: 1,
      bot: { kind: 'plan', plan: plan(), noise: 0 },
    };
    const record = JSON.parse(runGame(job, 0));
    expect(record.policy).toBeNull();
  });
});

describe('formatTierTable', () => {
  it('formats a Markdown table', () => {
    const table = formatTierTable([
      { tier: 'casual', summary: summary() },
      { tier: 'expert', summary: summary({ winRate: 1, cleanWinRate: 1 }) },
    ]);
    expect(table).toContain('| Tier | Games | Win rate |');
    expect(table).toContain('| casual | 10 | 50.0% | 40.0% |');
  });
});
