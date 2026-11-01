import { GRID_COLS, GRID_ROWS, type Difficulty, type Rules } from '../../src/config';
import { pathCells, type TowerType } from '../../src/sim';
import {
  playGame,
  policyBot,
  type Bot,
  type BotContext,
  type Policy,
  type Rng,
} from './bots';

export interface PlanStep {
  type: TowerType;
  col: number;
  row: number;
}

export type BuildPlan = PlanStep[];

function buildBuildableCells(): Array<[number, number]> {
  const blocked = new Set(pathCells().map(([col, row]) => `${col},${row}`));
  const cells: Array<[number, number]> = [];
  for (let col = 0; col < GRID_COLS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (blocked.has(`${col},${row}`)) continue;
      cells.push([col, row]);
    }
  }
  return cells;
}

const BUILDABLE_CELLS = buildBuildableCells();

export function buildableCells(): Array<[number, number]> {
  return BUILDABLE_CELLS.map(([col, row]) => [col, row]);
}

export function planBot(plan: BuildPlan): Bot {
  let next = 0;

  function spend(ctx: BotContext): void {
    const sim = ctx.sim;
    while (next < plan.length) {
      const step = plan[next];
      if (!step) return;
      if (!sim.canPlace(step.col, step.row)) {
        next += 1;
        continue;
      }
      if (sim.money < sim.rules.towers[step.type].cost) return;
      sim.placeTower(step.type, step.col, step.row);
      next += 1;
    }
  }

  return {
    build(ctx: BotContext): void {
      spend(ctx);
    },
    onBar(ctx: BotContext): void {
      spend(ctx);
    },
  };
}

export function recordPlan(
  policy: Policy,
  difficulty: Difficulty,
  rules: Rules,
  seed: number,
): BuildPlan {
  const inner = policyBot(policy, rules);
  const captured: { sim: BotContext['sim'] | null } = { sim: null };
  const bot: Bot = {
    build(ctx: BotContext): void {
      captured.sim = ctx.sim;
      inner.build(ctx);
    },
    onBar(ctx: BotContext): void {
      inner.onBar?.(ctx);
    },
  };
  playGame(bot, difficulty, rules, seed);
  const sim = captured.sim;
  if (!sim) throw new Error('plan recording never built');
  return sim.towers.map((tower) => ({ type: tower.type, col: tower.col, row: tower.row }));
}

export function noisyPlan(plan: BuildPlan, rng: Rng, rate: number): BuildPlan {
  const copy: BuildPlan = plan.map((step) => ({ ...step }));
  const cells = buildableCells();
  for (let index = 0; index < copy.length; index += 1) {
    if (rng() >= rate) continue;
    if (rng() < 0.5 && index + 1 < copy.length) {
      const current = copy[index];
      const next = copy[index + 1];
      if (current && next) {
        copy[index] = next;
        copy[index + 1] = current;
      }
      continue;
    }
    const used = new Set(copy.map((step) => `${step.col},${step.row}`));
    const free = cells.filter(([col, row]) => !used.has(`${col},${row}`));
    if (free.length === 0) continue;
    const cell = free[Math.floor(rng() * free.length)];
    const step = copy[index];
    if (cell && step) {
      copy[index] = { ...step, col: cell[0], row: cell[1] };
    }
  }
  return copy;
}
