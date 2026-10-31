## Goal

Build the first playable prototype of **Drumline**, a browser tower defense game where towers are instruments on a looping 16-step sequencer. Deliver one map, three towers, three enemy types plus a boss, five waves, and basic geometric art, all synthesized in code with no audio or image asset files. The game builds to a static site with relative asset paths, and a GitHub Actions workflow is included that deploys it to GitHub Pages.

## Files to touch

Create or modify only these paths, relative to the repo root `/Users/sz/Documents/code/drumline`:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `README.md`
- `.github/workflows/deploy.yml`
- `src/config.ts`
- `src/sim.ts`
- `src/scheduler.ts`
- `src/audio.ts`
- `src/render.ts`
- `src/main.ts`
- `src/style.css`
- `tests/sim.test.ts`
- `tests/bots.ts`
- `tests/balance.test.ts`
- `.handoff/report.md`

## Steps

### 1. Tooling

1. Create `package.json` with `"name": "drumline"`, `"private": true`, `"version": "0.1.0"`, `"type": "module"`, and these scripts:
   - `"dev": "vite"`
   - `"preview": "vite preview"`
   - `"test": "vitest run"`
   - `"typecheck": "tsc --noEmit"`
   - `"build": "tsc --noEmit && vite build"`
2. Run `npm i -D -E vite@8.3.5 typescript@7.0.2 vitest@5.0.5`. Add no other dependencies.
3. Create `tsconfig.json`:
   `{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"bundler","strict":true,"noEmit":true,"lib":["ES2022","DOM"],"types":["vite/client"],"skipLibCheck":true},"include":["src","tests","vite.config.ts"]}`
4. Create `vite.config.ts` using `defineConfig({ base: './' })`.

### 2. `src/config.ts`

All tunable numbers live here. Export these values:

- `GRID_COLS = 16`, `GRID_ROWS = 8`, `STEPS_PER_BAR = 16`
- `BPM = 120`. One step is a sixteenth note: `stepSeconds(bpm) = 60 / bpm / 4`.
- `FAST_BPM = 240`
- `PATH_WAYPOINTS = [[0,1],[13,1],[13,4],[2,4],[2,6],[15,6]]` as `[col,row]`. Enemies enter at the first point and leak after the last.
- `START_MONEY = 150`, `START_LIVES = 20`, `WAVE_CLEAR_BONUS = 40`, `SELL_REFUND = 0.7`
- `CHORD_BONUS_PER_TOWER = 0.25`, `CHORD_MAX_TOWERS = 4`
- `TOWERS`, keyed by `TowerType`:
  - `kick`: cost 50, range 2.5, damage 12, splash 1.0, chain 0, fires once per bar
  - `hat`: cost 35, range 3.5, damage 3, splash 0, chain 0, fires four times per bar
  - `synth`: cost 70, range 4, damage 14, splash 0, chain 2, fires once per bar. Each chained target is within 2 cells of the previous target and takes 50% damage.
- `ENEMIES`, keyed by `EnemyType`, with speed in cells per step:
  - `blip`: hp 30, speed 0.16, bounty 5, leak 1
  - `runner`: hp 16, speed 0.3, bounty 4, leak 1
  - `brute`: hp 120, speed 0.1, bounty 15, leak 3
  - `boss`: hp 900, speed 0.07, bounty 0, leak 20
- `WAVES`: an array of five waves, each an array of groups `{ type, count, gapSteps }`:
  1. 8 blip, gap 8
  2. 10 blip, gap 6; then 6 runner, gap 8
  3. 6 brute, gap 16; then 10 runner, gap 4
  4. 14 blip, gap 4; then 8 brute, gap 12
  5. 1 boss, gap 0; then 12 runner, gap 6
- `PALETTE`: `bg #12101a`, `path #241f33`, `grid #1c1829`, `kick #ff3d81`, `hat #2de2e6`, `synth #f9f871`, `enemy #f5f1ff`, `playhead #ffffff`

### 3. `src/sim.ts`

A pure, deterministic simulation. It must not import DOM or audio code, and must not use `Math.random` or `Date`.

Export these types:

- `TowerType = 'kick' | 'hat' | 'synth'`
- `EnemyType = 'blip' | 'runner' | 'brute' | 'boss'`
- `Phase = 'build' | 'wave' | 'won' | 'lost'`
- `Tower { type, col, row }`
- `Enemy { id, type, hp, maxHp, progress }`, where `progress` is the distance in cells along the path
- `SimEvent`, a union of:
  - `{ kind: 'note', towerType, col, row, hit: boolean, chordSize: number }`
  - `{ kind: 'hit', x, y, towerType }`
  - `{ kind: 'kill', x, y, enemyType }`
  - `{ kind: 'leak', lives }`
  - `{ kind: 'waveStart', wave }`
  - `{ kind: 'waveClear', wave }`
  - `{ kind: 'won' }`
  - `{ kind: 'lost' }`

Export these functions and class:

- `pathCells(): Array<[number, number]>` returns every cell on the path, in order, without duplicates.
- `pathPoint(progress: number): { x: number; y: number }` returns a point in cell coordinates, where integer coordinates are cell centers. It interpolates along `PATH_WAYPOINTS`.
- `pathLength(): number`
- `class Sim` with public fields `money`, `lives`, `wave`, `phase`, `stepIndex`, `totalSteps`, `towers`, `enemies`, and these methods:
  - `canPlace(col, row): boolean` is true only for an in-bounds cell that is not on the path and not occupied.
  - `placeTower(type, col, row): boolean` is allowed in any phase except `won` and `lost`. It returns false if `canPlace` is false or money is short. Otherwise it deducts the cost.
  - `sellTower(col, row): boolean` refunds `Math.floor(cost * SELL_REFUND)`.
  - `startWave(): boolean` works only in the `build` phase, and only if another wave remains. It increments `wave` (`wave` is 0 before the first wave, and 1-based afterward), sets the phase to `wave`, queues the spawns, and emits `waveStart` on the next `step()`.
  - `step(): SimEvent[]` advances one sixteenth note.

Spawn timing: the first spawn of the wave happens on the first `step()` where `stepIndex === 0` after `startWave()`. Within a group, spawns are `gapSteps` apart. The next group starts 16 steps after the previous group's last spawn.

`step()` runs in this order:

1. Emit `waveStart` if pending.
2. Spawn due enemies at progress 0.
3. Fire towers:
   - A `kick` or `synth` fires when `stepIndex === col`.
   - A `hat` fires when `(stepIndex - col + 16) % 4 === 0`.
   - `chordSize` is the number of towers firing this step.
   - Damage is multiplied by `1 + CHORD_BONUS_PER_TOWER * (Math.min(chordSize, CHORD_MAX_TOWERS) - 1)`.
   - Each tower targets the enemy in range with the highest `progress`. Range is Euclidean, measured from the tower's cell center to `pathPoint(progress)`.
   - Every firing tower emits exactly one `note` event, in `build` as well as `wave`. `hit` is false when there was no target.
   - `kick` damages all enemies within `splash` of the target, at full damage.
   - `synth` chains to the nearest not-yet-hit enemy within 2 cells of the previous target, up to `chain` times, each at 50% damage.
   - Each damaged enemy emits a `hit` event.
4. Remove enemies at `hp <= 0`, add their bounty to `money`, and emit `kill`.
5. Advance every enemy by its speed. An enemy whose `progress >= pathLength()` is removed, loses `leak` lives (floored at 0), and emits `leak`.
6. If `lives === 0`, set the phase to `lost` and emit `lost`. Otherwise, if the phase is `wave`, the spawn queue is empty, and no enemies remain: add `WAVE_CLEAR_BONUS`, emit `waveClear`, then either set the phase to `won` and emit `won` (if it was wave 5) or set the phase to `build`.
7. Set `stepIndex = (stepIndex + 1) % 16` and increment `totalSteps`.

Calling `step()` in `won` or `lost` still fires tower notes and moves `stepIndex`, but changes no money or lives.

### 4. `src/scheduler.ts`

The audio clock is the single source of timing. Export `class Scheduler` with the constructor `(ctx: AudioContext, onStep: (time: number, stepDuration: number) => void)`, and these members: `start()`, `stop()`, `bpm` (mutable), `lastStepTime`, `stepDuration`.

It uses `setInterval` every 25 ms. While `nextStepTime < ctx.currentTime + 0.06`, it calls `onStep(nextStepTime, stepDuration)` and adds the current step duration to `nextStepTime`. It must not use `requestAnimationFrame` or `Date` for timing.

### 5. `src/audio.ts`

Export `class Audio_` containing all Web Audio synthesis. Use only built-in oscillator, gain, filter, and noise-buffer nodes.

- Constructor creates or receives the `AudioContext`, and routes a master gain through a lowpass `BiquadFilterNode` (default cutoff 20000 Hz) to the destination.
- Scale: A minor pentatonic. Row 0 is the highest pitch and row 7 the lowest. `synth` plays A3-based pentatonic degrees by row.
- `playNote(towerType, row, time, hit, chordSize)`:
  - `kick`: sine with a fast pitch drop. The base pitch rises slightly as the row gets closer to 0.
  - `hat`: short highpassed noise burst. The filter frequency varies by row.
  - `synth`: sawtooth through a lowpass filter, with a short envelope.
  - A note with `hit === false` plays at 60% gain.
- `playMetronome(time, accent)`: a quiet tick.
- `playKill(time)`: a short random pentatonic blip. `Math.random` is allowed in this file.
- `playLeak(time)`: sweeps the master filter down to 400 Hz and back to 20000 Hz over 1 bar.
- `setMuted(muted)` sets master gain. Muting affects only audio output, and the simulation keeps running.

### 6. `src/render.ts`

Canvas 2D renderer. Export `class Renderer` with `constructor(canvas)`, `draw(state)`, and `spawnEffect(event)`.

- Internal resolution: 56 pixels per cell, giving 896×448, multiplied by `devicePixelRatio`. CSS scales the canvas to fit the viewport with its aspect ratio preserved.
- Draw order: background, grid cells, path, bright translucent column at the playhead, towers, enemies, particles.
- Towers: `kick` is a circle, `hat` is a triangle, `synth` is a diamond, each in its palette color. A tower scales up to 1.3× on firing and eases back over about 150 ms.
- Enemies: `blip` is a small circle, `runner` a small triangle, `brute` a large square, `boss` a very large square. Show an HP bar only when damaged.
- Enemy positions are smooth: the rendered progress is `progress + speed * (now - lastStepTime) / stepDuration`, clamped to the range 0 to `pathLength()`, then mapped through `pathPoint`.
- Kills spawn about 12 confetti particles in the tower palette colors.
- Hovering a buildable cell with a tower selected shows a translucent preview and a range circle.
- All colors come from `PALETTE`.

### 7. `index.html`, `src/style.css`, `src/main.ts`

`index.html` contains: a `<title>Drumline</title>`, a viewport meta tag, a `#hud` showing money, lives, and `Wave n/5`, a `<canvas id="game">`, and a `#controls` bar with buttons:

- `#tool-kick` Kick
- `#tool-hat` Hat
- `#tool-synth` Synth
- `#tool-sell` Sell
- `#start-wave` Start wave
- `#fast` 2×
- `#mute` Mute
- `#restart` Restart

It also has a full-screen `#overlay` that reads "Click to start" before audio starts, and shows "You won" or "Game over" at the end. `src/style.css` uses the palette colors. The layout fits a 375-pixel-wide phone with no horizontal scroll, and buttons are at least 44 pixels tall.

`src/main.ts`:

1. Creates the `Sim` and `Renderer`. On the first click of `#overlay`, it creates the `AudioContext`, calls `resume()`, creates `Audio_` and `Scheduler`, and starts the scheduler.
2. On each `onStep(time, duration)`: plays a metronome tick when `stepIndex % 4 === 0` (accented when `stepIndex === 0`), calls `sim.step()`, sends sound events to `Audio_` with `time`, and queues visual events to fire when `ctx.currentTime >= time`.
3. Runs a `requestAnimationFrame` loop that calls `renderer.draw`, passing `ctx.currentTime` as `now`.
4. Handles input:
   - Pointer click on a cell places the selected tower, or sells when the Sell tool is active.
   - Keys `1`, `2`, `3`, `4` select Kick, Hat, Synth, Sell.
   - `Space` starts the wave, `F` toggles fast mode (`scheduler.bpm` switches between `BPM` and `FAST_BPM`), `M` toggles mute, `R` restarts with a new `Sim`.
5. Exposes `window.__drumline = { sim, scheduler }`, kept up to date after a restart.

### 8. Tests

`tests/sim.test.ts` must cover:

- `pathCells` has no duplicates.
- `placeTower` rejects path cells, occupied cells, and placement with too little money.
- `sellTower` refunds `Math.floor(cost * SELL_REFUND)`.
- A `kick` in column 5 emits exactly one `note` per 16 steps, at `stepIndex` 5.
- A `hat` in column 5 emits exactly four `note` events per 16 steps, at `stepIndex` 1, 5, 9, 13.
- Towers play notes in the `build` phase with `hit === false`.
- Two kicks in the same column report `chordSize === 2`. An enemy in range of both takes `12 * 1.25 * 2` total damage.
- Two `Sim` instances given identical actions end with deep-equal `money`, `lives`, `enemies`, and `totalSteps`.
- After `lives` reaches 0, the phase is `lost`.

`tests/bots.ts` exports `playBot(strategy): { result: Phase; wave: number; lives: number; money: number }`:

- `idle` places nothing.
- `spread` and `chord` both spend all money before each `startWave()`, cycling the tower order kick, hat, synth. They skip a type they cannot afford, and stop when they can afford none.
- Coverage means the number of `pathCells` within the tower's range.
- `spread` chooses the buildable cell sorted by: fewest towers in the column (ascending), coverage (descending), column (ascending), row (ascending).
- `chord` chooses the buildable cell sorted by: most towers in the column among columns with fewer than 4 towers (descending), coverage (descending), column (ascending), row (ascending).
- Each bot loops: spend, `startWave()`, `step()` until the phase is no longer `wave`. It stops at `won` or `lost`, or at 20000 total steps, which fails the run.

`tests/balance.test.ts` logs one result line per bot with `console.log`, and asserts:

- `idle` ends `lost`.
- `spread` ends `won`, with `lives` between 5 and 19 inclusive.
- `chord` reaches `wave >= 4`.

To meet these, change numbers in `src/config.ts` only. Do not change `sim.ts`, `bots.ts`, or the assertions to make balance pass. Report the final numbers changed.

### 9. Deployment and docs

Create `.github/workflows/deploy.yml`. It triggers on push to `main` and on `workflow_dispatch`, with permissions `contents: read`, `pages: write`, `id-token: write`, and concurrency group `pages` with `cancel-in-progress: true`.

- A `build` job on `ubuntu-latest` uses `actions/checkout@v7`, then `actions/setup-node@v7` with `node-version: 22` and `cache: npm`. It runs `npm ci`, `npm test`, `npm run build`, then `actions/upload-pages-artifact@v5` with `path: dist`.
- A `deploy` job with `needs: build` and `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }` uses `actions/deploy-pages@v5` with `id: deployment`.

Update `README.md`: keep the title and one-line description, then add how to play, the controls, and the commands `npm install`, `npm run dev`, `npm test`, and `npm run build`.

## Acceptance

Run each from `/Users/sz/Documents/code/drumline`:

- `npm test` exits 0, and the output shows all tests passed, including the three balance assertions.
- `npm run typecheck` exits 0.
- `npm run build` exits 0.
- `grep -q 'src="./assets/' dist/index.html` exits 0.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy.yml"); puts "yaml ok"'` prints `yaml ok`.
- `! grep -nE 'Math\.random|Date\.|document\.|window\.' src/sim.ts` exits 0.
- `! grep -n 'requestAnimationFrame' src/scheduler.ts` exits 0.
- `test -z "$(find src index.html -type f \( -name '*.mp3' -o -name '*.wav' -o -name '*.ogg' -o -name '*.png' -o -name '*.jpg' \))"` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`. `node_modules/` and `dist/` are generated and git-ignored.
- Do not run any `gh` command, and do not change any git remote or GitHub setting.
- Do not add runtime dependencies, external scripts, web fonts, or asset files.
- TypeScript strict mode stays on. Do not use `any` or `@ts-ignore` in `src/`.
- `src/sim.ts` stays free of DOM, audio, and randomness.

## Out of scope

- Roguelike upgrades, meta progression, and unlocks.
- Saved games or any persistence.
- Shareable track links and daily challenges.
- Extra maps, towers, or genres.
- Menus beyond the overlay.
- Creating the GitHub repository or enabling Pages.

## If blocked

If a step is wrong or impossible, stop, leave completed work in place, and write the blocker to `.handoff/report.md`. Include the failing command, its output, and the exact decision needed. If the balance assertions cannot be met by changing `src/config.ts` alone, report the closest numbers and bot results instead of changing `sim.ts`, `bots.ts`, or the assertions.
