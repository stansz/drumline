import {
  GRID_COLS,
  GRID_ROWS,
  STEPS_PER_BAR,
  towerSpent,
  upgradeCost,
  type Difficulty,
  type Rules,
} from '../../src/config';
import { Sim, pathCells, type Phase, type TowerType } from '../../src/sim';
import type { PlanStep } from './plans';

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BotContext {
  sim: Sim;
  rng: Rng;
}

// All bot randomness comes from ctx.rng, because the sim has none.
export interface Bot {
  build(ctx: BotContext): void;
  onBar?(ctx: BotContext): void;
}

export interface Policy {
  weights: Record<TowerType, number>;
  // Bit n allows columns where col % 4 === n. 15 allows every column.
  classMask: number;
  midWave: boolean;
  earlyBias: number;
  // Picks at random among this many best cells. 1 always takes the best.
  topK: number;
  maxTowersPerWave: number | null;
  // Buys upgrades instead of towers once the board has this many towers. null never upgrades.
  upgradeAt: number | null;
}

export interface GameResult {
  result: Phase;
  wave: number;
  lives: number;
  money: number;
  towers: number;
  steps: number;
  mix: Record<TowerType, number>;
  livesByWave: number[];
  damageByType: Record<TowerType, number>;
  shots: number;
  chordAverage: number;
  chordCappedShare: number;
  idleNoteShare: number;
  bossDamageByWave: Record<string, number>;
  bossKills: number[];
  finalBossWave: number;
  startLives: number;
  spentByType: Record<TowerType, number>;
  finalWaveProgress: number;
  upgrades: number;
}

const TOWER_ORDER: TowerType[] = ['kick', 'hat', 'synth'];
const MAX_STEPS = 200000;

export function randomPolicy(rng: Rng): Policy {
  const weights = {
    kick: rng() < 0.25 ? 0 : rng(),
    hat: rng() < 0.25 ? 0 : rng(),
    synth: rng() < 0.25 ? 0 : rng(),
  };
  if (weights.kick === 0 && weights.hat === 0 && weights.synth === 0) {
    weights.hat = 1;
  }
  const classMask = rng() < 0.5 ? 15 : 1 + Math.floor(rng() * 15);
  const midWave = rng() < 0.5;
  const earlyBias = rng() < 0.5 ? 0 : rng() * 3;
  const topK = 1 + Math.floor(rng() * 3);
  const maxTowersPerWave = rng() < 0.25 ? 1 + Math.floor(rng() * 3) : null;
  const upgradeAt = rng() < 0.5 ? null : 20 + Math.floor(rng() * 41);
  return { weights, classMask, midWave, earlyBias, topK, maxTowersPerWave, upgradeAt };
}

type CoverageTable = Record<TowerType, number[][]>;

function buildCoverage(rules: Rules): CoverageTable {
  const cells = pathCells();
  const table = {} as CoverageTable;
  for (const type of TOWER_ORDER) {
    const range = rules.towers[type].range;
    const grid: number[][] = [];
    for (let col = 0; col < GRID_COLS; col += 1) {
      const column: number[] = [];
      for (let row = 0; row < GRID_ROWS; row += 1) {
        let count = 0;
        for (const [pathCol, pathRow] of cells) {
          if (Math.hypot(pathCol - col, pathRow - row) <= range) count += 1;
        }
        column.push(count);
      }
      grid.push(column);
    }
    table[type] = grid;
  }
  return table;
}

interface Cell {
  col: number;
  row: number;
  score: number;
}

export function policyBot(
  policy: Policy,
  rules: Rules,
  onBuy?: (step: PlanStep) => void,
): Bot {
  const coverage = buildCoverage(rules);
  let placedThisWave = 0;

  function spend(ctx: BotContext): void {
    const sim = ctx.sim;
    for (;;) {
      if (policy.maxTowersPerWave !== null && placedThisWave >= policy.maxTowersPerWave) {
        return;
      }

      if (policy.upgradeAt !== null && sim.towers.length >= policy.upgradeAt) {
        let target: { col: number; row: number; cost: number } | null = null;
        let targetLevel = Number.POSITIVE_INFINITY;
        let targetCoverage = Number.NEGATIVE_INFINITY;
        for (const tower of sim.towers) {
          const cost = upgradeCost(sim.rules, tower.type, tower.level);
          if (cost === null) continue;
          const covered = coverage[tower.type][tower.col][tower.row];
          if (
            tower.level < targetLevel ||
            (tower.level === targetLevel && covered > targetCoverage)
          ) {
            target = { col: tower.col, row: tower.row, cost };
            targetLevel = tower.level;
            targetCoverage = covered;
          }
        }
        if (target) {
          if (sim.money < target.cost) return;
          sim.upgradeTower(target.col, target.row);
          onBuy?.({ type: 'upgrade', col: target.col, row: target.row });
          placedThisWave += 1;
          continue;
        }
      }

      const weights = policy.weights;
      const total = weights.kick + weights.hat + weights.synth;
      let best: TowerType = 'hat';
      let bestDeficit = -Infinity;
      for (const type of TOWER_ORDER) {
        if (weights[type] === 0) continue;
        const have = sim.towers.filter((tower) => tower.type === type).length;
        const deficit = (weights[type] / total) * (sim.towers.length + 1) - have;
        if (deficit > bestDeficit) {
          bestDeficit = deficit;
          best = type;
        }
      }
      const type = best;

      if (sim.money < rules.towers[type].cost) return;

      const cells: Cell[] = [];
      for (let col = 0; col < GRID_COLS; col += 1) {
        if (((policy.classMask >> (col % 4)) & 1) === 0) continue;
        for (let row = 0; row < GRID_ROWS; row += 1) {
          if (!sim.canPlace(col, row)) continue;
          const score =
            coverage[type][col][row] -
            policy.earlyBias * (row + (row > 2 ? col * 0.2 : 0));
          cells.push({ col, row, score });
        }
      }

      if (cells.length === 0) return;

      let chosen: Cell;
      if (policy.topK === 1) {
        chosen = cells[0];
        for (const cell of cells) {
          if (cell.score > chosen.score) chosen = cell;
        }
      } else {
        cells.sort((a, b) => b.score - a.score);
        const index = Math.floor(ctx.rng() * Math.min(policy.topK, cells.length));
        chosen = cells[index];
      }

      if (!sim.placeTower(type, chosen.col, chosen.row)) return;
      onBuy?.({ type, col: chosen.col, row: chosen.row });
      placedThisWave += 1;
    }
  }

  return {
    build(ctx: BotContext): void {
      placedThisWave = 0;
      spend(ctx);
    },
    onBar(ctx: BotContext): void {
      if (policy.midWave) spend(ctx);
    },
  };
}

export function playGame(
  bot: Bot,
  difficulty: Difficulty,
  rules: Rules,
  seed: number,
): GameResult {
  const sim = new Sim(difficulty, rules);
  const ctx: BotContext = { sim, rng: makeRng(seed) };
  const livesByWave: number[] = [];
  const damageByType: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  let shots = 0;
  let chordTotal = 0;
  let chordCapped = 0;
  let notes = 0;
  let idleNotes = 0;
  const bossIds = new Set<number>();
  const bossDamageByWave: Record<string, number> = {};
  const bossKills: number[] = [];
  let waveDamage = 0;

  while (sim.phase !== 'won' && sim.phase !== 'lost') {
    bot.build(ctx);
    if (sim.phase === 'build') sim.startWave();
    waveDamage = 0;
    while (sim.phase === 'wave') {
      if (bot.onBar && sim.totalSteps % STEPS_PER_BAR === 0) bot.onBar(ctx);
      const events = sim.step();
      for (const enemy of sim.enemies) {
        if (enemy.type === 'boss') bossIds.add(enemy.id);
      }
      for (const event of events) {
        if (event.kind === 'hit') {
          damageByType[event.towerType] += event.damage;
          waveDamage += event.damage;
          if (bossIds.has(event.enemyId)) {
            const key = String(sim.wave);
            bossDamageByWave[key] = (bossDamageByWave[key] ?? 0) + event.damage;
          }
        } else if (event.kind === 'kill' && event.enemyType === 'boss') {
          bossKills.push(sim.wave);
        } else if (event.kind === 'shot') {
          shots += 1;
          chordTotal +=
            1 +
            rules.chordBonusPerTower *
              (Math.min(event.chordSize, rules.chordMaxTowers) - 1);
          if (event.chordSize >= rules.chordMaxTowers) chordCapped += 1;
        } else if (event.kind === 'note') {
          notes += 1;
          if (!event.hit) idleNotes += 1;
        }
      }
      if (sim.totalSteps >= MAX_STEPS) throw new Error(`game exceeded ${MAX_STEPS} steps`);
    }
    livesByWave.push(sim.lives);
  }

  const mix: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  for (const tower of sim.towers) mix[tower.type] += 1;

  let finalBossWave = 0;
  sim.waves.forEach((groups, index) => {
    if (groups.some((group) => group.type === 'boss')) finalBossWave = index + 1;
  });

  const spentByType: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  for (const tower of sim.towers) {
    spentByType[tower.type] += towerSpent(rules, tower.type, tower.level);
  }
  let upgrades = 0;
  for (const tower of sim.towers) upgrades += tower.level - 1;

  const waveHealth = (sim.waves[sim.wave - 1] ?? []).reduce(
    (sum, group) => sum + group.hp * group.count,
    0,
  );
  const finalWaveProgress = waveHealth === 0 ? 0 : Math.min(1, waveDamage / waveHealth);

  return {
    result: sim.phase,
    wave: sim.wave,
    lives: sim.lives,
    money: sim.money,
    towers: sim.towers.length,
    steps: sim.totalSteps,
    mix,
    livesByWave,
    damageByType,
    shots,
    chordAverage: shots === 0 ? 0 : chordTotal / shots,
    chordCappedShare: shots === 0 ? 0 : chordCapped / shots,
    idleNoteShare: notes === 0 ? 0 : idleNotes / notes,
    bossDamageByWave,
    bossKills,
    finalBossWave,
    startLives: difficulty.startLives,
    spentByType,
    finalWaveProgress,
    upgrades,
  };
}
