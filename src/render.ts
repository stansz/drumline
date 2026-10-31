import { ENEMIES, GRID_COLS, GRID_ROWS, PALETTE, TOWERS } from './config';
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

const TOWER_COLORS: Record<TowerType, string> = {
  kick: PALETTE.kick,
  hat: PALETTE.hat,
  synth: PALETTE.synth,
};

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pathCellList: ReturnType<typeof pathCells>;
  private readonly flashes = new Map<string, number>();
  private particles: Particle[] = [];
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
      if (tower.type === 'kick') {
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();
      } else if (tower.type === 'hat') {
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(19, 16);
        ctx.lineTo(-19, 16);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -21);
        ctx.lineTo(21, 0);
        ctx.lineTo(0, 21);
        ctx.lineTo(-21, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawEnemies(state: RenderState): void {
    const ctx = this.ctx;
    const { sim, now, lastStepTime, stepDuration } = state;
    const maxProgress = pathLength();
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
      ctx.save();
      ctx.fillStyle = PALETTE.enemy;
      ctx.shadowColor = PALETTE.enemy;
      ctx.shadowBlur = 10;
      let half = 0;

      if (enemy.type === 'blip') {
        half = 7;
        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'runner') {
        half = 8;
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 9, y + 8);
        ctx.lineTo(x - 9, y + 8);
        ctx.closePath();
        ctx.fill();
      } else {
        half = enemy.type === 'boss' ? 19 : 11;
        ctx.fillRect(x - half, y - half, half * 2, half * 2);
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
    this.drawTowers(state.sim, state.now);
    this.drawEnemies(state);
    this.drawParticles(state.now);
    this.drawPreview(state);
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

  private drawPreview(state: RenderState): void {
    const { sim, selected, hover } = state;
    if (!hover || !selected || selected === 'sell') return;
    if (!sim.canPlace(hover.col, hover.row)) return;
    const ctx = this.ctx;
    const cx = (hover.col + 0.5) * CELL;
    const cy = (hover.row + 0.5) * CELL;
    const color = TOWER_COLORS[selected];
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, TOWERS[selected].range * CELL, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
