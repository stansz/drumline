import { Audio_, parseVolume } from './audio';
import {
  BPM,
  CHORD_BONUS_PER_TOWER,
  DIFFICULTIES,
  KILL_VOICE_LIMIT,
  SPEED_BPMS,
  GRID_COLS,
  GRID_ROWS,
  SELL_REFUND,
  TOWERS,
  TOWER_INFO,
  stepSeconds,
  towerStats,
  upgradeCost,
  type Difficulty,
  type DifficultyId,
} from './config';
import { intensity, layerLevels, pickVoices } from './music';
import { Renderer, drawIcon, drawLogo } from './render';
import { Scheduler } from './scheduler';
import { Sim, firesThisStep, type SimEvent, type Tower, type TowerType } from './sim';
import type { SpriteName } from './sprites';
import { DEFAULT_THEME, nextTheme, themeById, type Theme } from './themes';
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
const infoEl = byId<HTMLParagraphElement>('info');
const overlay = byId<HTMLDivElement>('overlay');
const overlayText = byId<HTMLDivElement>('overlay-text');
const overlayDetail = byId<HTMLDivElement>('overlay-detail');
const stepsEl = byId<HTMLDivElement>('steps');
const kickButton = byId<HTMLButtonElement>('tool-kick');
const hatButton = byId<HTMLButtonElement>('tool-hat');
const synthButton = byId<HTMLButtonElement>('tool-synth');
const sellButton = byId<HTMLButtonElement>('tool-sell');
const upgradeButton = byId<HTMLButtonElement>('tool-upgrade');
const upgradeCostEl = upgradeButton.querySelector<HTMLElement>('.cost');
const startWaveButton = byId<HTMLButtonElement>('start-wave');
const speedButton = byId<HTMLButtonElement>('speed');
const muteButton = byId<HTMLButtonElement>('mute');
const restartButton = byId<HTMLButtonElement>('restart');
const easyButton = byId<HTMLButtonElement>('mode-easy');
const hardButton = byId<HTMLButtonElement>('mode-hard');
const themeButton = byId<HTMLButtonElement>('theme');
const autoWaveButton = byId<HTMLButtonElement>('auto-wave');
const volumeSlider = byId<HTMLInputElement>('volume');

const THEME_KEY = 'drumline-theme';
const AUTO_WAVE_KEY = 'drumline-auto-wave';
const VOLUME_KEY = 'drumline-volume';
const renderer = new Renderer(canvas);

let sim = new Sim();
let scheduler: Scheduler | null = null;
let audio: Audio_ | null = null;
let audioContext: AudioContext | null = null;
let started = false;
let speedIndex = 0;
let muted = false;
let selected: TowerType | 'sell' | 'upgrade' | null = null;
let hover: { col: number; row: number } | null = null;
let inspect: { col: number; row: number } | null = null;
let queued: Array<{ at: number; event: SimEvent }> = [];
let musicStep = 0;
let stepMarks: Array<{ at: number; step: number }> = [];
let playhead = 0;
let theme = loadTheme();
let autoWave = loadAutoWave();
let volume = loadVolume();
const stepLeds: HTMLSpanElement[] = [];
let litStep = -1;

window.__drumline = { sim, scheduler, audio };

function updateHud(): void {
  moneyEl.textContent = `$${sim.money}`;
  livesEl.textContent = String(sim.lives);
  waveEl.textContent = `${String(sim.wave).padStart(2, '0')}/${sim.waves.length}`;
  startWaveButton.disabled = sim.phase !== 'build';
  const stepsLeft = sim.stepsUntilNextWave();
  startWaveButton.textContent =
    stepsLeft === null
      ? 'Start wave'
      : `Next ${Math.max(1, Math.ceil(stepsLeft * stepSeconds(currentBpm())))}s`;
}

function towerAt(cell: { col: number; row: number } | null) {
  if (!cell) return null;
  return sim.towers.find((tower) => tower.col === cell.col && tower.row === cell.row) ?? null;
}

function updateStepHints(): void {
  const tower = towerAt(hover) ?? towerAt(inspect);
  let previewing: TowerType | null = null;
  if (!tower && hover) {
    if (selected === 'kick' || selected === 'hat' || selected === 'synth') {
      if (sim.canPlace(hover.col, hover.row)) previewing = selected;
    }
  }
  const type: TowerType | null = tower ? tower.type : previewing;
  const col = tower ? tower.col : (hover?.col ?? 0);
  stepLeds.forEach((led, step) => {
    led.classList.toggle('fires', type !== null && firesThisStep(type, col, step));
  });
}

function towerText(tower: Tower): string {
  const info = TOWER_INFO[tower.type];
  const stats = towerStats(sim.rules, tower.type, tower.level);
  const cost = upgradeCost(sim.rules, tower.type, tower.level);
  const next =
    cost === null
      ? 'Max level'
      : `Next: level ${tower.level + 1}, $${cost}, ${info.upgrades[tower.level - 1]}`;
  return `${info.name} · Level ${tower.level} · ${info.role} · ${stats.damage} damage · range ${stats.range} · ${next}`;
}

function updateInfo(): void {
  updateStepHints();
  const tower = towerAt(hover) ?? towerAt(inspect);
  if (upgradeCostEl) {
    const cost = tower ? upgradeCost(sim.rules, tower.type, tower.level) : null;
    upgradeCostEl.textContent = tower ? (cost === null ? 'MAX' : `$${cost}`) : 'LV+';
  }
  if (tower) {
    infoEl.textContent = towerText(tower);
    return;
  }
  if (selected === 'upgrade') {
    infoEl.textContent = 'Click a tower to buy its next level.';
    return;
  }
  if (selected && selected !== 'sell') {
    const info = TOWER_INFO[selected];
    const stats = TOWERS[selected];
    infoEl.textContent = `${info.name} · $${stats.cost} · ${info.role} · ${stats.damage} damage · range ${stats.range} — ${info.description}`;
    return;
  }
  if (selected === 'sell') {
    infoEl.textContent = `Click a tower to sell it for ${Math.round(SELL_REFUND * 100)}% of what you spent on it.`;
    return;
  }
  infoEl.textContent = `${sim.difficulty.name} mode. Towers fire when the playhead reaches their column. Towers firing together form a chord: +${CHORD_BONUS_PER_TOWER * 100}% damage each.`;
}

function updateSelection(): void {
  kickButton.classList.toggle('selected', selected === 'kick');
  hatButton.classList.toggle('selected', selected === 'hat');
  synthButton.classList.toggle('selected', selected === 'synth');
  sellButton.classList.toggle('selected', selected === 'sell');
  upgradeButton.classList.toggle('selected', selected === 'upgrade');
}

function selectTool(tool: TowerType | 'sell' | 'upgrade' | null): void {
  selected = tool;
  updateSelection();
  updateInfo();
}

function showStartOverlay(): void {
  overlayText.textContent = 'Your defense plays the music.';
  overlayDetail.textContent = '';
  overlay.classList.remove('hidden', 'passive');
}

function hideOverlay(): void {
  overlay.classList.add('hidden');
  overlay.classList.remove('passive');
}

function showEndOverlay(message: string, detail: string): void {
  overlayText.textContent = message;
  overlayDetail.textContent = detail;
  overlay.classList.remove('hidden');
  overlay.classList.add('passive');
}

type NoteEvent = Extract<SimEvent, { kind: 'note' }>;

function onStep(time: number, duration: number): void {
  if (!audio) return;
  const step = sim.stepIndex;
  const i = intensity(sim.towers.length, sim.wave);
  const levels = layerLevels(i);
  audio.playMusicStep(musicStep, time, duration, levels);
  if (sim.towers.length === 0 && step % 4 === 0) {
    audio.playMetronome(time, step === 0);
  }
  audio.setTempo(duration);
  stepMarks.push({ at: time, step });
  const events = sim.step();
  const notes = events.filter((event): event is NoteEvent => event.kind === 'note');
  const voices = pickVoices(notes);
  for (const voice of voices) {
    audio.playNote(voice.towerType, voice.row, time, voice.hit, voices.length);
  }
  let kills = 0;
  for (const event of events) {
    if (event.kind === 'kill' && kills < KILL_VOICE_LIMIT) {
      audio.playKill(time);
      kills += 1;
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
    const ctx = new AudioContext({ latencyHint: 'playback' });
    audioContext = ctx;
    await ctx.resume();
    audio = new Audio_(ctx);
    audio.setTheme(theme);
    audio.setMuted(muted);
    audio.setVolume(volume);
    scheduler = new Scheduler(ctx, onStep);
    scheduler.bpm = currentBpm();
    scheduler.start();
    window.__drumline = { sim, scheduler, audio };
    hideOverlay();
  } catch (error) {
    started = false;
    console.error(error);
    showStartOverlay();
  }
}

function currentBpm(): number {
  return SPEED_BPMS[speedIndex] ?? BPM;
}

function updateSpeedButton(): void {
  speedButton.textContent = `${currentBpm()} BPM`;
  speedButton.classList.toggle('selected', speedIndex > 0);
}

function cycleSpeed(): void {
  speedIndex = (speedIndex + 1) % SPEED_BPMS.length;
  if (scheduler) scheduler.bpm = currentBpm();
  updateSpeedButton();
}

function toggleMute(): void {
  muted = !muted;
  audio?.setMuted(muted);
  muteButton.classList.toggle('selected', muted);
}

function loadTheme(): Theme {
  try {
    return themeById(localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function updateThemeButton(): void {
  themeButton.textContent = `♪ ${theme.name}`;
}

function cycleTheme(): void {
  theme = nextTheme(theme);
  audio?.setTheme(theme);
  updateThemeButton();
  try {
    localStorage.setItem(THEME_KEY, theme.id);
  } catch {
    // The choice just lasts for this visit when storage is unavailable.
  }
}

function loadAutoWave(): boolean {
  try {
    return localStorage.getItem(AUTO_WAVE_KEY) !== '0';
  } catch {
    return true;
  }
}

function updateAutoWaveButton(): void {
  autoWaveButton.classList.toggle('selected', autoWave);
  autoWaveButton.setAttribute('aria-pressed', String(autoWave));
}

function toggleAutoWave(): void {
  autoWave = !autoWave;
  sim.setAutoWave(autoWave);
  updateAutoWaveButton();
  updateHud();
  try {
    localStorage.setItem(AUTO_WAVE_KEY, autoWave ? '1' : '0');
  } catch {
    // The choice just lasts for this visit when storage is unavailable.
  }
}

function loadVolume(): number {
  try {
    return parseVolume(localStorage.getItem(VOLUME_KEY));
  } catch {
    return parseVolume(null);
  }
}

function changeVolume(): void {
  volume = parseVolume(volumeSlider.value);
  audio?.setVolume(volume);
  if (muted) toggleMute();
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // The choice just lasts for this visit when storage is unavailable.
  }
}

function resetRun(difficulty: Difficulty): void {
  sim = new Sim(difficulty);
  sim.setAutoWave(autoWave);
  queued = [];
  stepMarks = [];
  hover = null;
  inspect = null;
  selected = null;
  speedIndex = 0;
  muted = false;
  if (scheduler) scheduler.bpm = BPM;
  audio?.setMuted(false);
  updateSelection();
  updateSpeedButton();
  muteButton.classList.remove('selected');
  updateHud();
  updateInfo();
  window.__drumline = { sim, scheduler, audio };
}

function restart(): void {
  resetRun(sim.difficulty);
  showStartOverlay();
}

function chooseDifficulty(id: DifficultyId): void {
  resetRun(DIFFICULTIES[id]);
  if (started) {
    hideOverlay();
  } else {
    void startGame();
  }
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
    if (inspect && !towerAt(inspect)) inspect = null;
  } else if (selected === 'upgrade') {
    sim.upgradeTower(cell.col, cell.row);
    inspect = towerAt(cell) ? { ...cell } : null;
  } else if (selected) {
    if (towerAt(cell)) {
      inspect = { ...cell };
    } else {
      if (sim.placeTower(selected, cell.col, cell.row)) inspect = null;
    }
  } else {
    inspect = towerAt(cell) ? { ...cell } : null;
  }
  updateHud();
  updateInfo();
});

canvas.addEventListener('pointermove', (event) => {
  hover = cellAt(event);
  updateInfo();
});

canvas.addEventListener('pointerleave', () => {
  hover = null;
  updateInfo();
});

easyButton.addEventListener('click', () => chooseDifficulty('easy'));
hardButton.addEventListener('click', () => chooseDifficulty('hard'));

kickButton.addEventListener('click', () => selectTool('kick'));
hatButton.addEventListener('click', () => selectTool('hat'));
synthButton.addEventListener('click', () => selectTool('synth'));
sellButton.addEventListener('click', () => selectTool('sell'));
upgradeButton.addEventListener('click', () => selectTool('upgrade'));

startWaveButton.addEventListener('click', () => {
  sim.startWave();
  updateHud();
});

speedButton.addEventListener('click', cycleSpeed);
muteButton.addEventListener('click', toggleMute);
restartButton.addEventListener('click', restart);
themeButton.addEventListener('click', cycleTheme);
autoWaveButton.addEventListener('click', toggleAutoWave);
volumeSlider.addEventListener('input', changeVolume);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (!overlay.classList.contains('hidden') && !overlay.classList.contains('passive')) {
    const key = event.key.toLowerCase();
    if (key === 'e') chooseDifficulty('easy');
    if (key === 'h') chooseDifficulty('hard');
    if (key === 't') cycleTheme();
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    sim.startWave();
    updateHud();
    return;
  }
  if (event.key === 'Escape') {
    selectTool(null);
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
    case '5':
      selectTool('upgrade');
      break;
    case 'a':
      toggleAutoWave();
      break;
    case 'f':
      cycleSpeed();
      break;
    case 'm':
      toggleMute();
      break;
    case 'r':
      restart();
      break;
    case 't':
      cycleTheme();
      break;
    default:
      break;
  }
});

function frame(): void {
  // Sound reaches the speakers after the audio clock, so draw at the time being heard.
  const latency = audioContext ? audioContext.outputLatency || audioContext.baseLatency || 0 : 0;
  const now = audioContext ? Math.max(0, audioContext.currentTime - latency) : 0;
  while (stepMarks.length > 0) {
    const mark = stepMarks[0];
    if (!mark || mark.at > now) break;
    stepMarks.shift();
    playhead = mark.step;
  }
  if (playhead !== litStep) {
    stepLeds[litStep]?.classList.remove('on');
    stepLeds[playhead]?.classList.add('on');
    litStep = playhead;
  }
  while (queued.length > 0) {
    const item = queued[0];
    if (!item || item.at > now) break;
    queued.shift();
    renderer.spawnEffect(item.event);
    if (item.event.kind === 'won') {
      showEndOverlay('You won', `All ${sim.waves.length} waves cleared`);
    } else if (item.event.kind === 'lost') {
      showEndOverlay('Game over', `Reached wave ${sim.wave}/${sim.waves.length}`);
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
    inspect,
  });
  requestAnimationFrame(frame);
}

const costButtons: Array<[HTMLButtonElement, TowerType]> = [
  [kickButton, 'kick'],
  [hatButton, 'hat'],
  [synthButton, 'synth'],
];
for (const [button, type] of costButtons) {
  const cost = button.querySelector<HTMLElement>('.cost');
  if (cost) cost.textContent = `$${TOWERS[type].cost}`;
}

document.querySelectorAll<HTMLCanvasElement>('canvas.logo').forEach((logo) => {
  drawLogo(logo);
});
document.querySelectorAll<HTMLCanvasElement>('canvas[data-sprite]').forEach((icon) => {
  drawIcon(icon, icon.dataset.sprite as SpriteName);
});

const sellCost = sellButton.querySelector<HTMLElement>('.cost');
if (sellCost) sellCost.textContent = `${Math.round(SELL_REFUND * 100)}%`;

const modeButtons: Array<[HTMLButtonElement, Difficulty]> = [
  [easyButton, DIFFICULTIES.easy],
  [hardButton, DIFFICULTIES.hard],
];
for (const [button, difficulty] of modeButtons) {
  const detail = button.querySelector('small');
  if (detail) detail.textContent = `${difficulty.startLives} lives · $${difficulty.startMoney}`;
}

for (let i = 0; i < 16; i += 1) {
  const step = document.createElement('span');
  step.className = `g${Math.floor(i / 4)}`;
  const led = document.createElement('i');
  const number = document.createElement('em');
  number.textContent = i % 4 === 0 ? String(i + 1) : '';
  step.append(led, number);
  stepsEl.append(step);
  stepLeds.push(step);
}

updateHud();
updateSelection();
updateInfo();
updateThemeButton();
updateSpeedButton();
updateAutoWaveButton();
volumeSlider.value = String(volume);
requestAnimationFrame(frame);
