import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DIFFICULTIES, GRID_COLS, GRID_ROWS } from '../src/config';
import { Sim } from '../src/sim';
import { bossBound, bossWaves, towerBossDamage } from '../tools/playtest/bound';
import { resolveRules } from '../tools/playtest/rules';

const expected = [
  ['hard', 10, 1862, 814, 8012],
  ['hard', 20, 8350, 1879, 16274],
  ['hard', 30, 20500, 3256, 25157],
  ['easy', 10, 931, 1044, 9902],
  ['easy', 20, 4175, 2309, 19258],
  ['easy', 30, 10250, 3886, 28202],
] as const;

// The same runs with the default upgrades, measured from a real run.
const upgraded = [
  ['hard', 10, 1862, 814, 8012],
  ['hard', 20, 8350, 1879, 16274],
  ['hard', 30, 20500, 3256, 25225],
  ['easy', 10, 931, 1044, 9902],
  ['easy', 20, 4175, 2309, 19258],
  ['easy', 30, 10250, 3886, 28526],
] as const;

const withoutUpgrades = resolveRules({ upgrades: { kick: [], hat: [], synth: [] } });

describe('boss bound', () => {
  for (const [difficulty, wave, bossHp, income, boardDamage] of expected) {
    it(`${difficulty} wave ${wave} boss`, () => {
      const bound = bossBound(wave, DIFFICULTIES[difficulty], withoutUpgrades);
      expect(Math.round(bound.bossHp)).toBe(bossHp);
      expect(Math.round(bound.income)).toBe(income);
      expect(Math.round(bound.boardDamage)).toBe(boardDamage);
    });
  }

  it('a full board deals 35519 damage', () => {
    expect(
      Math.round(bossBound(10, DIFFICULTIES.hard, withoutUpgrades).fullBoardDamage),
    ).toBe(35519);
  });

  for (const [difficulty, wave, bossHp, income, boardDamage] of upgraded) {
    it(`${difficulty} wave ${wave} boss with upgrades`, () => {
      const bound = bossBound(wave, DIFFICULTIES[difficulty], DEFAULT_RULES);
      expect(Math.round(bound.bossHp)).toBe(bossHp);
      expect(Math.round(bound.income)).toBe(income);
      expect(Math.round(bound.boardDamage)).toBe(boardDamage);
    });
  }

  it('upgrades never lower the board damage', () => {
    for (let index = 0; index < expected.length; index += 1) {
      const [difficulty, wave] = expected[index] ?? ['hard', 10];
      const before = bossBound(wave, DIFFICULTIES[difficulty], withoutUpgrades);
      const after = bossBound(wave, DIFFICULTIES[difficulty], DEFAULT_RULES);
      expect(after.boardDamage).toBeGreaterThanOrEqual(before.boardDamage);
    }
  });

  it('a level 2 kick and a level 2 hat deal more boss damage than level 1', () => {
    for (const type of ['kick', 'hat'] as const) {
      const level1 = towerBossDamage(type, 0, 0, DEFAULT_RULES, 1);
      const level2 = towerBossDamage(type, 0, 0, DEFAULT_RULES, 2);
      expect(level1).toBeGreaterThan(0);
      expect(level2).toBeGreaterThan(level1);
    }
  });

  it('puts bosses at waves 10, 20, and 30 on hard', () => {
    expect(bossWaves(DIFFICULTIES.hard)).toEqual([10, 20, 30]);
  });

  it('a full-income board can kill the wave 10 boss on hard', () => {
    const bound = bossBound(10, DIFFICULTIES.hard, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it('a full-income board can kill the wave 20 boss on hard', () => {
    const bound = bossBound(20, DIFFICULTIES.hard, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it('a full-income board can kill the wave 10 boss on easy', () => {
    const bound = bossBound(10, DIFFICULTIES.easy, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it('a full-income board can kill the wave 20 boss on easy', () => {
    const bound = bossBound(20, DIFFICULTIES.easy, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it('a full-income board can kill the wave 30 boss on hard', () => {
    const bound = bossBound(30, DIFFICULTIES.hard, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it('a full-income board can kill the wave 30 boss on easy', () => {
    const bound = bossBound(30, DIFFICULTIES.easy, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it('a full board of synths beats hard', () => {
    const sim = new Sim({ ...DIFFICULTIES.hard, startMoney: 1e7 });
    for (let col = 0; col < GRID_COLS; col += 1) {
      for (let row = 0; row < GRID_ROWS; row += 1) {
        if (sim.canPlace(col, row)) sim.placeTower('synth', col, row);
      }
    }
    while (sim.phase !== 'won' && sim.phase !== 'lost') {
      if (sim.phase === 'build') sim.startWave();
      while (sim.phase === 'wave') sim.step();
    }
    expect(sim.phase).toBe('won');
  });
});
