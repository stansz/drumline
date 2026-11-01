import {
  AUTO_WAVE_STEPS,
  CHORD_BONUS_PER_TOWER,
  CHORD_MAX_TOWERS,
  DIFFICULTIES,
  ENEMIES,
  GRID_COLS,
  GRID_ROWS,
  PATH_WAYPOINTS,
  SELL_REFUND,
  STEPS_PER_BAR,
  TOWERS,
  type Difficulty,
  type WaveGroup,
} from './config';
import { buildWaves } from './waves';

export type TowerType = 'kick' | 'hat' | 'synth';
export type EnemyType = 'blip' | 'runner' | 'brute' | 'boss';
export type Phase = 'build' | 'wave' | 'won' | 'lost';

export interface Tower {
  type: TowerType;
  col: number;
  row: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  progress: number;
}

export type SimEvent =
  | {
      kind: 'note';
      towerType: TowerType;
      col: number;
      row: number;
      hit: boolean;
      chordSize: number;
    }
  | {
      kind: 'shot';
      towerType: TowerType;
      col: number;
      row: number;
      x: number;
      y: number;
      chordSize: number;
      step: number;
    }
  | { kind: 'chain'; fromX: number; fromY: number; x: number; y: number }
  | { kind: 'hit'; x: number; y: number; towerType: TowerType; enemyId: number }
  | { kind: 'kill'; x: number; y: number; enemyType: EnemyType }
  | { kind: 'leak'; lives: number }
  | { kind: 'waveStart'; wave: number }
  | { kind: 'waveClear'; wave: number }
  | { kind: 'won' }
  | { kind: 'lost' };

export interface PathPoint {
  x: number;
  y: number;
}

interface PathSegment {
  from: readonly [number, number];
  to: readonly [number, number];
  start: number;
  length: number;
}

function buildPathCells(): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  const first = PATH_WAYPOINTS[0];
  if (!first) return cells;
  cells.push([first[0], first[1]]);
  for (let i = 1; i < PATH_WAYPOINTS.length; i += 1) {
    const prev = PATH_WAYPOINTS[i - 1];
    const next = PATH_WAYPOINTS[i];
    if (!prev || !next) continue;
    let col = prev[0];
    let row = prev[1];
    const dc = Math.sign(next[0] - col);
    const dr = Math.sign(next[1] - row);
    while (col !== next[0] || row !== next[1]) {
      col += dc;
      row += dr;
      cells.push([col, row]);
    }
  }
  return cells;
}

const PATH_CELLS = buildPathCells();
const PATH_CELL_KEYS = new Set(PATH_CELLS.map(([col, row]) => `${col},${row}`));

function buildSegments(): PathSegment[] {
  const segments: PathSegment[] = [];
  let distance = 0;
  for (let i = 1; i < PATH_WAYPOINTS.length; i += 1) {
    const from = PATH_WAYPOINTS[i - 1];
    const to = PATH_WAYPOINTS[i];
    if (!from || !to) continue;
    const length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    segments.push({ from, to, start: distance, length });
    distance += length;
  }
  return segments;
}

const SEGMENTS = buildSegments();
const PATH_LENGTH = SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);

export function pathCells(): Array<[number, number]> {
  return PATH_CELLS.map(([col, row]) => [col, row]);
}

export function pathLength(): number {
  return PATH_LENGTH;
}

export function pathPoint(progress: number): PathPoint {
  const clamped = Math.max(0, Math.min(progress, PATH_LENGTH));
  for (const segment of SEGMENTS) {
    if (clamped <= segment.start + segment.length) {
      const t = segment.length === 0 ? 0 : (clamped - segment.start) / segment.length;
      return {
        x: segment.from[0] + (segment.to[0] - segment.from[0]) * t,
        y: segment.from[1] + (segment.to[1] - segment.from[1]) * t,
      };
    }
  }
  const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1] ?? [0, 0];
  return { x: last[0], y: last[1] };
}

interface Spawn {
  type: EnemyType;
  atStep: number;
  hp: number;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function firesThisStep(type: TowerType, col: number, stepIndex: number): boolean {
  if (type === 'hat') {
    return (stepIndex - col + STEPS_PER_BAR) % 4 === 0;
  }
  return stepIndex === col;
}

export class Sim {
  readonly difficulty: Difficulty;
  readonly waves: WaveGroup[][];
  money: number;
  lives: number;
  wave: number;
  phase: Phase;
  stepIndex: number;
  totalSteps: number;
  towers: Tower[];
  enemies: Enemy[];
  autoWave: boolean;

  private nextEnemyId: number;
  private spawnQueue: Spawn[];
  private waveStartPending: boolean;
  private nextWaveStep: number | null;

  constructor(difficulty: Difficulty = DIFFICULTIES.hard) {
    this.difficulty = difficulty;
    this.waves = buildWaves(difficulty);
    this.money = difficulty.startMoney;
    this.lives = difficulty.startLives;
    this.wave = 0;
    this.phase = 'build';
    this.stepIndex = 0;
    this.totalSteps = 0;
    this.towers = [];
    this.enemies = [];
    this.autoWave = false;
    this.nextEnemyId = 1;
    this.spawnQueue = [];
    this.waveStartPending = false;
    this.nextWaveStep = null;
  }

  private hasTowerAt(col: number, row: number): boolean {
    return this.towers.some((tower) => tower.col === col && tower.row === row);
  }

  canPlace(col: number, row: number): boolean {
    if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (PATH_CELL_KEYS.has(`${col},${row}`)) return false;
    return !this.hasTowerAt(col, row);
  }

  placeTower(type: TowerType, col: number, row: number): boolean {
    if (this.phase === 'won' || this.phase === 'lost') return false;
    if (!this.canPlace(col, row)) return false;
    const cost = TOWERS[type].cost;
    if (this.money < cost) return false;
    this.money -= cost;
    this.towers.push({ type, col, row });
    return true;
  }

  sellTower(col: number, row: number): boolean {
    const index = this.towers.findIndex((tower) => tower.col === col && tower.row === row);
    if (index === -1) return false;
    const tower = this.towers[index];
    if (!tower) return false;
    this.money += Math.floor(TOWERS[tower.type].cost * SELL_REFUND);
    this.towers.splice(index, 1);
    return true;
  }

  setAutoWave(on: boolean): void {
    this.autoWave = on;
    const waiting = on && this.phase === 'build' && this.wave > 0;
    this.nextWaveStep = waiting ? this.totalSteps + AUTO_WAVE_STEPS : null;
  }

  stepsUntilNextWave(): number | null {
    if (this.nextWaveStep === null) return null;
    return Math.max(0, this.nextWaveStep - this.totalSteps);
  }

  startWave(): boolean {
    if (this.phase !== 'build') return false;
    if (this.wave >= this.waves.length) return false;
    this.wave += 1;
    this.phase = 'wave';
    this.waveStartPending = true;
    this.nextWaveStep = null;

    const groups: WaveGroup[] = this.waves[this.wave - 1] ?? [];
    const stepsUntilBar = (STEPS_PER_BAR - this.stepIndex) % STEPS_PER_BAR;
    let groupStart = this.totalSteps + stepsUntilBar;
    this.spawnQueue = [];

    for (const group of groups) {
      for (let i = 0; i < group.count; i += 1) {
        this.spawnQueue.push({
          type: group.type,
          atStep: groupStart + i * group.gapSteps,
          hp: group.hp,
        });
      }
      const lastSpawnOffset = group.count > 0 ? (group.count - 1) * group.gapSteps : 0;
      groupStart = groupStart + lastSpawnOffset + STEPS_PER_BAR;
    }

    return true;
  }

  private spawnDue(): void {
    const due = this.spawnQueue.filter((spawn) => spawn.atStep <= this.totalSteps);
    if (due.length === 0) return;
    this.spawnQueue = this.spawnQueue.filter((spawn) => spawn.atStep > this.totalSteps);
    for (const spawn of due) {
      this.enemies.push({
        id: this.nextEnemyId,
        type: spawn.type,
        hp: spawn.hp,
        maxHp: spawn.hp,
        progress: 0,
      });
      this.nextEnemyId += 1;
    }
  }

  private enemiesInRange(col: number, row: number, range: number): Enemy[] {
    const inRange: Enemy[] = [];
    for (const enemy of this.enemies) {
      const point = pathPoint(enemy.progress);
      if (distance(col, row, point.x, point.y) <= range) {
        inRange.push(enemy);
      }
    }
    return inRange;
  }

  private fireTowers(events: SimEvent[], applyDamage: boolean): void {
    const firing = this.towers.filter((tower) =>
      firesThisStep(tower.type, tower.col, this.stepIndex),
    );
    const chordSize = firing.length;
    const multiplier =
      1 + CHORD_BONUS_PER_TOWER * (Math.min(chordSize, CHORD_MAX_TOWERS) - 1);

    for (const tower of firing) {
      const stats = TOWERS[tower.type];
      const inRange = this.enemiesInRange(tower.col, tower.row, stats.range);
      let target: Enemy | null = null;
      for (const enemy of inRange) {
        if (!target || enemy.progress > target.progress) {
          target = enemy;
        }
      }

      events.push({
        kind: 'note',
        towerType: tower.type,
        col: tower.col,
        row: tower.row,
        hit: target !== null,
        chordSize,
      });

      if (!applyDamage || !target) continue;

      const targetPoint = pathPoint(target.progress);
      events.push({
        kind: 'shot',
        towerType: tower.type,
        col: tower.col,
        row: tower.row,
        x: targetPoint.x,
        y: targetPoint.y,
        chordSize,
        step: this.stepIndex,
      });
      const baseDamage = stats.damage * multiplier;

      if (tower.type === 'kick') {
        for (const enemy of this.enemies) {
          const point = pathPoint(enemy.progress);
          if (distance(targetPoint.x, targetPoint.y, point.x, point.y) <= stats.splash) {
            enemy.hp -= baseDamage;
            events.push({
              kind: 'hit',
              x: point.x,
              y: point.y,
              towerType: tower.type,
              enemyId: enemy.id,
            });
          }
        }
      } else if (tower.type === 'synth') {
        target.hp -= baseDamage;
        events.push({
          kind: 'hit',
          x: targetPoint.x,
          y: targetPoint.y,
          towerType: tower.type,
          enemyId: target.id,
        });

        const alreadyHit = new Set<Enemy>([target]);
        let previous = target;
        for (let link = 0; link < stats.chain; link += 1) {
          const previousPoint = pathPoint(previous.progress);
          let next: Enemy | null = null;
          let nextDistance = Number.POSITIVE_INFINITY;
          for (const enemy of this.enemies) {
            if (alreadyHit.has(enemy)) continue;
            const point = pathPoint(enemy.progress);
            const gap = distance(previousPoint.x, previousPoint.y, point.x, point.y);
            if (gap > 2) continue;
            if (gap < nextDistance || (gap === nextDistance && next && enemy.id < next.id)) {
              next = enemy;
              nextDistance = gap;
            }
          }
          if (!next) break;
          alreadyHit.add(next);
          const point = pathPoint(next.progress);
          next.hp -= baseDamage * 0.5;
          events.push({
            kind: 'chain',
            fromX: previousPoint.x,
            fromY: previousPoint.y,
            x: point.x,
            y: point.y,
          });
          events.push({
            kind: 'hit',
            x: point.x,
            y: point.y,
            towerType: tower.type,
            enemyId: next.id,
          });
          previous = next;
        }
      } else {
        target.hp -= baseDamage;
        events.push({
          kind: 'hit',
          x: targetPoint.x,
          y: targetPoint.y,
          towerType: tower.type,
          enemyId: target.id,
        });
      }
    }
  }

  step(): SimEvent[] {
    const events: SimEvent[] = [];
    const terminal = this.phase === 'won' || this.phase === 'lost';

    if (terminal) {
      this.fireTowers(events, false);
      this.stepIndex = (this.stepIndex + 1) % STEPS_PER_BAR;
      this.totalSteps += 1;
      return events;
    }

    if (this.nextWaveStep !== null && this.totalSteps >= this.nextWaveStep) {
      this.startWave();
    }

    if (this.waveStartPending) {
      events.push({ kind: 'waveStart', wave: this.wave });
      this.waveStartPending = false;
    }

    this.spawnDue();

    this.fireTowers(events, true);

    const survivors: Enemy[] = [];
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        const point = pathPoint(enemy.progress);
        this.money += ENEMIES[enemy.type].bounty;
        events.push({
          kind: 'kill',
          x: point.x,
          y: point.y,
          enemyType: enemy.type,
        });
      } else {
        survivors.push(enemy);
      }
    }
    this.enemies = survivors;

    const stillAlive: Enemy[] = [];
    for (const enemy of this.enemies) {
      enemy.progress += ENEMIES[enemy.type].speed;
      if (enemy.progress >= PATH_LENGTH) {
        this.lives = Math.max(0, this.lives - ENEMIES[enemy.type].leak);
        events.push({ kind: 'leak', lives: this.lives });
      } else {
        stillAlive.push(enemy);
      }
    }
    this.enemies = stillAlive;

    if (this.lives === 0) {
      this.phase = 'lost';
      events.push({ kind: 'lost' });
    } else if (
      this.phase === 'wave' &&
      this.spawnQueue.length === 0 &&
      this.enemies.length === 0
    ) {
      this.money += this.difficulty.waveBonus;
      events.push({ kind: 'waveClear', wave: this.wave });
      if (this.wave === this.waves.length) {
        this.phase = 'won';
        events.push({ kind: 'won' });
      } else {
        this.phase = 'build';
        this.nextWaveStep = this.autoWave ? this.totalSteps + 1 + AUTO_WAVE_STEPS : null;
      }
    }

    this.stepIndex = (this.stepIndex + 1) % STEPS_PER_BAR;
    this.totalSteps += 1;

    return events;
  }
}
