import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DIFFICULTIES, GRID_COLS, GRID_ROWS } from '../src/config';
import { Sim } from '../src/sim';
import { bossBound, bossWaves } from '../tools/playtest/bound';

const expected = [
  ['hard', 10, 1862, 814, 6321],
  ['hard', 20, 8350, 1879, 12056],
  ['hard', 30, 29997, 3256, 16679],
  ['easy', 10, 1303, 1044, 7691],
  ['easy', 20, 5845, 2309, 13636],
  ['easy', 30, 20998, 3886, 18247],
] as const;

describe('boss bound', () => {
  for (const [difficulty, wave, bossHp, income, boardDamage] of expected) {
    it(`${difficulty} wave ${wave} boss`, () => {
      const bound = bossBound(wave, DIFFICULTIES[difficulty], DEFAULT_RULES);
      expect(Math.round(bound.bossHp)).toBe(bossHp);
      expect(Math.round(bound.income)).toBe(income);
      expect(Math.round(bound.boardDamage)).toBe(boardDamage);
    });
  }

  it('a full board deals 21487 damage', () => {
    expect(Math.round(bossBound(10, DIFFICULTIES.hard, DEFAULT_RULES).fullBoardDamage)).toBe(
      21487,
    );
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

  // Known balance bug: these bosses can't be killed. Remove `.fails` when boss health is fixed.
  it.fails('a full-income board can kill the wave 30 boss on hard', () => {
    const bound = bossBound(30, DIFFICULTIES.hard, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it.fails('a full-income board can kill the wave 30 boss on easy', () => {
    const bound = bossBound(30, DIFFICULTIES.easy, DEFAULT_RULES);
    expect(bound.boardDamage).toBeGreaterThanOrEqual(bound.bossHp);
  });

  it.fails('a full board of synths beats hard', () => {
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
