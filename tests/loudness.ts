// Browser-only harness: Web Audio is unavailable in vitest. With `npm run dev` running, open
// /tests/loudness.html. It renders each board through the real audio chain, faster than real time.
import { Audio_ } from '../src/audio';
import {
  GRID_COLS,
  GRID_ROWS,
  STEPS_PER_BAR,
  TOWERS,
  stepSeconds,
} from '../src/config';
import { intensity, layerLevels } from '../src/music';
import { Sim, type TowerType } from '../src/sim';
import { DEFAULT_THEME, THEMES, type Theme } from '../src/themes';

const SAMPLE_RATE = 48000;
const BARS = 8;
const TAIL_SECONDS = 3;
const CLIP_LEVEL = 1;
const KILLS_PER_STEP = 3;
const TOWER_TYPES: TowerType[] = ['kick', 'hat', 'synth'];

type Board = Array<[TowerType, number, number]>;

interface Result {
  board: string;
  theme: string;
  bpm: number;
  towers: number;
  peak: number;
  peakDb: number;
  clippedSamples: number;
  rmsDb: number;
}

function column(type: TowerType, col: number, count: number): Board {
  const rows = [0, 2, 3, 5, 7];
  return rows.slice(0, count).map((row) => [type, col, row]);
}

function fullBoard(type?: TowerType): Board {
  const probe = new Sim();
  const board: Board = [];
  for (let col = 0; col < GRID_COLS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (!probe.canPlace(col, row)) continue;
      board.push([type ?? TOWER_TYPES[board.length % TOWER_TYPES.length] ?? 'kick', col, row]);
    }
  }
  return board;
}

// One kick per column: chords never attenuate these, and the tails overlap.
function kickLine(): Board {
  const seen = new Set<number>();
  return fullBoard('kick').filter(([, col]) => {
    if (seen.has(col)) return false;
    seen.add(col);
    return true;
  });
}

const BOARDS: Record<string, Board> = {
  solo: [['kick', 0, 0]],
  'spread 12': Array.from({ length: 12 }, (_, i): [TowerType, number, number] => [
    TOWER_TYPES[i % TOWER_TYPES.length] ?? 'kick',
    i,
    i % 2 === 0 ? 0 : 7,
  ]),
  'stack 12': [...column('kick', 0, 5), ...column('hat', 4, 5), ...column('hat', 8, 2)],
  'kick stacks 12': [...column('kick', 0, 4), ...column('kick', 4, 4), ...column('kick', 8, 4)],
  'synth stacks 12': [...column('synth', 0, 4), ...column('synth', 4, 4), ...column('synth', 8, 4)],
  'kick line': kickLine(),
  'full board': fullBoard(),
  'all kicks': fullBoard('kick'),
};

const THEME_BOARDS = ['spread 12', 'kick line', 'full board'];
const LOUDNESS_BPMS = [120, 240];

function seedRandom(seed: number): () => void {
  const original = Math.random;
  let state = seed;
  Math.random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return () => {
    Math.random = original;
  };
}

async function renderBoard(
  name: string,
  board: Board,
  bpm: number,
  theme: Theme,
): Promise<Result> {
  const restoreRandom = seedRandom(1);
  const duration = stepSeconds(bpm);
  const seconds = duration * STEPS_PER_BAR * BARS + TAIL_SECONDS;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const audio = new Audio_(ctx as unknown as AudioContext);
  audio.setTheme(theme);
  audio.setTempo(duration);

  const sim = new Sim();
  sim.money = board.reduce((total, [type]) => total + TOWERS[type].cost, 0);
  for (const [type, col, row] of board) {
    if (!sim.placeTower(type, col, row)) throw new Error(`${name}: cannot place at ${col},${row}`);
  }

  const levels = layerLevels(intensity(sim.towers.length, 5));
  for (let musicStep = 0; musicStep < STEPS_PER_BAR * BARS; musicStep += 1) {
    const time = musicStep * duration;
    audio.playMusicStep(musicStep, time, duration, levels);
    for (const event of sim.step()) {
      if (event.kind === 'note') {
        audio.playNote(event.towerType, event.row, time, true, event.chordSize);
      }
    }
    for (let kill = 0; kill < KILLS_PER_STEP; kill += 1) {
      audio.playKill(time);
    }
  }

  const rendered = await ctx.startRendering();
  restoreRandom();

  let peak = 0;
  let clippedSamples = 0;
  let energy = 0;
  for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
    for (const sample of rendered.getChannelData(channel)) {
      const level = Math.abs(sample);
      if (level > peak) peak = level;
      if (level >= CLIP_LEVEL) clippedSamples += 1;
      energy += sample * sample;
    }
  }
  const rms = Math.sqrt(energy / (rendered.length * rendered.numberOfChannels));
  return {
    board: name,
    theme: theme.name,
    bpm,
    towers: board.length,
    peak: Number(peak.toFixed(3)),
    peakDb: Number((20 * Math.log10(peak)).toFixed(1)),
    clippedSamples,
    rmsDb: Number((20 * Math.log10(rms)).toFixed(1)),
  };
}

export async function runLoudness(): Promise<Result[]> {
  const results: Result[] = [];
  for (const [name, board] of Object.entries(BOARDS)) {
    for (const bpm of LOUDNESS_BPMS) {
      results.push(await renderBoard(name, board, bpm, DEFAULT_THEME));
    }
  }
  for (const theme of THEMES) {
    if (theme === DEFAULT_THEME) continue;
    for (const name of THEME_BOARDS) {
      for (const bpm of LOUDNESS_BPMS) {
        results.push(await renderBoard(name, BOARDS[name] ?? [], bpm, theme));
      }
    }
  }
  return results;
}

const output = document.querySelector('#results');
void runLoudness().then((results) => {
  if (output) output.textContent = JSON.stringify(results, null, 1);
  document.title = results.every((result) => result.clippedSamples === 0) ? 'PASS' : 'FAIL';
});
