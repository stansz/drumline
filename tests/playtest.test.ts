import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DIFFICULTIES } from '../src/config';
import { Sim } from '../src/sim';
import { makeRng, policyBot, playGame, type Policy } from '../tools/playtest/bots';
import { runGame, type Job } from '../tools/playtest/job';
import { configHash, resolveRules } from '../tools/playtest/rules';

const rules = resolveRules();

const base = (kick: number, hat: number, synth: number): Policy => ({
  weights: { kick, hat, synth },
  classMask: 15,
  midWave: false,
  earlyBias: 0,
  topK: 1,
  maxTowersPerWave: null,
});

function towersFor(seed: number, policy: Policy): string {
  const sim = new Sim(DIFFICULTIES.hard);
  policyBot(policy, DEFAULT_RULES).build({ sim, rng: makeRng(seed) });
  return JSON.stringify(sim.towers);
}

describe('playGame', () => {
  it('a mixed bot loses at wave 28 on hard', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1);
    expect(result.result).toBe('lost');
    expect(result.wave).toBe(28);
    expect(result.towers).toBe(56);
    expect(result.mix).toEqual({ kick: 19, hat: 19, synth: 18 });
  });

  it('a mixed bot wins on easy', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.easy, rules, 1);
    expect(result.result).toBe('won');
    expect(result.lives).toBe(10);
    expect(result.towers).toBe(75);
    expect(result.mix).toEqual({ kick: 25, hat: 25, synth: 25 });
  });

  it('a hat-only bot loses at wave 25 on hard', () => {
    const result = playGame(policyBot(base(0, 1, 0), rules), DIFFICULTIES.hard, rules, 1);
    expect(result.result).toBe('lost');
    expect(result.wave).toBe(25);
    expect(result.towers).toBe(70);
  });

  it('a capped mid-wave bot never builds more towers than waves', () => {
    const policy = { ...base(1, 1, 1), midWave: true, maxTowersPerWave: 1 };
    const result = playGame(policyBot(policy, rules), DIFFICULTIES.hard, rules, 1);
    expect(result.towers).toBeLessThanOrEqual(result.wave);
  });

  it('records damage for every type and plausible chords', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1);
    for (const damage of Object.values(result.damageByType)) {
      expect(damage).toBeGreaterThan(0);
    }
    expect(result.chordAverage).toBeGreaterThan(1);
    expect(result.chordAverage).toBeLessThan(1.75);
  });
});

describe('runGame', () => {
  const job: Job = { id: 'playtest-test', difficulty: 'hard', seed: 1, games: 10 };

  it('is deterministic for one index', () => {
    expect(runGame(job, 7)).toBe(runGame(job, 7));
  });

  it('differs between indexes', () => {
    expect(runGame(job, 7)).not.toBe(runGame(job, 8));
  });
});

describe('policies and configs', () => {
  it('a config change changes the hash', () => {
    const changed = configHash(resolveRules({ chordMaxTowers: 5 }), DIFFICULTIES.hard);
    const plain = configHash(resolveRules(), DIFFICULTIES.hard);
    expect(changed).not.toBe(plain);
  });

  it('topK picks different cells under different seeds', () => {
    const policy = { ...base(1, 1, 1), topK: 5 };
    expect(towersFor(1, policy)).not.toBe(towersFor(2, policy));
  });
});
