import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/config';
import { makeRng, type GameResult, type Policy } from '../tools/playtest/bots';
import type { BuildPlan } from '../tools/playtest/plans';
import { buildableCells, placeSteps, recordPlan } from '../tools/playtest/plans';
import { resolveRules } from '../tools/playtest/rules';
import {
  behaviourOf,
  bestElite,
  evaluatePlan,
  formatSearchReport,
  headroomByWave,
  initialPolicy,
  insertElite,
  mutatePlan,
  planScore,
  sortedElites,
  type Archive,
  type Elite,
  type Evaluation,
  type SearchConfig,
  type SearchOutput,
} from '../tools/playtest/search';

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

function result(overrides: Partial<GameResult>): GameResult {
  return {
    result: 'lost',
    wave: 1,
    lives: 20,
    money: 0,
    towers: 0,
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

function evaluation(score: number): Evaluation {
  return {
    score,
    won: false,
    wave: 1,
    lives: 20,
    towers: 0,
    mix: { kick: 0, hat: 0, synth: 0 },
    damageByType: { kick: 0, hat: 0, synth: 0 },
    upgrades: 0,
    behaviour: { kickBin: 0, synthBin: 0, focusBin: 0 },
  };
}

function elite(key: string, score: number, plan: BuildPlan = []): Elite {
  return { ...evaluation(score), key, plan };
}

function config(overrides: Partial<SearchConfig> = {}): SearchConfig {
  return {
    id: 'test',
    difficulty: 'hard',
    seed: 21,
    initial: 0,
    generations: 0,
    batch: 1,
    ...overrides,
  };
}

function cellKey(step: { col: number; row: number }): string {
  return `${step.col},${step.row}`;
}

describe('planScore', () => {
  it('scores a win as wave plus remaining lives', () => {
    const difficulty: Difficulty = DIFFICULTIES.hard;
    expect(planScore(result({ result: 'won', wave: 30, lives: 10 }), difficulty)).toBe(30.5);
  });

  it('scores a loss as cleared waves plus final wave progress', () => {
    const difficulty: Difficulty = DIFFICULTIES.hard;
    const lost = result({ result: 'lost', wave: 20, finalWaveProgress: 0.4 });
    expect(planScore(lost, difficulty)).toBeCloseTo(19.4);
  });
});

describe('behaviourOf', () => {
  it('puts towers in one class and all spending on one type', () => {
    const plan: BuildPlan = [
      { type: 'kick', col: 0, row: 0 },
      { type: 'hat', col: 4, row: 0 },
      { type: 'synth', col: 8, row: 0 },
    ];
    const behaviour = behaviourOf(
      plan,
      result({ towers: 3, spentByType: { kick: 100, hat: 0, synth: 0 } }),
    );
    expect(behaviour).toEqual({ kickBin: 4, synthBin: 0, focusBin: 2 });
  });

  it('gives zero bins for an empty plan and no spending', () => {
    expect(behaviourOf([], result({ towers: 0 }))).toEqual({
      kickBin: 0,
      synthBin: 0,
      focusBin: 0,
    });
  });

  it('bins an even split of spending and columns', () => {
    const plan: BuildPlan = [
      { type: 'kick', col: 0, row: 0 },
      { type: 'synth', col: 1, row: 0 },
    ];
    const behaviour = behaviourOf(
      plan,
      result({
        towers: 2,
        spentByType: { kick: 50, hat: 0, synth: 50 },
      }),
    );
    expect(behaviour).toEqual({ kickBin: 2, synthBin: 2, focusBin: 1 });
  });

  it('ignores upgrade steps when counting focus', () => {
    const plan: BuildPlan = [
      { type: 'hat', col: 0, row: 0 },
      { type: 'upgrade', col: 0, row: 0 },
      { type: 'hat', col: 1, row: 0 },
      { type: 'upgrade', col: 1, row: 0 },
    ];
    const behaviour = behaviourOf(plan, result({ towers: 2 }));
    expect(behaviour.focusBin).toBe(1);
  });
});

describe('insertElite', () => {
  it('stores a new key and replaces on a higher score', () => {
    const archive: Archive = new Map();
    expect(insertElite(archive, [], evaluation(1))).toBe(true);
    expect(archive.get('0-0-0')?.score).toBe(1);

    expect(insertElite(archive, [], evaluation(2))).toBe(true);
    expect(archive.get('0-0-0')?.score).toBe(2);
  });

  it('keeps the old elite on an equal or lower score', () => {
    const archive: Archive = new Map();
    insertElite(archive, [], evaluation(2));
    expect(insertElite(archive, [], evaluation(2))).toBe(false);
    expect(insertElite(archive, [], evaluation(1))).toBe(false);
    expect(archive.get('0-0-0')?.score).toBe(2);
  });
});

describe('mutatePlan', () => {
  const searchConfig = config({ bannedTowers: ['kick'] });

  function seedPlan(): BuildPlan {
    const cells = buildableCells();
    const plan: BuildPlan = [];
    for (let index = 0; index < 5; index += 1) {
      const cell = cells[index * 3];
      if (!cell) continue;
      plan.push({ type: index % 2 === 0 ? 'hat' : 'synth', col: cell[0], row: cell[1] });
    }
    return plan;
  }

  it('keeps cells unique, buildable, and allowed over 200 runs', () => {
    const plan = seedPlan();
    const buildable = new Set(buildableCells().map(([col, row]) => `${col},${row}`));
    for (let seed = 0; seed < 200; seed += 1) {
      const mutated = mutatePlan(plan, makeRng(seed), searchConfig);
      const places = placeSteps(mutated);
      const keys = places.map(cellKey);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(buildable.has(key)).toBe(true);
      for (const step of places) expect(step.type).not.toBe('kick');
    }
  });

  it('keeps upgrade steps on place cells over 200 runs', () => {
    const plan: BuildPlan = [...seedPlan()];
    plan.splice(1, 0, { type: 'upgrade', col: plan[0]?.col ?? 0, row: plan[0]?.row ?? 0 });
    plan.splice(3, 0, { type: 'upgrade', col: plan[2]?.col ?? 0, row: plan[2]?.row ?? 0 });
    for (let seed = 0; seed < 200; seed += 1) {
      const mutated = mutatePlan(plan, makeRng(seed), searchConfig);
      const places = placeSteps(mutated);
      const keys = places.map(cellKey);
      expect(new Set(keys).size).toBe(keys.length);
      expect(new Set(keys).size).toBeGreaterThan(0);
      const counts = new Map<string, number>();
      for (const step of mutated) {
        if (step.type !== 'upgrade') continue;
        const key = cellKey(step);
        expect(keys).toContain(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      for (const count of counts.values()) expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('gives the same result for the same seed', () => {
    const plan = seedPlan();
    expect(mutatePlan(plan, makeRng(7), searchConfig)).toEqual(
      mutatePlan(plan, makeRng(7), searchConfig),
    );
  });
});

describe('initialPolicy', () => {
  it('gives a banned type no weight', () => {
    const { policy } = initialPolicy(config({ bannedTowers: ['kick'] }), 0);
    expect(policy.weights.kick).toBe(0);
  });

  it('keeps at least one positive weight when two types are banned', () => {
    const { policy } = initialPolicy(config({ bannedTowers: ['kick', 'hat'] }), 0);
    expect(policy.weights.kick).toBe(0);
    expect(policy.weights.hat).toBe(0);
    expect(policy.weights.synth).toBeGreaterThan(0);
  });
});

describe('bestElite', () => {
  it('breaks ties with the lowest key', () => {
    const best = bestElite([elite('1-0-0', 5), elite('0-0-0', 5), elite('0-0-0', 4)]);
    expect(best.key).toBe('0-0-0');
    expect(best.score).toBe(5);
  });

  it('throws on an empty list', () => {
    expect(() => bestElite([])).toThrow();
  });
});

describe('headroomByWave', () => {
  it('covers every wave and clears wave 1 with the best build', () => {
    const plan = recordPlan(base(1, 1, 1), DIFFICULTIES.hard, rules, 1);
    const headroom = headroomByWave(plan, DIFFICULTIES.hard, rules);
    expect(headroom).toHaveLength(30);
    expect(headroom[0]?.multiplier).not.toBeNull();
  }, 60000);
});

describe('formatSearchReport', () => {
  it('writes the best build, styles, and headroom sections', () => {
    const focused: Elite = {
      ...elite('0-0-2', 5, []),
      won: false,
      wave: 5,
      lives: 10,
      towers: 2,
      mix: { kick: 1, hat: 1, synth: 0 },
      damageByType: { kick: 10, hat: 5, synth: 0 },
      behaviour: { kickBin: 0, synthBin: 0, focusBin: 2 },
    };
    const output: SearchOutput = {
      id: 'test',
      difficulty: 'hard',
      config: 'abc123',
      games: 10,
      elites: [focused],
      headroom: [{ wave: 1, multiplier: 1.5 }],
    };
    const text = formatSearchReport(output);
    expect(text).toContain('## Best build');
    expect(text).toContain('### Chord focus: focused');
    expect(text).toContain('## Headroom');
  });
});

describe('evaluatePlan', () => {
  it('evaluates an empty plan', () => {
    const evaluationResult = evaluatePlan([], DIFFICULTIES.hard, rules);
    expect(evaluationResult.towers).toBe(0);
    expect(evaluationResult.won).toBe(false);
  });
});

describe('sortedElites', () => {
  it('sorts by key', () => {
    const archive: Archive = new Map();
    archive.set('2-0-0', elite('2-0-0', 1));
    archive.set('0-1-0', elite('0-1-0', 2));
    expect(sortedElites(archive).map((entry) => entry.key)).toEqual(['0-1-0', '2-0-0']);
  });
});
