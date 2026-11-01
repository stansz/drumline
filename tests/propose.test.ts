import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DIFFICULTIES, type DifficultyId } from '../src/config';
import {
  chooseValue,
  currentSetting,
  formatProposal,
  patchForSetting,
  type Candidate,
  type Proposal,
} from '../tools/playtest/propose';
import type { Summary } from '../tools/playtest/report';
import { checkTarget, type TargetCheck } from '../tools/playtest/targets';

function summary(config: string, winRate: number, cleanWinRate = winRate): Summary {
  return {
    config,
    difficulty: 'hard',
    games: 10,
    wins: Math.round(winRate * 10),
    winRate,
    cleanWinRate,
    waveP10: 10,
    waveP50: 20,
    waveP90: 30,
    deathsByWave: {},
    damageShare: { kick: 0.2, hat: 0.3, synth: 0.5 },
    meanChordAverage: 1,
    meanIdleNoteShare: 0,
    finalBossWave: 30,
    bestFinalBossDamage: 1000,
  };
}

function candidate(
  value: number | null,
  pass: boolean,
  worstMargin: number,
  after: Summary = summary('config-b', 0.75),
): Candidate {
  const check: TargetCheck = {
    id: 'hard-bots-lose',
    difficulty: 'hard',
    metric: 'winRate',
    value: 0.5,
    min: null,
    max: 0.01,
    pass,
    margin: worstMargin,
  };
  const summaries: Record<DifficultyId, Summary> = { hard: after, easy: after };
  return { value, pass, worstMargin, checks: [check], summaries };
}

describe('patchForSetting', () => {
  it('builds a curve patch', () => {
    expect(patchForSetting('curve.bossHealthCap', 14000)).toEqual({
      difficultyPatch: { curve: { bossHealthCap: 14000 } },
    });
  });

  it('builds a tower patch', () => {
    expect(patchForSetting('towers.hat.damage', 4)).toEqual({
      rules: { towers: { hat: { damage: 4 } } },
    });
  });

  it('builds a rules patch', () => {
    expect(patchForSetting('sellRefund', 0.5)).toEqual({ rules: { sellRefund: 0.5 } });
  });

  it('throws on an unknown setting', () => {
    expect(() => patchForSetting('nonsense', 1)).toThrow();
  });
});

describe('currentSetting', () => {
  it('reads a curve value from the default rules', () => {
    expect(currentSetting('curve.bossHealthCap', DEFAULT_RULES, DIFFICULTIES.hard)).toBe(14000);
  });
});

describe('checkTarget', () => {
  it('passes a max target at or below its maximum', () => {
    const target = { id: 'max', difficulty: 'hard' as const, metric: 'winRate' as const, max: 0.9 };
    const passing = checkTarget(target, 0.9);
    expect(passing.pass).toBe(true);
    expect(passing.min).toBeNull();
    expect(passing.margin).toBeCloseTo(0);

    const failing = checkTarget(target, 0.95);
    expect(failing.pass).toBe(false);
    expect(failing.margin).toBeCloseTo((0.9 - 0.95) / 0.9);
  });

  it('passes a min target at or above its minimum', () => {
    const target = { id: 'min', difficulty: 'easy' as const, metric: 'winRate' as const, min: 0.4 };
    const passing = checkTarget(target, 0.5);
    expect(passing.pass).toBe(true);
    expect(passing.max).toBeNull();
    expect(passing.margin).toBeCloseTo((0.5 - 0.4) / 0.4);

    const failing = checkTarget(target, 0.3);
    expect(failing.pass).toBe(false);
    expect(failing.margin).toBeCloseTo((0.3 - 0.4) / 0.4);
  });
});

describe('chooseValue', () => {
  it('picks the highest worst margin among passing values', () => {
    const value = chooseValue([
      candidate(null, true, 1),
      candidate(1000, true, 0.5),
      candidate(2000, false, 0.9),
      candidate(3000, true, 0.7),
    ]);
    expect(value).toBe(3000);
  });

  it('breaks ties with the lowest value', () => {
    expect(
      chooseValue([candidate(2000, true, 0.5), candidate(1000, true, 0.5)]),
    ).toBe(1000);
  });

  it('returns null when no candidate passes', () => {
    expect(chooseValue([candidate(null, false, 1), candidate(1000, false, 0.5)])).toBeNull();
  });
});

describe('formatProposal', () => {
  const base: Omit<Proposal, 'proposed' | 'candidates'> = {
    sweep: 'smoke',
    setting: 'curve.bossHealthCap',
    currentValue: 1000000,
    games: 40,
    seed: 11,
  };

  it('says nothing has changed and names the proposed value', () => {
    const text = formatProposal({
      ...base,
      proposed: 14000,
      candidates: [candidate(null, true, 0.1), candidate(14000, true, 0.5)],
    });
    expect(text).toContain('Nothing has been changed');
    expect(text).toContain('Set `curve.bossHealthCap` to 14000 (now 1000000).');
    expect(text).toContain('## Candidates');
    expect(text).toContain('| Current |');
  });

  it('says nothing has changed and no value meets the targets', () => {
    const text = formatProposal({
      ...base,
      proposed: null,
      candidates: [candidate(null, true, 0.1), candidate(14000, false, -0.5)],
    });
    expect(text).toContain('Nothing has been changed');
    expect(text).toContain('No tested value meets every target.');
    expect(text).not.toContain('## To apply');
  });
});
