# Plan: stop audio breakup in the late game

## Goal

On Firefox for Android, audio skips and glitches from about wave 15. Measurements show the audio graph's CPU cost scales with tower notes, and the note scheduler has too little headroom on a slow CPU.

Make four changes: limit tower voices per step, widen the scheduler's lookahead, ask for a larger audio buffer, and stop adding needless automation events. Game rules do not change. Every tower still fires and deals damage. Only the number of sounds played is limited.

## Files to touch

Create:

- `tests/voices.test.ts`

Modify:

- `src/config.ts`
- `src/music.ts`
- `src/scheduler.ts`
- `src/audio.ts`
- `src/main.ts`
- `tests/scheduler.test.ts`
- `tests/loudness.ts`
- `docs/references.md`

## Steps

### 1. Add the limits

In `src/config.ts`, add this directly after the `CHORD_MAX_TOWERS` line:

```ts

// How many of each sound can start on one step, because each one costs audio CPU.
// Towers past the limit still fire and deal damage.
export const TOWER_VOICE_LIMITS: Record<TowerType, number> = { kick: 2, hat: 2, synth: 3 };
export const KILL_VOICE_LIMIT = 2;
```

### 2. Add `pickVoices`

In `src/music.ts`, replace the first line with:

```ts
import { MUSIC_CHORDS, STEPS_PER_BAR, TOWER_VOICE_LIMITS } from './config';
import type { TowerType } from './sim';
```

Add this at the end of `src/music.ts`:

```ts
// Chooses which notes to sound on a step. Notes that hit come first, and the rest of each
// instrument's limit is spread across its notes, so a big chord keeps its range of pitches.
export function pickVoices<T extends { towerType: TowerType; hit: boolean }>(
  notes: readonly T[],
): T[] {
  const voices: T[] = [];
  for (const type of ['kick', 'hat', 'synth'] as const) {
    const group = notes.filter((note) => note.towerType === type);
    const hits = group.filter((note) => note.hit);
    const limit = TOWER_VOICE_LIMITS[type];
    const pool =
      hits.length >= limit ? hits : [...hits, ...group.filter((note) => !note.hit)];
    const count = Math.min(limit, pool.length);
    for (let i = 0; i < count; i += 1) {
      const note = pool[Math.floor((i * pool.length) / count)];
      if (note) voices.push(note);
    }
  }
  return voices;
}
```

### 3. Widen the scheduler's lookahead

In `src/scheduler.ts`:

- Add this after the import:

```ts

// How far ahead steps are scheduled. Slow phones can stall for this long without a late note.
const LOOKAHEAD_SECONDS = 0.15;
```

- Replace all three uses of `0.06`, in `start()` and `tick()`, with `LOOKAHEAD_SECONDS`.
- Do not change the `0.2` in `tick()`.

### 4. Stop needless automation events

In `src/audio.ts`:

- Add these two fields after `private muted = false;`:

```ts
  private lastDuckTime = -1;
  private lastStepDuration = 0;
```

- In `playNote`, replace the two `this.musicBus.gain` lines with:

```ts
      if (time !== this.lastDuckTime) {
        this.lastDuckTime = time;
        this.musicBus.gain.setValueAtTime(1 - MIX.duckAmount, time);
        this.musicBus.gain.linearRampToValueAtTime(1, time + MIX.duckRelease);
      }
```

- Replace `setTempo` with:

```ts
  setTempo(stepDuration: number): void {
    if (stepDuration === this.lastStepDuration) return;
    this.lastStepDuration = stepDuration;
    this.delay.delayTime.setTargetAtTime(stepDuration * 3, this.ctx.currentTime, 0.05);
  }
```

### 5. Use the limits and a larger buffer in `src/main.ts`

- Add `KILL_VOICE_LIMIT` to the `./config` import.
- Change the `./music` import to `import { intensity, layerLevels, pickVoices } from './music';`.
- Replace `const ctx = new AudioContext();` with `const ctx = new AudioContext({ latencyHint: 'playback' });`.
- Add this above `onStep`:

```ts
type NoteEvent = Extract<SimEvent, { kind: 'note' }>;
```

- In `onStep`, replace everything from `const events = sim.step();` through the closing brace of its `for` loop with:

```ts
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
```

- Replace the first line of `frame()` with:

```ts
  // Sound reaches the speakers after the audio clock, so draw at the time being heard.
  const latency = audioContext ? audioContext.outputLatency || audioContext.baseLatency || 0 : 0;
  const now = audioContext ? Math.max(0, audioContext.currentTime - latency) : 0;
```

### 6. Keep the loudness page true to the game

In `tests/loudness.ts`:

- Change the imports so `KILL_VOICE_LIMIT` comes from `../src/config`, and `pickVoices` from `../src/music`.
- Replace the two loops inside `renderBoard`'s `for (let musicStep ...)` loop with:

```ts
    const notes = sim
      .step()
      .filter((event) => event.kind === 'note');
    const voices = pickVoices(notes);
    for (const voice of voices) {
      audio.playNote(voice.towerType, voice.row, time, true, voices.length);
    }
    for (let kill = 0; kill < Math.min(KILLS_PER_STEP, KILL_VOICE_LIMIT); kill += 1) {
      audio.playKill(time);
    }
```

Keep the `audio.playMusicStep` line above them.

### 7. Add the tests

Create `tests/voices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TOWER_VOICE_LIMITS } from '../src/config';
import { pickVoices } from '../src/music';
import type { TowerType } from '../src/sim';

function notes(type: TowerType, count: number, hit = true) {
  return Array.from({ length: count }, (_, row) => ({ towerType: type, row, hit }));
}

describe('pickVoices', () => {
  it('keeps every note under the limits', () => {
    const chord = [...notes('kick', 2), ...notes('hat', 1), ...notes('synth', 3)];
    expect(pickVoices(chord)).toHaveLength(6);
  });

  it('limits each instrument on its own', () => {
    const chord = [...notes('kick', 8), ...notes('hat', 8), ...notes('synth', 8)];
    const voices = pickVoices(chord);
    for (const type of ['kick', 'hat', 'synth'] as const) {
      expect(voices.filter((voice) => voice.towerType === type)).toHaveLength(
        TOWER_VOICE_LIMITS[type],
      );
    }
  });

  it('never returns a note twice', () => {
    const voices = pickVoices(notes('synth', 8));
    expect(new Set(voices).size).toBe(voices.length);
  });

  it('spreads a big chord across its pitches', () => {
    const rows = pickVoices(notes('synth', 9)).map((voice) => voice.row);
    expect(rows).toEqual([0, 3, 6]);
  });

  it('prefers notes that hit', () => {
    const voices = pickVoices([...notes('hat', 4, false), ...notes('hat', 2, true)]);
    expect(voices.every((voice) => voice.hit)).toBe(true);
  });

  it('handles an empty step', () => {
    expect(pickVoices([])).toEqual([]);
  });
});
```

In `tests/scheduler.test.ts`, add this test after the last `it`, inside `describe`:

```ts
  it('stays ahead of the audio clock through 120 ms stalls', () => {
    const ctx = { currentTime: 0 };
    let late = 0;
    let steps = 0;
    const scheduler = new Scheduler(ctx, (time) => {
      steps += 1;
      if (time < ctx.currentTime) late += 1;
    });
    scheduler.start();

    for (let i = 0; i < 40; i += 1) {
      ctx.currentTime += 0.12;
      vi.advanceTimersByTime(25);
    }

    scheduler.stop();

    expect(steps).toBeGreaterThan(30);
    expect(late).toBe(0);
  });
```

### 8. Update the docs

In `docs/references.md`:

- In **How a step works**, change step 1 to end `slightly before the step is due to play. That lead is \`LOOKAHEAD_SECONDS\`.`
- Add this section before `## Saved settings`:

```md
## Audio load

Each sound costs audio CPU, and phones run out long before desktops. On one desktop core, a 75-tower
board took about 70% before voice limits and 28% after, and Techno went from 102% to 42%.

- `pickVoices` caps each instrument per step with `TOWER_VOICE_LIMITS`. Towers past the limit still
  fire and deal damage. `playNote` gets the number of voices played, not the chord size, so a capped
  chord stays about as loud.
- Don't add automation to long-lived `AudioParam`s on every step. Those events add up over a run.
- The game uses `latencyHint: 'playback'`, because nothing depends on tapping in time. `frame()`
  subtracts the output latency, so the board matches what's heard.
```

## Acceptance

Run these from the repository root.

- `git grep -n "0\.06" -- src/scheduler.ts` prints nothing.
- `git grep -c "LOOKAHEAD_SECONDS" -- src/scheduler.ts` prints `src/scheduler.ts:4`.
- `git grep -n "latencyHint: 'playback'" -- src/main.ts` prints 1 line.
- `git grep -n "pickVoices" -- src/main.ts tests/loudness.ts` prints at least 4 lines.
- `git grep -n "event.chordSize" -- src/main.ts` prints nothing.
- `git diff --quiet -- src/sim.ts src/waves.ts src/themes.ts src/render.ts tests/balance.test.ts package.json package-lock.json` exits 0.

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
- Do not add dependencies.
- Do not change `src/sim.ts`, game rules, balance, tower damage, chord damage, or any theme.
- Do not edit `tests/loudness-baseline.ts`.
- Keep Neon's `space.trim` at 1.

## Out of scope

- Removing reverb, delay, the limiter, or oversampling.
- Fewer music layers.
- Automatic quality levels and on-screen diagnostics.
- Changes to the visuals.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
