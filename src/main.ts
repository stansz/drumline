import { Audio_ } from './audio';
import {
  ARP_STEPS,
  BASS_STEPS,
  BPM,
  FAST_BPM,
  GRID_COLS,
  GRID_ROWS,
  STEPS_PER_BAR,
  WAVES,
  stepSeconds,
} from './config';
import { arpNote, chordForStep, intensity, layerLevels } from './music';
import { Renderer } from './render';
import { Scheduler } from './scheduler';
import { Sim, type SimEvent, type TowerType } from './sim';
import './style.css';

declare global {
  interface Window {
    __drumline: { sim: Sim; scheduler: Scheduler | null; audio: Audio_ | null };
  }
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const canvas = byId<HTMLCanvasElement>('game');
const moneyEl = byId<HTMLSpanElement>('money');
const livesEl = byId<HTMLSpanElement>('lives');
const waveEl = byId<HTMLSpanElement>('wave');
const overlay = byId<HTMLDivElement>('overlay');
const overlayText = byId<HTMLDivElement>('overlay-text');
const kickButton = byId<HTMLButtonElement>('tool-kick');
const hatButton = byId<HTMLButtonElement>('tool-hat');
const synthButton = byId<HTMLButtonElement>('tool-synth');
const sellButton = byId<HTMLButtonElement>('tool-sell');
const startWaveButton = byId<HTMLButtonElement>('start-wave');
const fastButton = byId<HTMLButtonElement>('fast');
const muteButton = byId<HTMLButtonElement>('mute');
const restartButton = byId<HTMLButtonElement>('restart');

const renderer = new Renderer(canvas);

let sim = new Sim();
let scheduler: Scheduler | null = null;
let audio: Audio_ | null = null;
let audioContext: AudioContext | null = null;
let started = false;
let fast = false;
let muted = false;
let selected: TowerType | 'sell' | null = null;
let hover: { col: number; row: number } | null = null;
let queued: Array<{ at: number; event: SimEvent }> = [];
let musicStep = 0;
let stepMarks: Array<{ at: number; step: number }> = [];
let playhead = 0;

window.__drumline = { sim, scheduler, audio };

function updateHud(): void {
  moneyEl.textContent = `$${sim.money}`;
  livesEl.textContent = `${sim.lives} lives`;
  waveEl.textContent = `Wave ${sim.wave}/${WAVES.length}`;
  startWaveButton.disabled = sim.phase !== 'build';
}

function updateSelection(): void {
  kickButton.classList.toggle('selected', selected === 'kick');
  hatButton.classList.toggle('selected', selected === 'hat');
  synthButton.classList.toggle('selected', selected === 'synth');
  sellButton.classList.toggle('selected', selected === 'sell');
}

function selectTool(tool: TowerType | 'sell' | null): void {
  selected = tool;
  updateSelection();
}

function showStartOverlay(): void {
  overlayText.textContent = 'Click to start';
  overlay.classList.remove('hidden', 'passive');
}

function hideOverlay(): void {
  overlay.classList.add('hidden');
  overlay.classList.remove('passive');
}

function showEndOverlay(message: string): void {
  overlayText.textContent = message;
  overlay.classList.remove('hidden');
  overlay.classList.add('passive');
}

function onStep(time: number, duration: number): void {
  if (!audio) return;
  const step = sim.stepIndex;
  const i = intensity(sim.towers.length, sim.wave);
  const levels = layerLevels(i);
  const local = musicStep % STEPS_PER_BAR;
  if (local === 0) {
    audio.playPad(chordForStep(musicStep).pad, time, duration * STEPS_PER_BAR, levels.pad);
  }
  if (levels.bass > 0 && BASS_STEPS.includes(local)) {
    audio.playBass(chordForStep(musicStep).bass, time, levels.bass);
  }
  if (levels.arp > 0 && ARP_STEPS.includes(local)) {
    audio.playArp(arpNote(musicStep), time, levels.arp);
  }
  if (sim.towers.length === 0 && step % 4 === 0) {
    audio.playMetronome(time, step === 0);
  }
  audio.setTempo(duration);
  stepMarks.push({ at: time, step });
  const events = sim.step();
  for (const event of events) {
    if (event.kind === 'note') {
      audio.playNote(event.towerType, event.row, time, event.hit, event.chordSize);
    } else if (event.kind === 'kill') {
      audio.playKill(time);
    } else if (event.kind === 'leak') {
      audio.playLeak(time);
    }
    queued.push({ at: time, event });
  }
  musicStep += 1;
  updateHud();
}

async function startGame(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const ctx = new AudioContext();
    audioContext = ctx;
    await ctx.resume();
    audio = new Audio_(ctx);
    audio.setMuted(muted);
    scheduler = new Scheduler(ctx, onStep);
    scheduler.bpm = fast ? FAST_BPM : BPM;
    scheduler.start();
    window.__drumline = { sim, scheduler, audio };
    hideOverlay();
  } catch (error) {
    started = false;
    console.error(error);
    showStartOverlay();
  }
}

function toggleFast(): void {
  fast = !fast;
  if (scheduler) scheduler.bpm = fast ? FAST_BPM : BPM;
  fastButton.classList.toggle('selected', fast);
}

function toggleMute(): void {
  muted = !muted;
  audio?.setMuted(muted);
  muteButton.classList.toggle('selected', muted);
}

function restart(): void {
  sim = new Sim();
  queued = [];
  stepMarks = [];
  hover = null;
  selected = null;
  fast = false;
  muted = false;
  if (scheduler) scheduler.bpm = BPM;
  audio?.setMuted(false);
  updateSelection();
  fastButton.classList.remove('selected');
  muteButton.classList.remove('selected');
  updateHud();
  if (started) {
    hideOverlay();
  } else {
    showStartOverlay();
  }
  window.__drumline = { sim, scheduler, audio };
}

function cellAt(event: PointerEvent | MouseEvent): { col: number; row: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_COLS);
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_ROWS);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

canvas.addEventListener('click', (event) => {
  if (sim.phase === 'won' || sim.phase === 'lost') return;
  const cell = cellAt(event);
  if (!cell) return;
  if (selected === 'sell') {
    sim.sellTower(cell.col, cell.row);
  } else if (selected) {
    sim.placeTower(selected, cell.col, cell.row);
  }
  updateHud();
});

canvas.addEventListener('pointermove', (event) => {
  hover = cellAt(event);
});

canvas.addEventListener('pointerleave', () => {
  hover = null;
});

overlay.addEventListener('click', () => {
  if (!started) void startGame();
});

kickButton.addEventListener('click', () => selectTool('kick'));
hatButton.addEventListener('click', () => selectTool('hat'));
synthButton.addEventListener('click', () => selectTool('synth'));
sellButton.addEventListener('click', () => selectTool('sell'));

startWaveButton.addEventListener('click', () => {
  sim.startWave();
  updateHud();
});

fastButton.addEventListener('click', toggleFast);
muteButton.addEventListener('click', toggleMute);
restartButton.addEventListener('click', restart);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space') {
    event.preventDefault();
    sim.startWave();
    updateHud();
    return;
  }
  switch (event.key.toLowerCase()) {
    case '1':
      selectTool('kick');
      break;
    case '2':
      selectTool('hat');
      break;
    case '3':
      selectTool('synth');
      break;
    case '4':
      selectTool('sell');
      break;
    case 'f':
      toggleFast();
      break;
    case 'm':
      toggleMute();
      break;
    case 'r':
      restart();
      break;
    default:
      break;
  }
});

function frame(): void {
  const now = audioContext ? audioContext.currentTime : 0;
  while (stepMarks.length > 0) {
    const mark = stepMarks[0];
    if (!mark || mark.at > now) break;
    stepMarks.shift();
    playhead = mark.step;
  }
  while (queued.length > 0) {
    const item = queued[0];
    if (!item || item.at > now) break;
    queued.shift();
    renderer.spawnEffect(item.event);
    if (item.event.kind === 'won') {
      showEndOverlay('You won');
    } else if (item.event.kind === 'lost') {
      showEndOverlay('Game over');
    }
  }
  renderer.draw({
    sim,
    now,
    lastStepTime: scheduler ? scheduler.lastStepTime : 0,
    stepDuration: scheduler ? scheduler.stepDuration : stepSeconds(BPM),
    playhead,
    selected,
    hover,
  });
  requestAnimationFrame(frame);
}

updateHud();
updateSelection();
requestAnimationFrame(frame);
