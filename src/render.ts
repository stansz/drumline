import {
  CHORD_BONUS_PER_TOWER,
  CHORD_MAX_TOWERS,
  ENEMIES,
  GRID_COLS,
  GRID_ROWS,
  PALETTE,
  TOWERS,
} from './config';
import { pathCells, pathLength, pathPoint, type Sim, type SimEvent, type TowerType } from './sim';

const CELL = 56;
const WIDTH = GRID_COLS * CELL;
const HEIGHT = GRID_ROWS * CELL;

export interface RenderState {
  sim: Sim;
  now: number;
  lastStepTime: number;
  stepDuration: number;
  playhead: number;
  selected: TowerType | 'sell' | null;
  hover: { col: number; row: number } | null;
  inspect: { col: number; row: number } | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  color: string;
}

interface RingEffect {
  kind: 'ring';
  x: number;
  y: number;
  born: number;
  life: number;
  fromRadius: number;
  toRadius: number;
  fromWidth: number;
  toWidth: number;
  color: string;
  peakAlpha: number;
}

interface LineEffect {
  kind: 'line';
  x: number;
  y: number;
  x2: number;
  y2: number;
  born: number;
  life: number;
  lineWidth: number;
  color: string;
}

interface BoltEffect {
  kind: 'bolt';
  points: Array<{ x: number; y: number }>;
  born: number;
  life: number;
  lineWidth: number;
  color: string;
}

interface SparkEffect {
  kind: 'spark';
  x: number;
  y: number;
  born: number;
  life: number;
  radius: number;
  color: string;
}

interface LabelEffect {
  kind: 'label';
  x: number;
  y: number;
  born: number;
  life: number;
  text: string;
  color: string;
}

type AttackEffect = RingEffect | LineEffect | BoltEffect | SparkEffect;

const TOWER_COLORS: Record<TowerType, string> = {
  kick: PALETTE.kick,
  hat: PALETTE.hat,
  synth: PALETTE.synth,
};

const TOWER_SIZES: Record<TowerType, number> = {
  kick: 17,
  hat: 20,
  synth: 21,
};

export function drawTowerShape(
  ctx: CanvasRenderingContext2D,
  type: TowerType,
  size: number,
): void {
  ctx.beginPath();
  if (type === 'kick') {
    ctx.arc(0, 0, size, 0, Math.PI * 2);
  } else if (type === 'hat') {
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.95, size * 0.8);
    ctx.lineTo(-size * 0.95, size * 0.8);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
  }
  ctx.fill();
}

function boltPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Array<{ x: number; y: number }> {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy) || 1;
  const perpX = -dy / length;
  const perpY = dx / length;
  const points: Array<{ x: number; y: number }> = [{ x: fromX, y: fromY }];
  for (let i = 1; i < 6; i += 1) {
    const t = i / 6;
    const offset = Math.random() * 16 - 8;
    points.push({
      x: fromX + dx * t + perpX * offset,
      y: fromY + dy * t + perpY * offset,
    });
  }
  points.push({ x: toX, y: toY });
  return points;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pathCellList: ReturnType<typeof pathCells>;
  private readonly flashes = new Map<string, number>();
  private readonly hitFlashes = new Map<number, { color: string; at: number }>();
  private readonly chordLabelAt = new Map<number, number>();
  private particles: Particle[] = [];
  private effects: AttackEffect[] = [];
  private labels: LabelEffect[] = [];
  private lastNow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);
    this.pathCellList = pathCells();
  }

  spawnEffect(event: SimEvent): void {
    if (event.kind === 'note') {
      this.flashes.set(`${event.col},${event.row}`, this.lastNow);
      if (!event.hit) {
        this.effects.push({
          kind: 'ring',
          x: (event.col + 0.5) * CELL,
          y: (event.row + 0.5) * CELL,
          born: this.lastNow,
          life: 0.2,
          fromRadius: 18,
          toRadius: 28,
          fromWidth: 1.5,
          toWidth: 1.5,
          color: TOWER_COLORS[event.towerType],
          peakAlpha: 0.25,
        });
      }
      return;
    }
    if (event.kind === 'shot') {
      const towerX = (event.col + 0.5) * CELL;
      const towerY = (event.row + 0.5) * CELL;
      const targetX = (event.x + 0.5) * CELL;
      const targetY = (event.y + 0.5) * CELL;
      const color = TOWER_COLORS[event.towerType];

      if (event.towerType === 'kick') {
        this.effects.push({
          kind: 'ring',
          x: targetX,
          y: targetY,
          born: this.lastNow,
          life: 0.3,
          fromRadius: 0,
          toRadius: TOWERS.kick.splash * CELL,
          fromWidth: 4,
          toWidth: 1,
          color,
          peakAlpha: 1,
        });
        this.effects.push({
          kind: 'line',
          x: towerX,
          y: towerY,
          x2: targetX,
          y2: targetY,
          born: this.lastNow,
          life: 0.1,
          lineWidth: 5,
          color,
        });
      } else if (event.towerType === 'hat') {
        this.effects.push({
          kind: 'line',
          x: towerX,
          y: towerY,
          x2: targetX,
          y2: targetY,
          born: this.lastNow,
          life: 0.12,
          lineWidth: 2,
          color,
        });
        this.effects.push({
          kind: 'spark',
          x: targetX,
          y: targetY,
          born: this.lastNow,
          life: 0.12,
          radius: 4,
          color,
        });
      } else {
        this.effects.push({
          kind: 'bolt',
          points: boltPoints(towerX, towerY, targetX, targetY),
          born: this.lastNow,
          life: 0.2,
          lineWidth: 2.5,
          color,
        });
      }

      if (event.chordSize >= 2 && this.chordLabelAt.get(event.col) !== this.lastNow) {
        this.chordLabelAt.set(event.col, this.lastNow);
        const multiplier =
          1 + CHORD_BONUS_PER_TOWER * (Math.min(event.chordSize, CHORD_MAX_TOWERS) - 1);
        this.labels.push({
          kind: 'label',
          x: (event.col + 0.5) * CELL,
          y: 22,
          born: this.lastNow,
          life: 0.5,
          text: `×${multiplier.toFixed(2)}`,
          color: PALETTE.enemy,
        });
      }
      return;
    }
    if (event.kind === 'chain') {
      this.effects.push({
        kind: 'bolt',
        points: boltPoints(
          (event.fromX + 0.5) * CELL,
          (event.fromY + 0.5) * CELL,
          (event.x + 0.5) * CELL,
          (event.y + 0.5) * CELL,
        ),
        born: this.lastNow,
        life: 0.2,
        lineWidth: 1.5,
        color: PALETTE.synth,
      });
      return;
    }
    if (event.kind === 'hit') {
      this.hitFlashes.set(event.enemyId, {
        color: TOWER_COLORS[event.towerType],
        at: this.lastNow,
      });
      return;
    }
    if (event.kind !== 'kill') return;
    const colors = [PALETTE.kick, PALETTE.hat, PALETTE.synth];
    for (let i = 0; i < 12; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 170;
      this.particles.push({
        x: (event.x + 0.5) * CELL,
        y: (event.y + 0.5) * CELL,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        born: this.lastNow,
        life: 0.5 + Math.random() * 0.35,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)] ?? PALETTE.kick,
      });
    }
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.grid;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        ctx.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }

  private drawPath(): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.path;
    for (const [col, row] of this.pathCellList) {
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }

  private drawPlayhead(playhead: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = PALETTE.playhead;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(playhead * CELL, 0, CELL, HEIGHT);
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = PALETTE.playhead;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playhead * CELL + 0.5, 0);
    ctx.lineTo(playhead * CELL + 0.5, HEIGHT);
    ctx.stroke();
    ctx.restore();
  }

  private towerScale(col: number, row: number, now: number): number {
    const flash = this.flashes.get(`${col},${row}`);
    if (flash === undefined) return 1;
    const age = now - flash;
    if (age >= 0.15) {
      this.flashes.delete(`${col},${row}`);
      return 1;
    }
    const t = 1 - Math.max(0, age) / 0.15;
    return 1 + 0.3 * t * t;
  }

  private drawTowers(sim: Sim, now: number): void {
    const ctx = this.ctx;
    for (const tower of sim.towers) {
      const cx = (tower.col + 0.5) * CELL;
      const cy = (tower.row + 0.5) * CELL;
      const scale = this.towerScale(tower.col, tower.row, now);
      const color = TOWER_COLORS[tower.type];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      drawTowerShape(ctx, tower.type, TOWER_SIZES[tower.type]);
      ctx.restore();
    }
  }

  private drawEnemies(state: RenderState): void {
    const ctx = this.ctx;
    const { sim, now, lastStepTime, stepDuration } = state;
    const maxProgress = pathLength();
    for (const [id, flash] of this.hitFlashes) {
      if (now - flash.at >= 0.1) this.hitFlashes.delete(id);
    }
    for (const enemy of sim.enemies) {
      const speed = ENEMIES[enemy.type].speed;
      const elapsedSteps = stepDuration > 0 ? (now - lastStepTime) / stepDuration : 0;
      const rendered = Math.max(
        0,
        Math.min(enemy.progress + speed * elapsedSteps, maxProgress),
      );
      const point = pathPoint(rendered);
      const x = (point.x + 0.5) * CELL;
      const y = (point.y + 0.5) * CELL;
      const flash = this.hitFlashes.get(enemy.id);
      const flashing = flash !== undefined && now - flash.at < 0.1;
      const color = flashing && flash ? flash.color : PALETTE.enemy;
      const scale = flashing ? 1.25 : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      let half = 0;

      if (enemy.type === 'blip') {
        half = 7;
        ctx.beginPath();
        ctx.arc(0, 0, half, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'runner') {
        half = 8;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(9, 8);
        ctx.lineTo(-9, 8);
        ctx.closePath();
        ctx.fill();
      } else {
        half = enemy.type === 'boss' ? 19 : 11;
        ctx.fillRect(-half, -half, half * 2, half * 2);
      }
      ctx.restore();

      if (enemy.hp < enemy.maxHp) {
        const barWidth = half * 2 + 8;
        const barHeight = 4;
        const barX = x - barWidth / 2;
        const barY = y - half - 10;
        ctx.fillStyle = PALETTE.bg;
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = PALETTE.enemy;
        ctx.fillRect(barX, barY, barWidth * Math.max(0, enemy.hp / enemy.maxHp), barHeight);
      }
    }
  }

  draw(state: RenderState): void {
    const ctx = this.ctx;
    this.lastNow = state.now;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawGrid();
    this.drawPath();
    this.drawPlayhead(state.playhead);
    this.drawRanges(state);
    this.drawTowers(state.sim, state.now);
    this.drawEnemies(state);
    this.drawEffects(state.now);
    this.drawParticles(state.now);
    this.drawLabels(state.now);
  }

  private drawEffects(now: number): void {
    const ctx = this.ctx;
    this.effects = this.effects.filter((effect) => now - effect.born < effect.life);
    for (const effect of this.effects) {
      const t = Math.max(0, Math.min(1, (now - effect.born) / effect.life));
      ctx.save();
      if (effect.kind === 'ring') {
        const radius = effect.fromRadius + (effect.toRadius - effect.fromRadius) * t;
        ctx.globalAlpha = effect.peakAlpha * (1 - t);
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = effect.fromWidth + (effect.toWidth - effect.fromWidth) * t;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, Math.max(0, radius), 0, Math.PI * 2);
        ctx.stroke();
      } else if (effect.kind === 'line') {
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = effect.lineWidth;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
      } else if (effect.kind === 'bolt') {
        const first = effect.points[0];
        if (first) {
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = effect.lineWidth;
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < effect.points.length; i += 1) {
            const point = effect.points[i];
            if (point) ctx.lineTo(point.x, point.y);
          }
          ctx.stroke();
        }
      } else {
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawLabels(now: number): void {
    const ctx = this.ctx;
    this.labels = this.labels.filter((label) => now - label.born < label.life);
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of this.labels) {
      const t = Math.max(0, Math.min(1, (now - label.born) / label.life));
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, label.x, label.y - 16 * t);
    }
    ctx.restore();
  }

  private drawParticles(now: number): void {
    const ctx = this.ctx;
    this.particles = this.particles.filter((particle) => now - particle.born < particle.life);
    for (const particle of this.particles) {
      const age = Math.max(0, now - particle.born);
      const alpha = 1 - age / particle.life;
      const x = particle.x + particle.vx * age;
      const y = particle.y + particle.vy * age + 240 * age * age;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = particle.color;
      ctx.fillRect(x - particle.size / 2, y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawRanges(state: RenderState): void {
    const ctx = this.ctx;
    const { sim, inspect } = state;
    if (inspect) {
      const tower = sim.towers.find(
        (candidate) => candidate.col === inspect.col && candidate.row === inspect.row,
      );
      if (tower) {
        const cx = (tower.col + 0.5) * CELL;
        const cy = (tower.row + 0.5) * CELL;
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = TOWER_COLORS[tower.type];
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, TOWERS[tower.type].range * CELL, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.drawPreview(state);
  }

  private drawPreview(state: RenderState): void {
    const { sim, selected, hover } = state;
    if (!hover || !selected || selected === 'sell') return;
    if (!sim.canPlace(hover.col, hover.row)) return;
    const ctx = this.ctx;
    const cx = (hover.col + 0.5) * CELL;
    const cy = (hover.row + 0.5) * CELL;
    const color = TOWER_COLORS[selected];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    drawTowerShape(ctx, selected, 20);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, TOWERS[selected].range * CELL, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
