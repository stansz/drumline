import { GRID_COLS, GRID_ROWS, upgradeCost, type Difficulty, type Rules } from '../../src/config';
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
  type: TowerType | 'upgrade';
  col: number;
  row: number;
}

export type BuildPlan = PlanStep[];

export function placeSteps(plan: BuildPlan): Array<PlanStep & { type: TowerType }> {
  return plan.filter((step): step is PlanStep & { type: TowerType } => step.type !== 'upgrade');
}

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
      if (step.type === 'upgrade') {
        const tower = sim.towers.find((item) => item.col === step.col && item.row === step.row);
        const cost = tower ? upgradeCost(sim.rules, tower.type, tower.level) : null;
        if (cost === null) {
          next += 1;
          continue;
        }
        if (sim.money < cost) return;
        sim.upgradeTower(step.col, step.row);
        next += 1;
        continue;
      }
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
  const bought: BuildPlan = [];
  const bot = policyBot(policy, rules, (step) => bought.push(step));
  playGame(bot, difficulty, rules, seed);
  return bought;
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
        if (current.col === next.col && current.row === next.row) continue;
        copy[index] = next;
        copy[index + 1] = current;
      }
      continue;
    }
    const used = new Set(placeSteps(copy).map((step) => `${step.col},${step.row}`));
    const free = cells.filter(([col, row]) => !used.has(`${col},${row}`));
    if (free.length === 0) continue;
    const cell = free[Math.floor(rng() * free.length)];
    const step = copy[index];
    if (!cell || !step) continue;
    if (step.type === 'upgrade') continue;
    const oldCol = step.col;
    const oldRow = step.row;
    copy[index] = { ...step, col: cell[0], row: cell[1] };
    for (const other of copy) {
      if (other.type !== 'upgrade') continue;
      if (other.col !== oldCol || other.row !== oldRow) continue;
      other.col = cell[0];
      other.row = cell[1];
    }
  }
  return copy;
}
