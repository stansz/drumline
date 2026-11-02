import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../tools/playtest/job';
import type { Policy } from '../tools/playtest/bots';
import { formatComparison, formatSummary, formatWaveTable, summarize } from '../tools/playtest/report';

const policy: Policy = {
  weights: { kick: 1, hat: 1, synth: 1 },
  classMask: 15,
  midWave: false,
  earlyBias: 0,
  topK: 1,
  maxTowersPerWave: null,
  upgradeAt: null,
};

function record(overrides: Partial<GameRecord>): GameRecord {
  return {
    job: 'test',
    difficulty: 'hard',
    index: 0,
    config: 'config-a',
    seed: 0,
    policy,
    result: 'won',
    wave: 30,
    lives: 10,
    money: 0,
    towers: 1,
    steps: 1,
    mix: { kick: 0, hat: 0, synth: 0 },
    livesByWave: [],
    damageByType: { kick: 0, hat: 0, synth: 0 },
    shots: 0,
    chordAverage: 0,
    chordCappedShare: 0,
    idleNoteShare: 0,
    bossDamageByWave: {},
    bossKills: [],
    finalBossWave: 30,
    startLives: 20,
    spentByType: { kick: 0, hat: 0, synth: 0 },
    finalWaveProgress: 0,
    upgrades: 0,
    ...overrides,
  };
}

describe('summarize', () => {
  it('throws on an empty list', () => {
    expect(() => summarize([])).toThrow();
  });

  it('throws when records mix configs', () => {
    expect(() =>
      summarize([record({ index: 0 }), record({ index: 1, config: 'config-b' })]),
    ).toThrow();
  });

  it('works out the win rates, percentiles, deaths, damage shares, and boss damage', () => {
    const records = [
      record({
        index: 0,
        result: 'won',
        wave: 30,
        bossKills: [10, 20, 30],
        bossDamageByWave: { '30': 100 },
        damageByType: { kick: 1, hat: 1, synth: 2 },
        chordAverage: 1.5,
        idleNoteShare: 0.5,
      }),
      record({
        index: 1,
        result: 'won',
        wave: 30,
        bossKills: [10, 20],
        bossDamageByWave: { '30': 250 },
        chordAverage: 1,
        idleNoteShare: 0,
      }),
      record({
        index: 2,
        result: 'lost',
        wave: 20,
        bossKills: [10],
        chordAverage: 0.5,
        idleNoteShare: 0.25,
      }),
    ];

    const summary = summarize(records);
    expect(summary.games).toBe(3);
    expect(summary.wins).toBe(2);
    expect(summary.winRate).toBeCloseTo(2 / 3);
    expect(summary.cleanWinRate).toBe(0.5);
    expect(summary.waveP10).toBe(20);
    expect(summary.waveP50).toBe(30);
    expect(summary.waveP90).toBe(30);
    expect(summary.deathsByWave).toEqual({ '20': 1 });
    expect(summary.damageShare).toEqual({ kick: 0.25, hat: 0.25, synth: 0.5 });
    expect(summary.meanChordAverage).toBeCloseTo(1);
    expect(summary.meanIdleNoteShare).toBeCloseTo(0.25);
    expect(summary.finalBossWave).toBe(30);
    expect(summary.bestFinalBossDamage).toBe(250);
  });

  it('does not count a win as clean when the final boss survives', () => {
    const summary = summarize([
      record({ index: 0, result: 'won', bossKills: [10, 20] }),
    ]);
    expect(summary.winRate).toBe(1);
    expect(summary.cleanWinRate).toBe(0);
  });

  it('formats a summary as a Markdown table', () => {
    const summary = summarize([record({ index: 0, bossKills: [10, 20, 30] })]);
    const table = formatSummary(summary);
    expect(table).toContain('| Measure | Value |');
    expect(table).toContain('| Win rate | 100.0% |');
  });

  it('works out damage per dollar, and zero when nothing was spent', () => {
    const summary = summarize([
      record({
        index: 0,
        damageByType: { kick: 10, hat: 20, synth: 30 },
        spentByType: { kick: 100, hat: 100, synth: 0 },
      }),
      record({
        index: 1,
        damageByType: { kick: 30, hat: 0, synth: 0 },
        spentByType: { kick: 100, hat: 0, synth: 0 },
      }),
    ]);
    expect(summary.damagePerDollar.kick).toBeCloseTo(0.2);
    expect(summary.damagePerDollar.hat).toBeCloseTo(0.2);
    expect(summary.damagePerDollar.synth).toBe(0);
  });

  it('works out per-wave reached counts, deaths, and mean lives lost', () => {
    const summary = summarize([
      record({
        index: 0,
        result: 'lost',
        wave: 3,
        startLives: 20,
        livesByWave: [18, 15, 10],
      }),
      record({
        index: 1,
        result: 'won',
        wave: 5,
        startLives: 20,
        livesByWave: [20, 18, 18, 16, 16],
      }),
    ]);
    expect(summary.byWave).toHaveLength(5);
    expect(summary.byWave[0]).toEqual({
      wave: 1,
      reached: 2,
      deaths: 0,
      meanLivesLost: 1,
    });
    expect(summary.byWave[1]).toEqual({
      wave: 2,
      reached: 2,
      deaths: 0,
      meanLivesLost: 2.5,
    });
    expect(summary.byWave[2]).toEqual({
      wave: 3,
      reached: 2,
      deaths: 1,
      meanLivesLost: 2.5,
    });
    expect(summary.byWave[3]).toEqual({
      wave: 4,
      reached: 1,
      deaths: 0,
      meanLivesLost: 2,
    });
    expect(summary.byWave[4]).toEqual({
      wave: 5,
      reached: 1,
      deaths: 0,
      meanLivesLost: 0,
    });
  });

  it('formats the per-wave table', () => {
    const summary = summarize([record({ index: 0 })]);
    expect(formatWaveTable(summary)).toContain('| Wave | Reached | Deaths | Mean lives lost |');
  });
});

describe('formatComparison', () => {
  it('shows the before and after win rates', () => {
    const before = summarize([
      record({ index: 0 }),
      record({ index: 1 }),
      record({ index: 2, result: 'lost' }),
      record({ index: 3, result: 'lost' }),
    ]);
    const after = summarize([
      record({ config: 'config-b', index: 0 }),
      record({ config: 'config-b', index: 1 }),
      record({ config: 'config-b', index: 2 }),
      record({ config: 'config-b', index: 3, result: 'lost' }),
    ]);
    const table = formatComparison(before, after);
    expect(table).toContain('| Measure | Before | After |');
    expect(table).toContain('50.0%');
    expect(table).toContain('75.0%');
  });
});
