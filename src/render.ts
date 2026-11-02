import {
  CHORD_BONUS_PER_TOWER,
  CHORD_MAX_TOWERS,
  ENEMIES,
  GRID_COLS,
  GRID_ROWS,
  TOWERS,
  towerStats,
  upgradeCost,
} from './config';
import { bayer, circlePoints, drawText, linePoints } from './pixel';
import {
  pathCells,
  pathLength,
  pathPoint,
  type Sim,
  type SimEvent,
  type TowerType,
} from './sim';
import {
  LEVEL_BADGES,
  LOGO_GLYPHS,
  PIXEL_COLORS,
  SPRITES,
  STEP_GROUP_COLORS,
  type SpriteName,
} from './sprites';

export const ART_CELL = 16;
export const ART_WIDTH = GRID_COLS * ART_CELL; // 256
export const ART_HEIGHT = GRID_ROWS * ART_CELL; // 128

const INK = PIXEL_COLORS['0'];
const SHADOW = '#2b2733';
const TOWER_FLASH = 0.1;
const PARTICLE_GRAVITY = 240 * (ART_CELL / 56);
const PARTICLE_SPEED = ART_CELL / 56;

const TOWER_OUTLINE: Record<TowerType, string> = {
  kick: PIXEL_COLORS['7'],
  hat: PIXEL_COLORS.a,
  synth: PIXEL_COLORS.c,
};

export interface RenderState {
  sim: Sim;
  now: number;
  lastStepTime: number;
  stepDuration: number;
  playhead: number;
  selected: TowerType | 'sell' | 'upgrade' | null;
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
  color: string;
}

interface KickEffect {
  kind: 'kick';
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  born: number;
  life: number;
  splash: number;
}

interface HatEffect {
  kind: 'hat';
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  born: number;
  life: number;
}

interface BoltEffect {
  kind: 'bolt';
  points: Array<{ x: number; y: number }>;
  born: number;
  life: number;
  color: string;
}

type AttackEffect = KickEffect | HatEffect | BoltEffect;

interface ChordLabel {
  column: number;
  born: number;
  life: number;
  text: string;
}

interface BakedSprites {
  normal: readonly [HTMLCanvasElement, HTMLCanvasElement];
  hit: readonly [HTMLCanvasElement, HTMLCanvasElement];
}

// Turns one frame of sprite data into a canvas. '.' is transparent, and every other
// character is a key in PIXEL_COLORS unless the caller maps it to a different color.
function bake(rows: readonly string[], map?: (character: string) => string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0]?.length ?? 0;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  rows.forEach((row, y) => {
    [...row].forEach((character, x) => {
      if (character === '.') return;
      const color = map ? map(character) : PIXEL_COLORS[character];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

// The hit variant keeps the ink outline and turns every other color white.
function hitColor(character: string): string {
  return character === '0' ? PIXEL_COLORS['0'] : PIXEL_COLORS['6'];
}

const BAKED = new Map<SpriteName, BakedSprites>();
for (const name of Object.keys(SPRITES) as SpriteName[]) {
  const [first, second] = SPRITES[name];
  BAKED.set(name, {
    normal: [bake(first), bake(second)],
    hit: [bake(first, hitColor), bake(second, hitColor)],
  });
}

const BADGES = new Map<number, HTMLCanvasElement>();
for (const [level, rows] of Object.entries(LEVEL_BADGES)) {
  BADGES.set(Number(level), bake(rows));
}

// A six segment jagged line between two art pixels.
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
    const offset = Math.random() * 6 - 3;
    points.push({
      x: fromX + dx * t + perpX * offset,
      y: fromY + dy * t + perpY * offset,
    });
  }
  points.push({ x: toX, y: toY });
  return points;
}

function shade(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (part: number): number => Math.min(255, Math.round(part * factor));
  return `rgb(${channel(value >> 16)}, ${channel((value >> 8) & 255)}, ${channel(value & 255)})`;
}

export function drawLogo(canvas: HTMLCanvasElement): void {
  const word = 'DRUMLINE';
  const letters = [...word].map((character) => LOGO_GLYPHS[character] ?? []);
  let width = 0;
  for (const rows of letters) width += (rows[0]?.length ?? 0) + 1;
  canvas.width = width + 20;
  canvas.height = 11;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const plot = (rows: readonly string[], left: number, top: number, color: string): void => {
    ctx.fillStyle = color;
    rows.forEach((row, y) => {
      [...row].forEach((filled, i) => {
        if (filled === '#') ctx.fillRect(left + i, top + y, 1, 1);
      });
    });
  };

  let x = 1;
  letters.forEach((rows, index) => {
    const color =
      STEP_GROUP_COLORS[Math.floor(index / 2) % STEP_GROUP_COLORS.length] ??
      STEP_GROUP_COLORS[0];
    // The two lower layers give the letters a chunky drop shadow.
    plot(rows, x, 3, '#000');
    plot(rows, x, 2, shade(color, 0.55));
    plot(rows, x, 1, color);
    x += (rows[0]?.length ?? 0) + 1;
  });

  // "TD" sits on a red pad, so the name reads as two parts.
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 1, 1, 16, 10);
  ctx.fillStyle = PIXEL_COLORS['7'];
  ctx.fillRect(x + 1, 0, 16, 10);
  ctx.fillStyle = PIXEL_COLORS['8'];
  ctx.fillRect(x + 1, 9, 16, 1);
  plot(LOGO_GLYPHS.T ?? [], x + 3, 1, PIXEL_COLORS['5']);
  plot(LOGO_GLYPHS.D ?? [], x + 9, 1, PIXEL_COLORS['5']);
}

export function drawIcon(canvas: HTMLCanvasElement, name: SpriteName): void {
  const frames = BAKED.get(name);
  if (!frames) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frames.normal[0], 0, 0);
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly display: CanvasRenderingContext2D;
  private readonly buffer: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly board: HTMLCanvasElement;
  private readonly head: HTMLCanvasElement;
  private readonly pathCellList: Array<[number, number]>;
  private readonly laneKeys: Set<string>;
  private readonly calm: boolean;
  private readonly flashes = new Map<string, number>();
  private readonly hitFlashes = new Map<number, number>();
  private effects: AttackEffect[] = [];
  private particles: Particle[] = [];
  private label: ChordLabel | null = null;
  private lastNow = 0;
  private leakAt = Number.NEGATIVE_INFINITY;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const display = canvas.getContext('2d');
    if (!display) throw new Error('Canvas 2D context is unavailable');
    this.display = display;
    this.calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.pathCellList = pathCells();
    this.laneKeys = new Set(this.pathCellList.map(([col, row]) => `${col},${row}`));
    this.buffer = document.createElement('canvas');
    this.buffer.width = ART_WIDTH;
    this.buffer.height = ART_HEIGHT;
    const ctx = this.buffer.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    this.ctx = ctx;
    this.board = this.bakeBoard();
    this.head = this.bakePlayhead();
  }

  spawnEffect(event: SimEvent): void {
    if (event.kind === 'note') {
      this.flashes.set(`${event.col},${event.row}`, this.lastNow);
      return;
    }
    if (event.kind === 'shot') {
      const fromX = (event.col + 0.5) * ART_CELL;
      const fromY = (event.row + 0.5) * ART_CELL;
      const x = (event.x + 0.5) * ART_CELL;
      const y = (event.y + 0.5) * ART_CELL;
      if (event.towerType === 'kick') {
        this.effects.push({
          kind: 'kick',
          fromX,
          fromY,
          x,
          y,
          born: this.lastNow,
          life: 0.3,
          splash: event.splash,
        });
      } else if (event.towerType === 'hat') {
        this.effects.push({ kind: 'hat', fromX, fromY, x, y, born: this.lastNow, life: 0.12 });
      } else {
        this.effects.push({
          kind: 'bolt',
          points: boltPoints(fromX, fromY, x, y),
          born: this.lastNow,
          life: 0.2,
          color: PIXEL_COLORS.e,
        });
      }
      if (event.chordSize >= 2) {
        const multiplier =
          1 + CHORD_BONUS_PER_TOWER * (Math.min(event.chordSize, CHORD_MAX_TOWERS) - 1);
        this.label = {
          column: event.step,
          born: this.lastNow,
          life: 0.5,
          text: `x${multiplier.toFixed(2)}`,
        };
      }
      return;
    }
    if (event.kind === 'chain') {
      this.effects.push({
        kind: 'bolt',
        points: boltPoints(
          (event.fromX + 0.5) * ART_CELL,
          (event.fromY + 0.5) * ART_CELL,
          (event.x + 0.5) * ART_CELL,
          (event.y + 0.5) * ART_CELL,
        ),
        born: this.lastNow,
        life: 0.2,
        color: PIXEL_COLORS.c,
      });
      return;
    }
    if (event.kind === 'hit') {
      this.hitFlashes.set(event.enemyId, this.lastNow);
      return;
    }
    if (event.kind === 'leak') {
      this.leakAt = this.lastNow;
      return;
    }
    if (event.kind !== 'kill') return;
    if (this.calm) return;
    const colors = [PIXEL_COLORS['7'], PIXEL_COLORS.a, PIXEL_COLORS.g];
    for (let i = 0; i < 12; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 170;
      this.particles.push({
        x: (event.x + 0.5) * ART_CELL,
        y: (event.y + 0.5) * ART_CELL,
        vx: Math.cos(angle) * speed * PARTICLE_SPEED,
        vy: (Math.sin(angle) * speed - 60) * PARTICLE_SPEED,
        born: this.lastNow,
        life: 0.5 + Math.random() * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)] ?? PIXEL_COLORS['7'],
      });
    }
  }

  private bakeBoard(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = ART_WIDTH;
    canvas.height = ART_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    const base = ['#2d2830', '#2e2a2d', '#2e2c2b', '#2c2b30'];
    const high = ['#4a3634', '#4c3c2f', '#4c432f', '#47434a'];

    ctx.fillStyle = '#17161c';
    ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const x = col * ART_CELL;
        const y = row * ART_CELL;
        const group = Math.floor(col / 4);
        ctx.fillStyle = base[group] ?? base[0] ?? '#2d2830';
        ctx.fillRect(x + 1, y + 1, ART_CELL - 2, ART_CELL - 2);
        ctx.fillStyle = '#3a3540';
        ctx.fillRect(x + 1, y + 1, ART_CELL - 2, 1);
        ctx.fillStyle = '#211f27';
        ctx.fillRect(x + 1, y + ART_CELL - 2, ART_CELL - 2, 1);
        ctx.fillStyle = high[group] ?? high[0] ?? '#4a3634';
        ctx.fillRect(x + 3, y + 3, ART_CELL - 6, 1);
      }
    }

    for (let group = 1; group < 4; group += 1) {
      const x = group * 4 * ART_CELL - 1;
      ctx.fillStyle = '#55505e';
      for (let y = 0; y < ART_HEIGHT; y += 2) {
        ctx.fillRect(x + (y % 4 ? 1 : 0), y, 1, 1);
      }
    }

    for (const [col, row] of this.pathCellList) {
      const x = col * ART_CELL;
      const y = row * ART_CELL;
      for (let j = 0; j < ART_CELL; j += 1) {
        for (let i = 0; i < ART_CELL; i += 1) {
          ctx.fillStyle = bayer(x + i, y + j) < 0.5 ? '#5a5463' : '#544e5d';
          ctx.fillRect(x + i, y + j, 1, 1);
        }
      }
    }

    for (const [col, row] of this.pathCellList) {
      const x = col * ART_CELL;
      const y = row * ART_CELL;
      if (!this.laneKeys.has(`${col},${row - 1}`)) {
        ctx.fillStyle = '#14131a';
        ctx.fillRect(x, y, ART_CELL, 2);
        ctx.fillStyle = '#3f3a47';
        ctx.fillRect(x, y + 2, ART_CELL, 1);
      }
      if (!this.laneKeys.has(`${col},${row + 1}`)) {
        ctx.fillStyle = '#14131a';
        ctx.fillRect(x, y + ART_CELL - 1, ART_CELL, 1);
        ctx.fillStyle = '#726c7c';
        ctx.fillRect(x, y + ART_CELL - 2, ART_CELL, 1);
      }
      if (col > 0 && !this.laneKeys.has(`${col - 1},${row}`)) {
        ctx.fillStyle = '#14131a';
        ctx.fillRect(x, y, 2, ART_CELL);
      }
      if (col < GRID_COLS - 1 && !this.laneKeys.has(`${col + 1},${row}`)) {
        ctx.fillStyle = '#14131a';
        ctx.fillRect(x + ART_CELL - 1, y, 1, ART_CELL);
      }
    }

    const total = pathLength();
    for (let distance = 0.5; distance < total; distance += 1.5) {
      const from = pathPoint(distance);
      const next = pathPoint(distance + 0.1);
      const dx = Math.sign(next.x - from.x);
      const dy = Math.sign(next.y - from.y);
      const x = Math.trunc((from.x + 0.5) * ART_CELL);
      const y = Math.trunc((from.y + 0.5) * ART_CELL);
      ctx.fillStyle = '#736c7d';
      for (let i = 0; i < 3; i += 1) {
        ctx.fillRect(x - dx * i + dy * i - 1, y - dy * i + dx * i - 1, 2, 1);
        ctx.fillRect(x - dx * i - dy * i - 1, y - dy * i - dx * i - 1, 2, 1);
      }
    }

    ctx.fillStyle = '#14131a';
    ctx.fillRect(0, ART_CELL + 3, 13, 10);
    drawText(ctx, 'IN', 2, ART_CELL + 6, '#efe6d0');

    const exit = this.pathCellList[this.pathCellList.length - 1];
    const exitCol = exit?.[0] ?? GRID_COLS - 1;
    const exitRow = exit?.[1] ?? 6;
    const ox = exitCol * ART_CELL;
    const oy = exitRow * ART_CELL;
    ctx.fillStyle = '#14131a';
    ctx.fillRect(ox, oy + 1, ART_CELL, ART_CELL - 1);
    ctx.fillStyle = '#3a3743';
    ctx.fillRect(ox + 1, oy + 2, ART_CELL - 2, ART_CELL - 4);
    for (let j = 0; j < ART_CELL; j += 1) {
      for (let i = 0; i < ART_CELL; i += 1) {
        const distance = (i - 7.5) ** 2 + (j - 7.5) ** 2;
        if (distance < 30) {
          ctx.fillStyle = '#14131a';
          ctx.fillRect(ox + i, oy + j, 1, 1);
        }
        if (distance < 8) {
          ctx.fillStyle = '#6e6a78';
          ctx.fillRect(ox + i, oy + j, 1, 1);
        }
      }
    }

    return canvas;
  }

  private bakePlayhead(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = ART_CELL;
    canvas.height = ART_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable');
    ctx.fillStyle = '#fffaf0';
    for (let y = 0; y < ART_HEIGHT; y += 1) {
      for (let x = 0; x < ART_CELL; x += 1) {
        if (bayer(x, y) < 0.07) ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  private pl(x: number, y: number, color: string, alpha = 1): void {
    if (alpha < 1 && bayer(x, y) >= alpha) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.trunc(x), Math.trunc(y), 1, 1);
  }

  private lineP(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    alpha = 1,
  ): void {
    for (const [x, y] of linePoints(fromX, fromY, toX, toY)) this.pl(x, y, color, alpha);
  }

  private circP(centerX: number, centerY: number, radius: number, color: string, alpha = 1): void {
    for (const [x, y] of circlePoints(centerX, centerY, radius)) this.pl(x, y, color, alpha);
  }

  private textP(text: string, x: number, y: number, color: string, outline?: string): void {
    drawText(this.ctx, text, x, y, color, outline);
  }

  private strokeTile(col: number, row: number, color: string): void {
    const x = col * ART_CELL;
    const y = row * ART_CELL;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, ART_CELL, 1);
    this.ctx.fillRect(x, y + ART_CELL - 1, ART_CELL, 1);
    this.ctx.fillRect(x, y, 1, ART_CELL);
    this.ctx.fillRect(x + ART_CELL - 1, y, 1, ART_CELL);
  }

  private strokeInset(col: number, row: number, color: string): void {
    const x = col * ART_CELL + 1;
    const y = row * ART_CELL + 1;
    const size = ART_CELL - 2;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, size, 1);
    this.ctx.fillRect(x, y + size - 1, size, 1);
    this.ctx.fillRect(x, y, 1, size);
    this.ctx.fillRect(x + size - 1, y, 1, size);
  }

  private drawPlayhead(playhead: number): void {
    const x = playhead * ART_CELL;
    const color =
      STEP_GROUP_COLORS[Math.floor(playhead / 4) % STEP_GROUP_COLORS.length] ??
      STEP_GROUP_COLORS[0];
    this.ctx.drawImage(this.head, x, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, 0, 1, ART_HEIGHT);
    this.ctx.fillRect(x + ART_CELL - 1, 0, 1, ART_HEIGHT);
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (this.laneKeys.has(`${playhead},${row}`)) continue;
      this.ctx.fillRect(x + 3, row * ART_CELL + 3, 10, 1);
    }
  }

  private drawRanges(state: RenderState): void {
    if (!state.inspect) return;
    const tower = state.sim.towers.find(
      (candidate) =>
        candidate.col === state.inspect?.col && candidate.row === state.inspect?.row,
    );
    if (!tower) return;
    this.circP(
      (tower.col + 0.5) * ART_CELL,
      (tower.row + 0.5) * ART_CELL,
      towerStats(state.sim.rules, tower.type, tower.level).range * ART_CELL,
      PIXEL_COLORS['6'],
      0.55,
    );
  }

  private drawPreview(state: RenderState): void {
    const { sim, selected, hover } = state;
    if (!hover || !selected || selected === 'sell' || selected === 'upgrade') return;
    if (!sim.canPlace(hover.col, hover.row)) return;
    const x = hover.col * ART_CELL;
    const y = hover.row * ART_CELL;
    for (const [j, row] of SPRITES[selected][0].entries()) {
      [...row].forEach((character, i) => {
        if (character === '.') return;
        if (bayer(x + i, y + j) >= 0.5) return;
        this.pl(x + i, y + j, PIXEL_COLORS[character]);
      });
    }
    this.circP(
      (hover.col + 0.5) * ART_CELL,
      (hover.row + 0.5) * ART_CELL,
      TOWERS[selected].range * ART_CELL,
      PIXEL_COLORS['6'],
      0.55,
    );
  }

  private drawToolOutline(state: RenderState): void {
    const hover = state.hover;
    if ((state.selected !== 'sell' && state.selected !== 'upgrade') || !hover) return;
    const tower = state.sim.towers.find(
      (candidate) => candidate.col === hover.col && candidate.row === hover.row,
    );
    if (!tower) return;
    if (state.selected === 'upgrade') {
      if (upgradeCost(state.sim.rules, tower.type, tower.level) === null) return;
      this.strokeTile(hover.col, hover.row, PIXEL_COLORS.g);
      return;
    }
    this.strokeTile(hover.col, hover.row, PIXEL_COLORS.r);
  }

  private drawTowers(state: RenderState): void {
    const towers = [...state.sim.towers].sort((a, b) => a.row - b.row);
    for (const tower of towers) {
      const flashedAt = this.flashes.get(`${tower.col},${tower.row}`);
      const frame = flashedAt !== undefined && state.now - flashedAt < TOWER_FLASH ? 1 : 0;
      if (frame === 1) this.strokeInset(tower.col, tower.row, TOWER_OUTLINE[tower.type]);
      const frames = BAKED.get(tower.type);
      if (!frames) continue;
      const x = tower.col * ART_CELL;
      const y = tower.row * ART_CELL;
      this.ctx.drawImage(frames.normal[frame], x, y);
      const badge = BADGES.get(tower.level);
      if (badge) this.ctx.drawImage(badge, x, y);
    }
  }

  private drawEnemies(state: RenderState): void {
    const { sim, now, lastStepTime, stepDuration } = state;
    const maxProgress = pathLength();
    for (const [id, at] of this.hitFlashes) {
      if (now - at >= 0.06) this.hitFlashes.delete(id);
    }
    const rendered = sim.enemies.map((enemy) => {
      const speed = ENEMIES[enemy.type].speed;
      const elapsedSteps = stepDuration > 0 ? (now - lastStepTime) / stepDuration : 0;
      const progress = Math.max(
        0,
        Math.min(enemy.progress + speed * elapsedSteps, maxProgress),
      );
      const point = pathPoint(progress);
      return { enemy, x: (point.x + 0.5) * ART_CELL, y: (point.y + 0.5) * ART_CELL };
    });
    rendered.sort((a, b) => a.y - b.y);
    const frame = this.calm ? 0 : Math.floor(state.playhead / 2) % 2;

    for (const item of rendered) {
      const frames = BAKED.get(item.enemy.type);
      if (!frames) continue;
      const rows = SPRITES[item.enemy.type][frame];
      const width = rows[0]?.length ?? 0;
      const height = rows.length;
      const left = Math.round(item.x - width / 2);
      const top = Math.round(item.y - height / 2) - (frame === 1 ? 1 : 0);

      this.ctx.fillStyle = SHADOW;
      this.ctx.fillRect(left + 2, Math.round(item.y + height / 2) - 1, width - 4, 2);

      const flashedAt = this.hitFlashes.get(item.enemy.id);
      const flashLife = item.enemy.type === 'boss' ? 0.03 : 0.06;
      const flashing = flashedAt !== undefined && now - flashedAt < flashLife;
      this.ctx.drawImage(flashing ? frames.hit[frame] : frames.normal[frame], left, top);

      if (item.enemy.hp < item.enemy.maxHp) {
        const barWidth = Math.max(8, width);
        const barX = Math.round(left + (width - barWidth) / 2);
        const barY = top - 3;
        this.ctx.fillStyle = INK;
        this.ctx.fillRect(barX, barY, barWidth, 1);
        this.ctx.fillStyle = PIXEL_COLORS.r;
        const filled = Math.max(
          1,
          Math.round(barWidth * (item.enemy.hp / item.enemy.maxHp)),
        );
        this.ctx.fillRect(barX, barY, filled, 1);
      }
    }
  }

  private drawEffects(now: number): void {
    this.effects = this.effects.filter((effect) => now - effect.born < effect.life);
    for (const effect of this.effects) {
      const t = Math.max(0, Math.min(1, (now - effect.born) / effect.life));
      const alpha = 1 - t;
      if (effect.kind === 'kick') {
        const radius = t * effect.splash * ART_CELL + 1;
        this.circP(effect.x, effect.y, radius, PIXEL_COLORS.r, alpha + 0.2);
        if (t < 0.4) {
          this.lineP(effect.fromX, effect.fromY, effect.x, effect.y, PIXEL_COLORS['7']);
        }
      } else if (effect.kind === 'hat') {
        this.lineP(effect.fromX, effect.fromY, effect.x, effect.y, PIXEL_COLORS.a, alpha + 0.2);
        const x = Math.trunc(effect.x);
        const y = Math.trunc(effect.y);
        this.ctx.fillStyle = PIXEL_COLORS['6'];
        this.ctx.fillRect(x - 1, y, 3, 1);
        this.ctx.fillRect(x, y - 1, 1, 3);
      } else {
        for (let i = 1; i < effect.points.length; i += 1) {
          const previous = effect.points[i - 1];
          const point = effect.points[i];
          if (!previous || !point) continue;
          this.lineP(previous.x, previous.y, point.x, point.y, effect.color, alpha + 0.25);
        }
      }
    }
  }

  private drawParticles(now: number): void {
    this.particles = this.particles.filter((particle) => now - particle.born < particle.life);
    for (const particle of this.particles) {
      const age = Math.max(0, now - particle.born);
      const alpha = 1 - age / particle.life;
      const x = Math.trunc(particle.x + particle.vx * age);
      const y = Math.trunc(particle.y + particle.vy * age + PARTICLE_GRAVITY * age * age);
      if (bayer(x, y) >= alpha) continue;
      this.ctx.fillStyle = particle.color;
      this.ctx.fillRect(x, y, 2, 2);
    }
  }

  private drawLabel(now: number): void {
    if (!this.label) return;
    const age = now - this.label.born;
    if (age >= this.label.life) {
      this.label = null;
      return;
    }
    const t = Math.max(0, Math.min(1, age / this.label.life));
    if (t >= 0.75) return;
    const text = this.label.text;
    const width = text.length * 4 - 1;
    const centered = (this.label.column + 0.5) * ART_CELL - width / 2;
    const x = Math.round(Math.max(1, Math.min(ART_WIDTH - width - 1, centered)));
    const y = 4 - Math.round(3 * t);
    this.textP(text, x, y, PIXEL_COLORS['6'], PIXEL_COLORS['0']);
  }

  private drawLeak(now: number): void {
    if (now - this.leakAt >= 0.25) return;
    const exit = this.pathCellList[this.pathCellList.length - 1];
    if (exit) this.strokeTile(exit[0], exit[1], PIXEL_COLORS.r);
  }

  private present(): void {
    const clientWidth = this.canvas.clientWidth;
    if (clientWidth === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.ceil((clientWidth * ratio) / ART_WIDTH));
    const width = ART_WIDTH * scale;
    const height = ART_HEIGHT * scale;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.display.imageSmoothingEnabled = false;
    this.display.drawImage(this.buffer, 0, 0, width, height);
  }

  draw(state: RenderState): void {
    this.lastNow = state.now;
    this.ctx.drawImage(this.board, 0, 0);
    this.drawPlayhead(state.playhead);
    this.drawRanges(state);
    this.drawPreview(state);
    this.drawToolOutline(state);
    this.drawTowers(state);
    this.drawEnemies(state);
    this.drawEffects(state.now);
    this.drawParticles(state.now);
    this.drawLabel(state.now);
    this.drawLeak(state.now);
    this.present();
  }
}
