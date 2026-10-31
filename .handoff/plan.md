## Goal

Add a background music layer that grows with the player's defense, make the audio mix clean and spacious, and fix three timing and rendering defects in the existing Drumline prototype. All sound stays synthesized in code.

## Files to touch

Relative to the repo root `/Users/sz/Documents/code/drumline`:

- `src/music.ts` (new)
- `src/config.ts`
- `src/audio.ts`
- `src/main.ts`
- `src/render.ts`
- `src/scheduler.ts`
- `tests/music.test.ts` (new)
- `tests/scheduler.test.ts` (new)
- `.handoff/report.md`

## Steps

### 1. `src/config.ts`

Add these exports. Do not change any existing value.

- `MUSIC_CHORDS`, four entries played one per bar, as MIDI note numbers:
  - `{ name: 'Am7', pad: [57, 60, 64, 67], bass: 45 }`
  - `{ name: 'Fmaj7', pad: [53, 57, 60, 64], bass: 41 }`
  - `{ name: 'Cadd9', pad: [55, 60, 62, 64], bass: 48 }`
  - `{ name: 'Gsus', pad: [55, 60, 62, 67], bass: 43 }`
- `BASS_STEPS = [0, 6, 10]`
- `ARP_STEPS = [0, 2, 4, 6, 8, 10, 12, 14]`
- `MIX = { pad: 0.16, bass: 0.3, arp: 0.08, kick: 0.85, hat: 0.2, synth: 0.2, kill: 0.08, metronome: 0.04, reverbSend: 0.3, delaySend: 0.22, delayFeedback: 0.35, duckAmount: 0.45, duckRelease: 0.18 }`

### 2. `src/music.ts`

Pure module. It must not import DOM or audio code, and must not use `Math.random` or `Date`. Export:

- `midiToHz(midi: number): number` = `440 * 2 ** ((midi - 69) / 12)`
- `chordForStep(musicStep: number)` returns `MUSIC_CHORDS[Math.floor(musicStep / STEPS_PER_BAR) % MUSIC_CHORDS.length]`.
- `intensity(towerCount: number, wave: number): number` = `Math.min(1, Math.min(towerCount, 12) / 12 * 0.6 + Math.min(wave, 5) / 5 * 0.4)`
- `layerLevels(i: number): { pad: number; bass: number; arp: number }`:
  - `pad = 0.6 + 0.4 * i`
  - `bass = i < 0.1 ? 0 : 0.4 + 0.6 * i`
  - `arp = i < 0.5 ? 0 : (i - 0.5) * 2`
- `arpNote(musicStep: number): number` returns a note from the current chord's `pad`, raised 12 semitones. The note index is `(musicStep / 2) % pad.length` for even `musicStep`.

### 3. `src/audio.ts`

Keep the public methods `playNote`, `playMetronome`, `playKill`, `playLeak`, and `setMuted`, with the same arguments. Rebuild the signal path as follows.

- Create three gain buses: `towerBus`, `musicBus`, `fxBus`. `towerBus` and `fxBus` connect to `master`. `musicBus` connects to `master`.
- The chain after `master` is: existing lowpass `filter`, then a `DynamicsCompressorNode` limiter (threshold -6, knee 0, ratio 20, attack 0.003, release 0.15), then an `AnalyserNode` with `fftSize` 2048, then `ctx.destination`.
- Reverb: a `ConvolverNode` using a generated 2.2-second stereo impulse of noise with an exponential decay. Output goes to `fxBus`. `musicBus` and `towerBus` each send to it through a gain of `MIX.reverbSend`.
- Delay: a `DelayNode` with `maxDelayTime` 2, delay time equal to 3 steps at the current tempo, feedback gain `MIX.delayFeedback`, output to `fxBus`. Synth notes and arp notes send to it through a gain of `MIX.delaySend`.
- Add `setTempo(stepDuration: number)`, which updates the delay time with `setTargetAtTime`.
- Add `playPad(notes: number[], time, duration, level)`:
  - For each note, use two detuned sawtooth oscillators (-6 and +6 cents) through one shared lowpass filter at 900 Hz, into `musicBus`.
  - Attack is 0.4 s. Release ends 0.5 s after `time + duration`, so consecutive chords overlap.
  - Peak gain per note is `MIX.pad * level / notes.length`.
- Add `playBass(note, time, level)`: a triangle oscillator into `musicBus`, peak `MIX.bass * level`, decaying over 0.3 s.
- Add `playArp(note, time, level)`: a triangle oscillator into `musicBus` and the delay send, peak `MIX.arp * level`, decaying over 0.18 s.
- In `playNote`, on `kick`, duck `musicBus.gain`: set it to `1 - MIX.duckAmount` at `time`, then ramp linearly to 1 at `time + MIX.duckRelease`.
- Synth tower voice: mix one sawtooth and one triangle an octave lower, through a lowpass with Q 1.5 and cutoff 900 + (7 - row) * 160 Hz, into `towerBus` and the delay send.
- Tower voices connect to `towerBus` with peak levels `MIX.kick`, `MIX.hat`, `MIX.synth` multiplied by the existing `level`. Multiply `level` by a random factor between 0.9 and 1.1 for each note.
- `playKill` and `playMetronome` use `MIX.kill` and `MIX.metronome` for their peak levels (metronome accent uses `MIX.metronome`, non-accent half of that).
- Add `readPeak(): number`, which reads the analyser with `getFloatTimeDomainData` and returns the maximum absolute sample.

### 4. `src/scheduler.ts`

At the start of `tick()`, if `this.nextStepTime < this.ctx.currentTime - 0.2`, set `this.nextStepTime = this.ctx.currentTime + 0.06`. This stops a throttled background tab from firing a burst of past-due steps.

The constructor must accept any object with a `currentTime` property: change the `ctx` parameter and field type to `Pick<AudioContext, 'currentTime'>`.

### 5. `src/main.ts`

- Add `let musicStep = 0`. It is not reset by `restart()`.
- In `onStep(time, duration)`, before `sim.step()`:
  - Compute `const i = intensity(sim.towers.length, sim.wave)`, `const levels = layerLevels(i)`, `const local = musicStep % STEPS_PER_BAR`.
  - When `local === 0`, call `audio.playPad(chordForStep(musicStep).pad, time, duration * STEPS_PER_BAR, levels.pad)`.
  - When `levels.bass > 0` and `BASS_STEPS` includes `local`, call `audio.playBass(chordForStep(musicStep).bass, time, levels.bass)`.
  - When `levels.arp > 0` and `ARP_STEPS` includes `local`, call `audio.playArp(arpNote(musicStep), time, levels.arp)`.
  - Play the metronome only when `sim.towers.length === 0`.
  - Call `audio.setTempo(duration)`.
  - After `sim.step()`, increment `musicStep`.
- Playhead sync: add `let stepMarks: Array<{ at: number; step: number }> = []` and `let playhead = 0`.
  - In `onStep`, read `const step = sim.stepIndex` before `sim.step()`, and push `{ at: time, step }`.
  - In `frame()`, shift every mark with `at <= now` and set `playhead` to the last shifted `step`.
  - Pass `playhead` in the `renderer.draw` state.
  - `restart()` clears `stepMarks`.
- Change `window.__drumline` to `{ sim, scheduler, audio }` everywhere it is assigned, and update its global type.

### 6. `src/render.ts`

- Add `playhead: number` to `RenderState`. `drawPlayhead` uses it in place of `sim.stepIndex`.
- Enemy positions: `const x = (point.x + 0.5) * CELL` and `const y = (point.y + 0.5) * CELL`.
- Kill particles: `x: (event.x + 0.5) * CELL` and `y: (event.y + 0.5) * CELL`.

### 7. Tests

`tests/music.test.ts` covers:

- `midiToHz(69) === 440`
- `chordForStep` returns Am7, Fmaj7, Cadd9, Gsus at steps 0, 16, 32, 48, and Am7 again at step 64.
- `intensity(0, 0) === 0` and `intensity(12, 5) === 1`, and `intensity(100, 100) === 1`.
- `layerLevels(0)` has `bass === 0` and `arp === 0`. `layerLevels(1)` has `pad`, `bass`, and `arp` all equal to 1.
- `arpNote` returns only `pad` notes plus 12 for the chord at that step, across steps 0 to 62.

`tests/scheduler.test.ts` uses a fake `{ currentTime }` object and Vitest fake timers:

- At a steady clock, two steps scheduled are `stepSeconds(BPM)` apart.
- After jumping `currentTime` forward by 5 seconds, the next tick calls `onStep` no more than 3 times, and every `time` passed is at least `currentTime`.

## Acceptance

Run each from `/Users/sz/Documents/code/drumline`:

- `npm test` exits 0, and all tests pass, including the three existing balance assertions.
- `npm run typecheck` exits 0.
- `npm run build` exits 0.
- `grep -q 'createDynamicsCompressor' src/audio.ts` exits 0.
- `grep -q 'createConvolver' src/audio.ts` exits 0.
- `grep -q '(point.x + 0.5) \* CELL' src/render.ts` exits 0.
- `grep -q '(event.x + 0.5) \* CELL' src/render.ts` exits 0.
- `! grep -nE 'Math\.random|Date\.|document\.|window\.' src/music.ts src/sim.ts` exits 0.
- `git diff --quiet -- src/sim.ts tests/bots.ts tests/balance.test.ts tests/sim.test.ts` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run any `gh` command, and do not change any git remote or GitHub setting.
- Do not add dependencies, external scripts, or asset files.
- TypeScript strict mode stays on. Do not use `any` or `@ts-ignore` in `src/`.
- Do not change `src/sim.ts`, `tests/bots.ts`, `tests/balance.test.ts`, `tests/sim.test.ts`, or any existing value in `src/config.ts`.
- If npm cannot write to `~/.npm`, set `npm_config_cache="$TMPDIR/drumline-npm-cache"`.

## Out of scope

- Game balance and tower stats.
- New towers, enemies, maps, or menus.
- Roguelike upgrades, persistence, and share links.
- Volume sliders or audio settings UI.

## If blocked

If a step is wrong or impossible, stop, leave completed work in place, and write the blocker to `.handoff/report.md`. Include the failing command, its output, and the exact decision needed.
