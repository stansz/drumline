import { DIFFICULTIES, GRID_COLS, GRID_ROWS, TOWERS, type Difficulty } from '../src/config';
import { Sim, pathCells, type Phase, type TowerType } from '../src/sim';

export type BotStrategy = 'idle' | 'casual' | 'spread' | 'chord';

export interface BotResult {
  result: Phase;
  wave: number;
  lives: number;
  money: number;
  towers: number;
  steps: number;
  livesByWave: number[];
}

const TOWER_ORDER: TowerType[] = ['kick', 'hat', 'synth'];
const MAX_STEPS = 200000;
const CASUAL_TOWERS_PER_WAVE = 1;

interface Candidate {
  col: number;
  row: number;
  coverage: number;
  towersInColumn: number;
}

function coverage(type: TowerType, col: number, row: number): number {
  const range = TOWERS[type].range;
  let count = 0;
  for (const [pathCol, pathRow] of pathCells()) {
    if (Math.hypot(pathCol - col, pathRow - row) <= range) count += 1;
  }
  return count;
}

function bestCell(sim: Sim, type: TowerType, strategy: BotStrategy): Candidate | null {
  const candidates: Candidate[] = [];
  for (let col = 0; col < GRID_COLS; col += 1) {
    const towersInColumn = sim.towers.filter((tower) => tower.col === col).length;
    if (strategy === 'chord' && towersInColumn >= 4) continue;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (!sim.canPlace(col, row)) continue;
      candidates.push({
        col,
        row,
        coverage: coverage(type, col, row),
        towersInColumn,
      });
    }
  }

  candidates.sort((a, b) => {
    if (strategy === 'chord') {
      if (a.towersInColumn !== b.towersInColumn) return b.towersInColumn - a.towersInColumn;
    } else if (a.towersInColumn !== b.towersInColumn) {
      return a.towersInColumn - b.towersInColumn;
    }
    if (a.coverage !== b.coverage) return b.coverage - a.coverage;
    if (a.col !== b.col) return a.col - b.col;
    return a.row - b.row;
  });

  return candidates[0] ?? null;
}

function spendAll(sim: Sim, strategy: BotStrategy, cycle: { index: number }): void {
  let budget = strategy === 'casual' ? CASUAL_TOWERS_PER_WAVE : Number.POSITIVE_INFINITY;
  while (budget > 0) {
    let placed = false;
    for (let attempt = 0; attempt < TOWER_ORDER.length; attempt += 1) {
      const type = TOWER_ORDER[cycle.index % TOWER_ORDER.length];
      if (type) {
        const cost = TOWERS[type].cost;
        if (sim.money >= cost) {
          const cell = bestCell(sim, type, strategy);
          if (cell && sim.placeTower(type, cell.col, cell.row)) {
            cycle.index = (cycle.index + 1) % TOWER_ORDER.length;
            placed = true;
            break;
          }
        }
      }
      cycle.index = (cycle.index + 1) % TOWER_ORDER.length;
    }
    if (!placed) return;
    budget -= 1;
  }
}

export function playBot(
  strategy: BotStrategy,
  difficulty: Difficulty = DIFFICULTIES.hard,
): BotResult {
  const sim = new Sim(difficulty);
  const cycle = { index: 0 };
  const livesByWave: number[] = [];

  while (sim.phase !== 'won' && sim.phase !== 'lost') {
    if (strategy !== 'idle') {
      spendAll(sim, strategy, cycle);
    }
    if (sim.phase === 'build' && !sim.startWave()) {
      throw new Error(`bot ${strategy} could not start a wave`);
    }
    while (sim.phase === 'wave') {
      sim.step();
      if (sim.totalSteps >= MAX_STEPS && sim.phase === 'wave') {
        throw new Error(`bot ${strategy} exceeded ${MAX_STEPS} steps`);
      }
    }
    livesByWave.push(sim.lives);
  }

  return {
    result: sim.phase,
    wave: sim.wave,
    lives: sim.lives,
    money: sim.money,
    towers: sim.towers.length,
    steps: sim.totalSteps,
    livesByWave,
  };
}
