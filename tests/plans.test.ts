import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/config';
import { Sim } from '../src/sim';
import { makeRng, type Policy } from '../tools/playtest/bots';
import {
  buildableCells,
  noisyPlan,
  planBot,
  recordPlan,
  type BuildPlan,
  type PlanStep,
} from '../tools/playtest/plans';
import { resolveRules } from '../tools/playtest/rules';

const rules = resolveRules();

const base = (kick: number, hat: number, synth: number): Policy => ({
  weights: { kick, hat, synth },
  classMask: 15,
  midWave: false,
  earlyBias: 0,
  topK: 1,
  maxTowersPerWave: null,
});

function cellKey(step: PlanStep): string {
  return `${step.col},${step.row}`;
}

function planAt(cells: Array<[number, number]>): BuildPlan {
  const [first, second, third] = cells;
  if (!first || !second || !third) throw new Error('not enough cells');
  return [
    { type: 'kick', col: first[0], row: first[1] },
    { type: 'synth', col: second[0], row: second[1] },
    { type: 'hat', col: third[0], row: third[1] },
  ];
}

describe('buildableCells', () => {
  it('returns every grid cell that is not on the path', () => {
    expect(buildableCells()).toHaveLength(85);
  });
});

describe('planBot', () => {
  it('buys steps in order and stops at the first it cannot afford', () => {
    const cells = buildableCells();
    const plan = planAt(cells);
    const sim = new Sim();
    expect(sim.money).toBe(100);

    planBot(plan).build({ sim, rng: makeRng(1) });

    expect(sim.towers).toHaveLength(1);
    expect(sim.towers[0]?.type).toBe('kick');
    expect(sim.towers[0]?.col).toBe(plan[0]?.col);
    expect(sim.towers[0]?.row).toBe(plan[0]?.row);
  });

  it('skips a step whose cell is already taken', () => {
    const cells = buildableCells();
    const plan = planAt(cells);
    const taken = cells[0];
    const free = cells[1];
    if (!taken || !free) throw new Error('not enough cells');

    const sim = new Sim();
    sim.placeTower('hat', taken[0], taken[1]);
    const skipPlan: BuildPlan = [
      { type: 'kick', col: taken[0], row: taken[1] },
      { type: 'hat', col: free[0], row: free[1] },
    ];

    planBot(skipPlan).build({ sim, rng: makeRng(1) });

    expect(sim.towers).toHaveLength(2);
    expect(sim.towers.filter((tower) => tower.type === 'kick')).toHaveLength(0);
    expect(sim.towers[1]).toEqual({ type: 'hat', col: free[0], row: free[1] });
  });

  it('buys more on onBar once there is money', () => {
    const cells = buildableCells();
    const plan = planAt(cells);
    const sim = new Sim({ ...DIFFICULTIES.hard, startMoney: 20 });
    const bot = planBot(plan);

    bot.build({ sim, rng: makeRng(1) });
    expect(sim.towers).toHaveLength(0);

    sim.money = 100;
    bot.onBar?.({ sim, rng: makeRng(1) });
    expect(sim.towers).toHaveLength(1);
    expect(sim.towers[0]?.type).toBe('kick');
  });
});

describe('recordPlan', () => {
  it('records the towers a mixed policy bought on Hard', () => {
    const plan = recordPlan(base(1, 1, 1), DIFFICULTIES.hard, rules, 1);
    expect(plan).toHaveLength(60);
  });
});

describe('noisyPlan', () => {
  it('returns an equal plan at rate 0', () => {
    const plan = planAt(buildableCells());
    expect(noisyPlan(plan, makeRng(1), 0)).toEqual(plan);
  });

  it('keeps cells unique and buildable at rate 1', () => {
    const plan = planAt(buildableCells());
    const noisy = noisyPlan(plan, makeRng(1), 1);
    expect(noisy).toHaveLength(plan.length);

    const buildable = new Set(buildableCells().map(([col, row]) => `${col},${row}`));
    const keys = noisy.map(cellKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(buildable.has(key)).toBe(true);
  });
});
