import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/config';
import { playBot, type BotResult, type BotStrategy } from './bots';
import { DEFAULT_RULES } from '../src/config';
import { playGame } from '../tools/playtest/bots';
import { planBot, type BuildPlan } from '../tools/playtest/plans';
import expertA from './fixtures/hard-expert-a.json';
import expertB from './fixtures/hard-expert-b.json';

function play(strategy: BotStrategy, difficulty: 'easy' | 'hard'): BotResult {
  const result = playBot(strategy, DIFFICULTIES[difficulty]);
  console.log(
    `${difficulty} ${strategy} result=${result.result} wave=${result.wave} lives=${result.lives} towers=${result.towers} money=${result.money}`,
  );
  return result;
}

describe('hard', () => {
  it('idle loses within three waves', () => {
    const result = play('idle', 'hard');
    expect(result.result).toBe('lost');
    expect(result.wave).toBeLessThanOrEqual(3);
  });

  it('casual play falls at the first bosses', () => {
    const result = play('casual', 'hard');
    expect(result.result).toBe('lost');
    expect(result.wave).toBeLessThanOrEqual(20);
  });

  it('spreading reaches the late waves without beating the game', () => {
    const result = play('spread', 'hard');
    expect(result.result).toBe('lost');
    expect(result.wave).toBeGreaterThanOrEqual(25);
  });

  it('stacking reaches the late waves without beating the game', () => {
    const result = play('chord', 'hard');
    expect(result.result).toBe('lost');
    expect(result.wave).toBeGreaterThanOrEqual(25);
  });

  it('peaks with about two thirds of the board built', () => {
    const result = play('spread', 'hard');
    expect(result.towers).toBeGreaterThanOrEqual(51);
    expect(result.towers).toBeLessThanOrEqual(64);
  });
});

describe('easy', () => {
  it('idle loses within three waves', () => {
    const result = play('idle', 'easy');
    expect(result.result).toBe('lost');
    expect(result.wave).toBeLessThanOrEqual(3);
  });

  it('casual play gets well into the run', () => {
    const result = play('casual', 'easy');
    expect(result.wave).toBeGreaterThanOrEqual(15);
  });

  it('spreading wins', () => {
    expect(play('spread', 'easy').result).toBe('won');
  });

  it('stacking wins', () => {
    expect(play('chord', 'easy').result).toBe('won');
  });
});

describe('expert builds', () => {
  for (const [name, fixture] of [
    ['a', expertA],
    ['b', expertB],
  ] as const) {
    it(`expert build ${name} beats hard`, () => {
      const plan = fixture.plan as BuildPlan;
      const result = playGame(planBot(plan), DIFFICULTIES.hard, DEFAULT_RULES, 0);
      expect(result.result).toBe('won');
      expect(result.bossKills).toEqual([10, 20, 30]);
    });
  }
});
