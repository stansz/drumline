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
  upgradeAt: null,
});

function towersFor(seed: number, policy: Policy): string {
  const sim = new Sim(DIFFICULTIES.hard);
  policyBot(policy, DEFAULT_RULES).build({ sim, rng: makeRng(seed) });
  return JSON.stringify(sim.towers);
}

describe('playGame', () => {
  it('a mixed bot loses at wave 30 on hard', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1);
    expect(result.result).toBe('lost');
    expect(result.wave).toBe(30);
    expect(result.towers).toBe(60);
    expect(result.mix).toEqual({ kick: 20, hat: 20, synth: 20 });
  });

  it('a mixed bot wins on easy', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.easy, rules, 1);
    expect(result.result).toBe('won');
    expect(result.lives).toBe(30);
    expect(result.towers).toBe(72);
    expect(result.mix).toEqual({ kick: 24, hat: 24, synth: 24 });
  });

  it('a hat-only bot loses at wave 26 on hard', () => {
    const result = playGame(policyBot(base(0, 1, 0), rules), DIFFICULTIES.hard, rules, 1);
    expect(result.result).toBe('lost');
    expect(result.wave).toBe(26);
    expect(result.towers).toBe(64);
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
    expect(result.chordAverage).toBeLessThan(2.25);
  });

  it('records boss kills, boss damage, and the final boss wave', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1);
    expect(result.bossKills).toEqual([10, 20]);
    expect(result.finalBossWave).toBe(30);
    expect(result.bossDamageByWave['10']).toBeGreaterThanOrEqual(1862);
  });

  it('scores a lost boss wave by the damage dealt to the boss', () => {
    const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1);
    expect(result.result).toBe('lost');
    expect(result.wave).toBe(30);
    expect(result.finalWaveProgress).toBeCloseTo((result.bossDamageByWave['30'] ?? 0) / 20500);
    expect(result.finalWaveProgress).toBeLessThan(1);
  });

  it('reports upgrades above zero for a policy that buys them', () => {
    const policy = { ...base(1, 1, 1), upgradeAt: 10 };
    const result = playGame(policyBot(policy, rules), DIFFICULTIES.hard, rules, 1);
    expect(result.upgrades).toBeGreaterThan(0);
  });

  it('includes upgrade spending in spentByType', () => {
    const policy = { ...base(1, 1, 1), upgradeAt: 10 };
    const result = playGame(policyBot(policy, rules), DIFFICULTIES.hard, rules, 1);
    let extra = 0;
    for (const type of ['kick', 'hat', 'synth'] as const) {
      extra += result.spentByType[type] - result.mix[type] * rules.towers[type].cost;
    }
    expect(extra).toBeGreaterThan(0);
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

  it('keeps settings separate for jobs that share an id', () => {
    const plain: Job = { id: 'shared', difficulty: 'hard', seed: 1, games: 1 };
    const capped: Job = {
      ...plain,
      difficultyPatch: { curve: { bossHealthCap: 1000 } },
    };
    const plainConfig = JSON.parse(runGame(plain, 0)).config;
    const cappedConfig = JSON.parse(runGame(capped, 0)).config;
    expect(cappedConfig).not.toBe(plainConfig);
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
