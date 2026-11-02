// A close estimate of the most damage a static board can deal to a boss. It lets every cell hold a
// tower at any level. It is generous: every earlier enemy pays its bounty, nothing is spent on
// earlier waves, every shot gets the capped chord bonus, and no shot goes to another enemy. It
// leaves out some small effects, among them level 3 kick splash and synth chains that reach the
// boss through a runner, and bounties from the boss's own wave.
import {
  GRID_COLS,
  GRID_ROWS,
  MAX_TOWER_LEVEL,
  STEPS_PER_BAR,
  towerStats,
  towerSpent,
  type Difficulty,
  type Rules,
} from '../../src/config';
import { firesThisStep, pathCells, pathLength, pathPoint, type TowerType } from '../../src/sim';
import { buildWaves } from '../../src/waves';

export interface BossBound {
  wave: number;
  bossHp: number;
  income: number;
  boardDamage: number;
  picks: Record<TowerType, number>;
  fullBoardDamage: number;
}

const TOWER_ORDER: TowerType[] = ['kick', 'hat', 'synth'];

interface Option {
  type: TowerType;
  level: number;
  cost: number;
}

export function bossWaves(difficulty: Difficulty): number[] {
  const waves: number[] = [];
  buildWaves(difficulty).forEach((groups, index) => {
    if (groups.some((group) => group.type === 'boss')) waves.push(index + 1);
  });
  return waves;
}

export function maxIncomeBefore(wave: number, difficulty: Difficulty, rules: Rules): number {
  const waves = buildWaves(difficulty, rules.enemies);
  let income = difficulty.startMoney;
  for (let earlier = 1; earlier < wave; earlier += 1) {
    for (const group of waves[earlier - 1] ?? []) {
      income += rules.enemies[group.type].bounty * group.count;
    }
    income += difficulty.waveBonus;
  }
  return income;
}

export function towerBossDamage(
  type: TowerType,
  col: number,
  row: number,
  rules: Rules,
  level = 1,
): number {
  const stats = towerStats(rules, type, level);
  const bonus = 1 + rules.chordBonusPerTower * (rules.chordMaxTowers - 1);
  const speed = rules.enemies.boss.speed;
  const length = pathLength();
  let damage = 0;
  let progress = 0;
  let step = 0;
  while (progress < length) {
    if (firesThisStep(type, col, step % STEPS_PER_BAR)) {
      const point = pathPoint(progress);
      if (Math.hypot(col - point.x, row - point.y) <= stats.range) {
        damage += stats.damage * bonus;
      }
    }
    progress += speed;
    step += 1;
  }
  return damage;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

export function bossBound(wave: number, difficulty: Difficulty, rules: Rules): BossBound {
  const pathKeys = new Set(pathCells().map(([col, row]) => `${col},${row}`));
  const options: Option[] = [];
  for (const type of TOWER_ORDER) {
    for (let level = 1; level <= MAX_TOWER_LEVEL; level += 1) {
      options.push({ type, level, cost: towerSpent(rules, type, level) });
    }
  }

  const cells: Array<{ damage: number[] }> = [];
  for (let col = 0; col < GRID_COLS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (pathKeys.has(`${col},${row}`)) continue;
      const damage = options.map((option) =>
        towerBossDamage(option.type, col, row, rules, option.level),
      );
      cells.push({ damage });
    }
  }

  let fullBoardDamage = 0;
  for (const cell of cells) {
    fullBoardDamage += Math.max(...cell.damage);
  }

  const income = maxIncomeBefore(wave, difficulty, rules);
  const costs = options.map((option) => option.cost);
  const unit = costs.reduce((result, cost) => gcd(result, cost), 0) || 1;
  const capacity = Math.floor(income / unit);

  const best = new Float64Array(capacity + 1);
  const choices: Int8Array[] = cells.map(() => {
    const row = new Int8Array(capacity + 1);
    row.fill(-1);
    return row;
  });

  for (let index = 0; index < cells.length; index += 1) {
    const next = best.slice();
    const choice = choices[index];
    if (!choice) continue;
    const damage = cells[index]?.damage;
    if (!damage) continue;
    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      const cost = costs[optionIndex];
      if (cost === undefined) continue;
      const weight = cost / unit;
      const value = damage[optionIndex] ?? 0;
      for (let c = capacity; c >= weight; c -= 1) {
        const candidate = (best[c - weight] ?? 0) + value;
        if (candidate > (next[c] ?? 0)) {
          next[c] = candidate;
          choice[c] = optionIndex;
        }
      }
    }
    best.set(next);
  }

  let bestCapacity = 0;
  for (let c = 1; c <= capacity; c += 1) {
    if ((best[c] ?? 0) > (best[bestCapacity] ?? 0)) bestCapacity = c;
  }
  const boardDamage = best[bestCapacity] ?? 0;

  const picks: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  let remaining = bestCapacity;
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const chosen = choices[index]?.[remaining] ?? -1;
    if (chosen < 0) continue;
    const option = options[chosen];
    if (!option) continue;
    picks[option.type] += 1;
    remaining -= option.cost / unit;
  }

  const groups = buildWaves(difficulty, rules.enemies)[wave - 1] ?? [];
  const boss = groups.find((group) => group.type === 'boss');

  return {
    wave,
    bossHp: boss ? boss.hp : 0,
    income,
    boardDamage,
    picks,
    fullBoardDamage,
  };
}
