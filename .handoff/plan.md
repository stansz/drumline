## Goal

Add five selectable music themes to Drumline: Neon (the current sound, unchanged), Chiptune, Lo-fi, Techno, and Funk. A Theme button and the T key cycle themes at any time, and the choice is remembered between visits. Tempo, tower firing, and game balance do not change.

## Files to touch

- `src/themes.ts` (new)
- `src/audio.ts`
- `src/music.ts`
- `src/main.ts`
- `src/style.css`
- `index.html`
- `README.md`
- `tests/themes.test.ts` (new)
- `tests/music.test.ts`
- `tests/loudness.ts`
- `.handoff/report.md`

## Steps

### 1. Create `src/themes.ts`

Write this file exactly:

```ts
import { ARP_STEPS, BASS_STEPS, MUSIC_CHORDS } from './config';

export type DrumPart = 'kick' | 'snare' | 'hat';

export const DRUM_PARTS: DrumPart[] = ['kick', 'snare', 'hat'];

export const BACKING_DRUMS: Record<DrumPart, number> = {
  kick: 0.22,
  snare: 0.1,
  hat: 0.04,
};

export interface Theme {
  id: string;
  name: string;
  chords: ReadonlyArray<{ name: string; pad: number[]; bass: number }>;
  bassSteps: number[];
  arpSteps: number[];
  levels: { pad: number; bass: number; arp: number };
  pad: { wave: OscillatorType; cutoffHz: number };
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  kick: { wave: OscillatorType; baseHz: number; sweep: number; decay: number };
  hat: { highpassHz: number; decay: number };
  synth: {
    waves: [OscillatorType, OscillatorType];
    cutoffHz: number;
    decay: number;
    scale: number[];
  };
  drums: Record<DrumPart, number[]>;
}

const NEON: Theme = {
  id: 'neon',
  name: 'Neon',
  chords: MUSIC_CHORDS,
  bassSteps: BASS_STEPS,
  arpSteps: ARP_STEPS,
  levels: { pad: 1, bass: 1, arp: 1 },
  pad: { wave: 'sawtooth', cutoffHz: 900 },
  bassWave: 'triangle',
  arpWave: 'triangle',
  kick: { wave: 'sine', baseHz: 52, sweep: 3.2, decay: 0.3 },
  hat: { highpassHz: 5600, decay: 0.05 },
  synth: {
    waves: ['sawtooth', 'triangle'],
    cutoffHz: 900,
    decay: 0.24,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
  drums: { kick: [], snare: [], hat: [] },
};

const CHIPTUNE: Theme = {
  id: 'chiptune',
  name: 'Chiptune',
  chords: [
    { name: 'C', pad: [60, 64, 67, 72], bass: 48 },
    { name: 'G', pad: [59, 62, 67, 71], bass: 43 },
    { name: 'Am', pad: [57, 60, 64, 69], bass: 45 },
    { name: 'F', pad: [57, 60, 65, 69], bass: 41 },
  ],
  bassSteps: [0, 2, 4, 6, 8, 10, 12, 14],
  arpSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  levels: { pad: 0.6, bass: 0.7, arp: 0.8 },
  pad: { wave: 'square', cutoffHz: 2200 },
  bassWave: 'square',
  arpWave: 'square',
  kick: { wave: 'square', baseHz: 60, sweep: 4, decay: 0.16 },
  hat: { highpassHz: 7000, decay: 0.03 },
  synth: {
    waves: ['square', 'square'],
    cutoffHz: 3000,
    decay: 0.18,
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
  },
  drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
};

const LOFI: Theme = {
  id: 'lofi',
  name: 'Lo-fi',
  chords: [
    { name: 'Dm9', pad: [53, 57, 60, 64], bass: 38 },
    { name: 'G13', pad: [53, 59, 64, 69], bass: 43 },
    { name: 'Cmaj9', pad: [52, 59, 62, 67], bass: 48 },
    { name: 'Am9', pad: [55, 60, 64, 71], bass: 45 },
  ],
  bassSteps: [0, 7, 10],
  arpSteps: [2, 7, 10, 15],
  levels: { pad: 1, bass: 1, arp: 1 },
  pad: { wave: 'triangle', cutoffHz: 700 },
  bassWave: 'sine',
  arpWave: 'sine',
  kick: { wave: 'sine', baseHz: 48, sweep: 2.4, decay: 0.26 },
  hat: { highpassHz: 4200, decay: 0.04 },
  synth: {
    waves: ['triangle', 'sine'],
    cutoffHz: 1200,
    decay: 0.3,
    scale: [55, 57, 60, 62, 64, 67, 69, 72],
  },
  drums: { kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 10, 14] },
};

const TECHNO: Theme = {
  id: 'techno',
  name: 'Techno',
  chords: [
    { name: 'Am', pad: [57, 60, 64], bass: 45 },
    { name: 'Am', pad: [57, 60, 64], bass: 45 },
    { name: 'F', pad: [57, 60, 65], bass: 41 },
    { name: 'Em', pad: [55, 59, 64], bass: 40 },
  ],
  bassSteps: [2, 6, 10, 14],
  arpSteps: [0, 3, 6, 8, 11, 14],
  levels: { pad: 0.8, bass: 0.7, arp: 0.8 },
  pad: { wave: 'sawtooth', cutoffHz: 600 },
  bassWave: 'sawtooth',
  arpWave: 'square',
  kick: { wave: 'sine', baseHz: 46, sweep: 4.5, decay: 0.22 },
  hat: { highpassHz: 8200, decay: 0.06 },
  synth: {
    waves: ['sawtooth', 'sawtooth'],
    cutoffHz: 1400,
    decay: 0.2,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
  drums: { kick: [0, 4, 8, 12], snare: [12], hat: [2, 6, 10, 14] },
};

const FUNK: Theme = {
  id: 'funk',
  name: 'Funk',
  chords: [
    { name: 'E9', pad: [56, 62, 66, 71], bass: 40 },
    { name: 'A13', pad: [55, 61, 66, 71], bass: 45 },
    { name: 'E9', pad: [56, 62, 66, 71], bass: 40 },
    { name: 'B9', pad: [57, 61, 63, 66], bass: 47 },
  ],
  bassSteps: [0, 3, 6, 8, 10, 13],
  arpSteps: [0, 3, 6, 10, 12, 14],
  levels: { pad: 0.8, bass: 0.6, arp: 0.7 },
  pad: { wave: 'sawtooth', cutoffHz: 1400 },
  bassWave: 'square',
  arpWave: 'sawtooth',
  kick: { wave: 'sine', baseHz: 56, sweep: 3, decay: 0.2 },
  hat: { highpassHz: 6400, decay: 0.04 },
  synth: {
    waves: ['sawtooth', 'square'],
    cutoffHz: 2000,
    decay: 0.16,
    scale: [55, 57, 59, 62, 64, 67, 69, 71],
  },
  drums: { kick: [0, 3, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
};

export const DEFAULT_THEME = NEON;

export const THEMES: Theme[] = [NEON, CHIPTUNE, LOFI, TECHNO, FUNK];

export function themeById(id: string | null): Theme {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

export function nextTheme(current: Theme): Theme {
  const index = THEMES.indexOf(current);
  return THEMES[(index + 1) % THEMES.length] ?? DEFAULT_THEME;
}
```

### 2. Update `src/music.ts`

- Change `chordForStep` to `chordForStep(musicStep: number, chords: ReadonlyArray<(typeof MUSIC_CHORDS)[number]> = MUSIC_CHORDS): (typeof MUSIC_CHORDS)[number]`. It uses `chords` in place of `MUSIC_CHORDS` for the index and length, and falls back to `MUSIC_CHORDS[0]!`.
- Change `arpNote` to `arpNote(musicStep: number, chords: ReadonlyArray<(typeof MUSIC_CHORDS)[number]> = MUSIC_CHORDS): number`, calling `chordForStep(musicStep, chords)`.

### 3. Update `src/audio.ts`

- Delete `PENTATONIC` and `pentatonicFrequency`.
- Add `import { BACKING_DRUMS, DEFAULT_THEME, type DrumPart, type Theme } from './themes';`.
- Add the field `private theme: Theme = DEFAULT_THEME;`.
- Add the public method `setTheme(theme: Theme): void { this.theme = theme; }`.
- `playKick`: set `osc.type = this.theme.kick.wave`. Set `base = this.theme.kick.baseHz + (7 - clampRow(row)) * 4`. Replace `base * 3.2` with `base * this.theme.kick.sweep`. Replace the end time `time + 0.3` with `time + this.theme.kick.decay`, and the stop time `time + 0.32` with `time + this.theme.kick.decay + 0.02`.
- `playHat`: set the highpass to `this.theme.hat.highpassHz + (7 - clampRow(row)) * 450`. Replace the end time `time + 0.05` with `time + this.theme.hat.decay`, and the stop time `time + 0.06` with `time + this.theme.hat.decay + 0.01`.
- `playSynth`: set `const frequency = midiToHz(this.theme.synth.scale[7 - clampRow(row)] ?? 57);`. Set `saw.type = this.theme.synth.waves[0]` and `triangle.type = this.theme.synth.waves[1]`. Set the filter frequency to `this.theme.synth.cutoffHz + (7 - clampRow(row)) * 160`. Replace the end time `time + 0.24` with `time + this.theme.synth.decay`, and both stop times `time + 0.26` with `time + this.theme.synth.decay + 0.02`.
- `playKill`: replace the frequency line with `const scale = this.theme.synth.scale;` and `const frequency = midiToHz(scale[Math.floor(Math.random() * scale.length)] ?? 69);`.
- `playPad`: set `filter.frequency.value = this.theme.pad.cutoffHz`. Set `perNote = (MIX.pad * this.theme.levels.pad * level) / notes.length`. Set `osc.type = this.theme.pad.wave`.
- `playBass`: set `osc.type = this.theme.bassWave`. Use `MIX.bass * this.theme.levels.bass * level` as the peak.
- `playArp`: set `osc.type = this.theme.arpWave`. Use `MIX.arp * this.theme.levels.arp * level` as the peak.
- Add this method after `playArp`:

```ts
  playBackingDrum(part: DrumPart, time: number, level: number): void {
    const peak = Math.max(BACKING_DRUMS[part] * level, 0.0001);
    const gain = this.ctx.createGain();
    gain.connect(this.musicBus);
    if (part === 'kick') {
      const osc = this.ctx.createOscillator();
      const base = this.theme.kick.baseHz;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * 2, time);
      osc.frequency.exponentialRampToValueAtTime(base, time + 0.08);
      gain.gain.setValueAtTime(peak, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + 0.18);
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = part === 'snare' ? 'bandpass' : 'highpass';
    filter.frequency.value = part === 'snare' ? 1800 : this.theme.hat.highpassHz;
    const decay = part === 'snare' ? 0.12 : 0.03;
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter);
    filter.connect(gain);
    source.start(time);
    source.stop(time + decay + 0.01);
  }
```

### 4. Update `index.html`

Inside `<header id="hud">`, after `<span id="wave">Wave 0/5</span>`, add:

```html
<button id="theme" type="button" aria-label="Change music theme">♪ Neon</button>
```

### 5. Update `src/style.css`

Add this rule directly after the `#wave` rule:

```css
#theme {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--grid);
  border-radius: 8px;
  background: var(--path);
  color: var(--enemy);
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap;
}
```

### 6. Update `src/main.ts`

- Remove `ARP_STEPS` and `BASS_STEPS` from the `./config` import.
- Add `import { DEFAULT_THEME, DRUM_PARTS, nextTheme, themeById, type Theme } from './themes';`.
- Add `const themeButton = byId<HTMLButtonElement>('theme');` after `restartButton`.
- Add `const THEME_KEY = 'drumline-theme';` directly before `const renderer`.
- Add `let theme = loadTheme();` after `let playhead = 0;`.
- Add these functions directly after `toggleMute`:

```ts
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
```

- In `onStep`:
  - Replace `chordForStep(musicStep).pad` with `chordForStep(musicStep, theme.chords).pad`.
  - Replace `BASS_STEPS.includes(local)` with `theme.bassSteps.includes(local)`.
  - Replace `chordForStep(musicStep).bass` with `chordForStep(musicStep, theme.chords).bass`.
  - Replace `ARP_STEPS.includes(local)` with `theme.arpSteps.includes(local)`.
  - Replace `arpNote(musicStep)` with `arpNote(musicStep, theme.chords)`.
  - Directly after the arp `if` block, add:

```ts
  for (const part of DRUM_PARTS) {
    if (theme.drums[part].includes(local)) audio.playBackingDrum(part, time, levels.pad);
  }
```

- In `startGame`, add `audio.setTheme(theme);` directly after `audio = new Audio_(ctx);`.
- Add `themeButton.addEventListener('click', cycleTheme);` directly after the `restartButton` listener.
- In the keydown `switch`, add a `case 't':` that calls `cycleTheme();` and then `break;`, directly after `case 'r':`.
- Add `updateThemeButton();` directly after the `updateInfo();` call at the bottom of the file.

Do not change `restart`. Restarting keeps the current theme.

### 7. Update `README.md`

- In **How to play**, after the paragraph ending "refund 70% of its cost.", add this paragraph: `Press **Theme** to switch between the Neon, Chiptune, Lo-fi, Techno, and Funk soundtracks at any time. Themes change the music and tower sounds, never the tempo or the game.`
- In **Controls**, after the **M** line, add `- **T** change the music theme`.

### 8. Create `tests/themes.test.ts`

Write this file exactly:

```ts
import { describe, expect, it } from 'vitest';
import { ARP_STEPS, BASS_STEPS, MIX, MUSIC_CHORDS, STEPS_PER_BAR } from '../src/config';
import {
  BACKING_DRUMS,
  DEFAULT_THEME,
  DRUM_PARTS,
  THEMES,
  nextTheme,
  themeById,
} from '../src/themes';

describe('themes', () => {
  it('keeps the default theme identical to the original music', () => {
    expect(DEFAULT_THEME.chords).toEqual(MUSIC_CHORDS);
    expect(DEFAULT_THEME.bassSteps).toEqual(BASS_STEPS);
    expect(DEFAULT_THEME.arpSteps).toEqual(ARP_STEPS);
    expect(DEFAULT_THEME.levels).toEqual({ pad: 1, bass: 1, arp: 1 });
    for (const part of DRUM_PARTS) {
      expect(DEFAULT_THEME.drums[part]).toHaveLength(0);
    }
  });

  it('gives every theme a unique id and four chords with bass notes', () => {
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
    for (const theme of THEMES) {
      expect(theme.chords).toHaveLength(4);
      for (const chord of theme.chords) {
        expect(chord.pad.length).toBeGreaterThanOrEqual(3);
        expect(chord.bass).toBeLessThan(Math.min(...chord.pad));
      }
    }
  });

  it('places every pattern inside one bar', () => {
    for (const theme of THEMES) {
      const steps = [
        ...theme.bassSteps,
        ...theme.arpSteps,
        ...theme.drums.kick,
        ...theme.drums.snare,
        ...theme.drums.hat,
      ];
      for (const step of steps) {
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThan(STEPS_PER_BAR);
      }
    }
  });

  it('gives every row a rising synth note', () => {
    for (const theme of THEMES) {
      expect(theme.synth.scale).toHaveLength(8);
      for (let i = 1; i < theme.synth.scale.length; i += 1) {
        expect(theme.synth.scale[i] ?? 0).toBeGreaterThan(theme.synth.scale[i - 1] ?? 0);
      }
    }
  });

  it('keeps backing drums quieter than the matching towers', () => {
    expect(BACKING_DRUMS.kick).toBeLessThan(MIX.kick / 2);
    expect(BACKING_DRUMS.hat).toBeLessThan(MIX.hat / 2);
    expect(BACKING_DRUMS.snare).toBeLessThan(MIX.synth);
  });

  it('cycles through every theme and wraps to the first', () => {
    let theme = DEFAULT_THEME;
    const seen = [theme.id];
    for (let i = 1; i < THEMES.length; i += 1) {
      theme = nextTheme(theme);
      seen.push(theme.id);
    }
    expect(seen).toEqual(THEMES.map((item) => item.id));
    expect(nextTheme(theme)).toBe(DEFAULT_THEME);
  });

  it('finds a saved theme and falls back on an unknown one', () => {
    expect(themeById('techno').name).toBe('Techno');
    expect(themeById('missing')).toBe(DEFAULT_THEME);
    expect(themeById(null)).toBe(DEFAULT_THEME);
  });
});
```

### 9. Update `tests/music.test.ts`

Add this test inside `describe('chordForStep', ...)`, after the existing test:

```ts
  it('uses the chords it is given', () => {
    const chords = [
      { name: 'One', pad: [60, 64, 67], bass: 48 },
      { name: 'Two', pad: [62, 65, 69], bass: 50 },
    ];
    expect(chordForStep(0, chords).name).toBe('One');
    expect(chordForStep(STEPS_PER_BAR, chords).name).toBe('Two');
    expect(chordForStep(STEPS_PER_BAR * 2, chords).name).toBe('One');
  });
```

### 10. Update `tests/loudness.ts`

- Remove `ARP_STEPS` and `BASS_STEPS` from the `../src/config` import.
- Add `import { DEFAULT_THEME, DRUM_PARTS, THEMES, type Theme } from '../src/themes';`.
- Add `theme: string;` to the `Result` interface, after `board: string;`.
- Add `const THEME_BOARDS = ['spread 12', 'kick line', 'full board'];` after `BOARDS`.
- Change the signature to `renderBoard(name: string, board: Board, bpm: number, theme: Theme): Promise<Result>`.
- Add `audio.setTheme(theme);` directly after the `new Audio_(...)` line.
- In the music loop, use `chordForStep(musicStep, theme.chords)`, `theme.bassSteps`, `theme.arpSteps`, and `arpNote(musicStep, theme.chords)`.
- Directly after the arp `if` block, add:

```ts
    for (const part of DRUM_PARTS) {
      if (theme.drums[part].includes(local)) audio.playBackingDrum(part, time, levels.pad);
    }
```

- Add `theme: theme.name,` to the returned object, after `board: name,`.
- Replace the body of `runLoudness` with:

```ts
  const results: Result[] = [];
  for (const [name, board] of Object.entries(BOARDS)) {
    for (const bpm of [BPM, FAST_BPM]) {
      results.push(await renderBoard(name, board, bpm, DEFAULT_THEME));
    }
  }
  for (const theme of THEMES) {
    if (theme === DEFAULT_THEME) continue;
    for (const name of THEME_BOARDS) {
      for (const bpm of [BPM, FAST_BPM]) {
        results.push(await renderBoard(name, BOARDS[name] ?? [], bpm, theme));
      }
    }
  }
  return results;
```

## Acceptance

Run each from the repository root:

- `npx tsc --noEmit` exits 0.
- `git diff --name-only -- src/config.ts src/sim.ts src/scheduler.ts src/render.ts` prints nothing.
- `git status --porcelain -- src/themes.ts tests/themes.test.ts` prints two lines, each starting with `??`.
- `git grep -c "id=\"theme\"" -- index.html` prints `index.html:1`.
- `git grep -c "playBackingDrum" -- src/main.ts` prints `src/main.ts:1`.
- `git grep -c "PENTATONIC" -- src/audio.ts` prints nothing and exits 1.

Verifier only:

- `npm test` exits 0 and reports 7 test files and 37 tests passed.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it. Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies.
- Match the surrounding code style.
- Do not add a tempo or BPM setting to themes.

## Out of scope

- `src/config.ts`, including tower, enemy, wave, and mix values.
- Tower firing, chord bonuses, tempo, and all game balance.
- Any other UI change.
- Changing theme automatically during a wave.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and do not improvise a different approach.
