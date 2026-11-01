## Goal

Implement GitHub issue stansz/drumline#1. After the player starts wave 1, later waves start by themselves a short time after each wave clears, controlled by an Auto button that is on by default. Add a volume slider that sets the game's output level and is remembered between visits.

## Files to touch

- `src/config.ts`
- `src/sim.ts`
- `src/audio.ts`
- `src/main.ts`
- `src/style.css`
- `index.html`
- `README.md`
- `tests/audio.test.ts`
- `tests/auto-wave.test.ts` (new)
- `.handoff/report.md`

## Steps

### 1. `src/config.ts`

Add this line directly after `export const STEPS_PER_BAR = 16;`:

```ts
export const AUTO_WAVE_STEPS = 4 * STEPS_PER_BAR;
```

### 2. `src/sim.ts`

1. Add `AUTO_WAVE_STEPS` to the import from `./config`, keeping the list alphabetical.
2. Add a public field `autoWave: boolean;` after `enemies: Enemy[];`, and a private field `private nextWaveStep: number | null;` after `private waveStartPending: boolean;`.
3. In the constructor, set `this.autoWave = false;` and `this.nextWaveStep = null;`.
4. Add these two methods directly before `startWave()`:

```ts
  setAutoWave(on: boolean): void {
    this.autoWave = on;
    const waiting = on && this.phase === 'build' && this.wave > 0;
    this.nextWaveStep = waiting ? this.totalSteps + AUTO_WAVE_STEPS : null;
  }

  stepsUntilNextWave(): number | null {
    if (this.nextWaveStep === null) return null;
    return Math.max(0, this.nextWaveStep - this.totalSteps);
  }
```

5. In `startWave()`, add `this.nextWaveStep = null;` directly after `this.waveStartPending = true;`.
6. In `step()`, add this directly before `if (this.waveStartPending) {`:

```ts
    if (this.nextWaveStep !== null && this.totalSteps >= this.nextWaveStep) {
      this.startWave();
    }
```

7. In `step()`, in the `else` branch that sets `this.phase = 'build';`, add this line after it:

```ts
        this.nextWaveStep = this.autoWave ? this.totalSteps + 1 + AUTO_WAVE_STEPS : null;
```

### 3. `src/audio.ts`

1. Add these exports directly after the `SOFT_CLIP_POINTS` constant:

```ts
export const MAX_VOLUME = 100;

// Squared, because hearing is closer to logarithmic and a linear slider feels loud until the end.
export function volumeGain(percent: number): number {
  return (percent / MAX_VOLUME) ** 2;
}

export function parseVolume(stored: string | null): number {
  const value = stored === null || stored === '' ? Number.NaN : Number(stored);
  if (!Number.isFinite(value)) return MAX_VOLUME;
  return Math.max(0, Math.min(MAX_VOLUME, Math.round(value)));
}
```

2. Add `private readonly volume: GainNode;` to the class fields, directly after `private readonly trim: GainNode;`.
3. In the constructor, replace `this.analyser.connect(ctx.destination);` with:

```ts
    // After the limiter, so the slider changes the level without changing the mix.
    this.volume = ctx.createGain();
    this.analyser.connect(this.volume);
    this.volume.connect(ctx.destination);
```

4. Add this method directly after `setMuted`:

```ts
  setVolume(percent: number): void {
    this.volume.gain.setTargetAtTime(volumeGain(percent), this.ctx.currentTime, 0.01);
  }
```

Do not change `masterLevel`, `setMuted`, or anything else in the audio chain.

### 4. `index.html`

1. In `#hud`, add this directly after the `#theme` button:

```html
        <input id="volume" type="range" min="0" max="100" step="1" value="100" aria-label="Volume" title="Volume" />
```

2. In `#controls`, add this directly after the `#start-wave` button:

```html
        <button id="auto-wave" type="button">Auto: On</button>
```

### 5. `src/style.css`

Add this rule directly after the `#theme` rule:

```css
#volume {
  flex: 0 1 auto;
  width: clamp(56px, 14vw, 120px);
  min-width: 0;
  margin: 0;
  accent-color: var(--hat);
  cursor: pointer;
}
```

Add this rule directly after the `#start-wave` rule:

```css
#auto-wave {
  border-color: var(--synth);
  color: var(--synth);
}
```

### 6. `src/main.ts`

1. Add `import { Audio_, parseVolume } from './audio';` in place of the current `Audio_` import.
2. Add these element constants after `themeButton`:

```ts
const autoWaveButton = byId<HTMLButtonElement>('auto-wave');
const volumeSlider = byId<HTMLInputElement>('volume');
```

3. Add these constants after `THEME_KEY`:

```ts
const AUTO_WAVE_KEY = 'drumline-auto-wave';
const VOLUME_KEY = 'drumline-volume';
```

4. Add these variables after `let theme = loadTheme();`:

```ts
let autoWave = loadAutoWave();
let volume = loadVolume();
```

5. In `updateHud()`, add this at the end of the function:

```ts
  const stepsLeft = sim.stepsUntilNextWave();
  startWaveButton.textContent =
    stepsLeft === null
      ? 'Start wave'
      : `Next in ${Math.max(1, Math.ceil(stepsLeft * stepSeconds(currentBpm())))}s`;
```

6. In `startGame()`, add `audio.setVolume(volume);` directly after `audio.setMuted(muted);`.
7. Add these functions directly after `cycleTheme()`:

```ts
function loadAutoWave(): boolean {
  try {
    return localStorage.getItem(AUTO_WAVE_KEY) !== '0';
  } catch {
    return true;
  }
}

function updateAutoWaveButton(): void {
  autoWaveButton.textContent = autoWave ? 'Auto: On' : 'Auto: Off';
  autoWaveButton.classList.toggle('selected', autoWave);
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
```

8. In `resetRun()`, add `sim.setAutoWave(autoWave);` directly after `sim = new Sim(difficulty);`.
9. Add these listeners directly after `themeButton.addEventListener('click', cycleTheme);`:

```ts
autoWaveButton.addEventListener('click', toggleAutoWave);
volumeSlider.addEventListener('input', changeVolume);
```

10. In the `keydown` switch, add this case directly before `case 'f':`:

```ts
    case 'a':
      toggleAutoWave();
      break;
```

11. At the bottom of the file, add these two lines directly after `updateSpeedButton();`:

```ts
updateAutoWaveButton();
volumeSlider.value = String(volume);
```

### 7. `README.md`

1. Replace the sentence that begins `Build before a wave, then press **Start wave**.` with: `Build, then press **Start wave** to send wave 1. With **Auto** on, each later wave starts 4 bars after the last one clears, and pressing the button during the countdown sends it early. Turn **Auto** off to start every wave yourself.`
2. In the Controls list, add this line directly after the `**Space**` line: `- **A** turn automatic waves on or off`
3. Replace the `**Space**` line with: `- **Space** start the next wave, or send it early during the countdown`
4. After the sentence that begins `The on-screen buttons provide the same actions.`, add on the same line: `The slider beside the theme button sets the volume. Volume and **Auto** are remembered between visits.`

Reflow nothing else.

### 8. `tests/audio.test.ts`

Add `parseVolume` and `volumeGain` to the import from `../src/audio`, then add this at the end of the file:

```ts
describe('volumeGain', () => {
  it('passes full volume through unchanged and silences zero', () => {
    expect(volumeGain(100)).toBe(1);
    expect(volumeGain(0)).toBe(0);
  });

  it('follows a squared curve', () => {
    expect(volumeGain(50)).toBeCloseTo(0.25, 5);
  });
});

describe('parseVolume', () => {
  it('uses full volume when nothing usable is stored', () => {
    expect(parseVolume(null)).toBe(100);
    expect(parseVolume('')).toBe(100);
    expect(parseVolume('loud')).toBe(100);
  });

  it('keeps stored values within range', () => {
    expect(parseVolume('40')).toBe(40);
    expect(parseVolume('0')).toBe(0);
    expect(parseVolume('140')).toBe(100);
    expect(parseVolume('-5')).toBe(0);
  });
});
```

### 9. `tests/auto-wave.test.ts`

Create this file exactly:

```ts
import { describe, expect, it } from 'vitest';
import { AUTO_WAVE_STEPS } from '../src/config';
import { Sim } from '../src/sim';

function autoSim(): Sim {
  const sim = new Sim();
  sim.lives = 1000000;
  sim.setAutoWave(true);
  return sim;
}

function clearWave(sim: Sim): void {
  sim.startWave();
  while (sim.phase === 'wave') sim.step();
}

function runSteps(sim: Sim, count: number): void {
  for (let i = 0; i < count; i += 1) sim.step();
}

describe('automatic waves', () => {
  it('is off by default, so later waves wait for the player', () => {
    const sim = new Sim();
    sim.lives = 1000000;
    clearWave(sim);
    runSteps(sim, AUTO_WAVE_STEPS * 3);
    expect(sim.wave).toBe(1);
    expect(sim.phase).toBe('build');
    expect(sim.stepsUntilNextWave()).toBeNull();
  });

  it('leaves the first wave to the player', () => {
    const sim = autoSim();
    runSteps(sim, AUTO_WAVE_STEPS * 3);
    expect(sim.wave).toBe(0);
    expect(sim.stepsUntilNextWave()).toBeNull();
  });

  it('starts the next wave after the countdown', () => {
    const sim = autoSim();
    clearWave(sim);
    expect(sim.stepsUntilNextWave()).toBe(AUTO_WAVE_STEPS);
    runSteps(sim, AUTO_WAVE_STEPS);
    expect(sim.wave).toBe(1);
    expect(sim.stepsUntilNextWave()).toBe(0);
    const events = sim.step();
    expect(sim.wave).toBe(2);
    expect(sim.phase).toBe('wave');
    expect(sim.stepsUntilNextWave()).toBeNull();
    expect(events).toContainEqual({ kind: 'waveStart', wave: 2 });
  });

  it('lets the player send the next wave early', () => {
    const sim = autoSim();
    clearWave(sim);
    runSteps(sim, 3);
    expect(sim.startWave()).toBe(true);
    expect(sim.wave).toBe(2);
    expect(sim.stepsUntilNextWave()).toBeNull();
  });

  it('cancels the countdown when turned off', () => {
    const sim = autoSim();
    clearWave(sim);
    sim.setAutoWave(false);
    expect(sim.stepsUntilNextWave()).toBeNull();
    runSteps(sim, AUTO_WAVE_STEPS * 2);
    expect(sim.wave).toBe(1);
  });

  it('starts a countdown when turned on between waves', () => {
    const sim = new Sim();
    sim.lives = 1000000;
    clearWave(sim);
    sim.setAutoWave(true);
    expect(sim.stepsUntilNextWave()).toBe(AUTO_WAVE_STEPS);
  });

  it('stops after the last wave', () => {
    const sim = autoSim();
    sim.wave = sim.waves.length - 1;
    clearWave(sim);
    expect(sim.phase).toBe('won');
    expect(sim.stepsUntilNextWave()).toBeNull();
  });
});
```

## Acceptance

Run these from the repository root.

- `git grep -n AUTO_WAVE_STEPS -- src/config.ts src/sim.ts` prints at least 4 lines.
- `git grep -n setVolume -- src/audio.ts src/main.ts` prints at least 2 lines.
- `git grep -n auto-wave -- index.html src/style.css src/main.ts` prints at least 3 lines.
- `git grep --untracked -n stepsUntilNextWave -- tests/auto-wave.test.ts` prints at least 8 lines.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not change wave budgets, enemy stats, tower stats, difficulty values, or `tests/balance.test.ts`.
- `new Sim()` must keep `autoWave` false so bots and balance tests behave as they do today.
- Do not use `package-lock.json` changes or add dependencies.

## Out of scope

- Overlapping waves, where a new wave starts before the last one clears.
- A pause button.
- Keyboard shortcuts for volume.
- Changing how Mute or Restart behave, beyond the unmute in `changeVolume()`.
- Telemetry and balance changes.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
