## Goal

Make Drumline's attacks readable. Each tower type gets a distinct, visible attack, enemies react when hit, chord bonuses appear on screen, and the player can see what each tower does, its cost, and its range before and after placing it.

## Files to touch

Relative to the repo root `/Users/sz/Documents/code/drumline`:

- `src/config.ts`
- `src/sim.ts`
- `src/render.ts`
- `src/main.ts`
- `src/style.css`
- `index.html`
- `tests/attacks.test.ts` (new)
- `.handoff/report.md`

## Steps

### 1. `src/config.ts`

Add this export. Do not change any existing value.

```ts
export const TOWER_INFO: Record<TowerType, { name: string; role: string; description: string }> = {
  kick: { name: 'Kick', role: 'Splash', description: 'Hits everything near its target, once per bar.' },
  hat: { name: 'Hat', role: 'Rapid', description: 'Small hits, four times per bar.' },
  synth: { name: 'Synth', role: 'Chain', description: 'Zaps its target, then arcs to 2 more enemies at half damage, once per bar.' },
};
```

### 2. `src/sim.ts`

Change only the event data. Damage, targeting, money, timing, and event order for existing events must stay the same.

Update the `SimEvent` union:

- Add `enemyId: number` to the `hit` event.
- Add `{ kind: 'shot'; towerType: TowerType; col: number; row: number; x: number; y: number; chordSize: number }`. `x` and `y` are the primary target's position.
- Add `{ kind: 'chain'; fromX: number; fromY: number; x: number; y: number }`.

In `fireTowers`:

- After the `note` event, and only when `applyDamage` is true and `target` is not null, push one `shot` event, before any `hit` event for that tower.
- Every `hit` event carries the damaged enemy's `id` as `enemyId`.
- For each synth chain link, push a `chain` event immediately before that link's `hit` event, from the previous target's position to the new target's position.

### 3. `src/render.ts`

Export a `drawTowerShape(ctx, type, size)` helper used by `drawTowers` and the preview. `size` is the half-height in pixels. It draws around the origin: `kick` circle, `hat` triangle, `synth` diamond. Keep tower sizes on the board the same as now.

Add private effect lists, stored in canvas pixels with cell centers at `(value + 0.5) * CELL`. Each effect has `born` set to `this.lastNow`, and is removed once `now - born >= life`. Extend `spawnEffect`:

- `shot` with `towerType: 'kick'`:
  - A shockwave ring centered on the target. It expands from radius 0 to `TOWERS.kick.splash * CELL` over 0.3 s, line width 4 easing to 1, fading out, in `PALETTE.kick`.
  - A thick line from the tower center to the target, line width 5, life 0.1 s, in `PALETTE.kick`.
- `shot` with `towerType: 'hat'`: a thin straight tracer from the tower center to the target, line width 2, life 0.12 s, in `PALETTE.hat`, plus a filled spark of radius 4 at the target with the same life.
- `shot` with `towerType: 'synth'`: a jagged lightning bolt from the tower center to the target, in `PALETTE.synth`, line width 2.5, life 0.2 s. Build it as 6 segments, offsetting each interior point perpendicular to the line by a random distance from -8 to 8 pixels. Compute the points once in `spawnEffect`, so the bolt does not flicker between frames.
- `chain`: the same bolt from `(fromX, fromY)` to `(x, y)`, line width 1.5.
- `shot` with `chordSize >= 2`: a floating label at the top of the tower's column, showing the multiplier computed as `1 + CHORD_BONUS_PER_TOWER * (Math.min(chordSize, CHORD_MAX_TOWERS) - 1)` and formatted with `×` and two decimals, such as `×1.25`. Show one label per column per step. It uses bold 14-pixel sans-serif in `PALETTE.enemy`, rises 16 pixels, and fades over 0.5 s.
- `hit`: store `hitFlashes.set(enemyId, { color, at })`. In `drawEnemies`, if the flash is under 0.1 s old, fill that enemy in the tower color and scale it 1.25×. Remove expired flashes.
- `note` with `hit === false`: a faint ring around the tower, radius from 18 to 28 pixels, line width 1.5, peak alpha 0.25, life 0.2 s, in the tower's color. This shows it fired with nothing in range. The existing scale pulse stays.

Draw order: background, grid, path, playhead, range and preview, towers, enemies, attack effects, particles, labels.

Replace the preview's generic circle with `drawTowerShape(ctx, selected, 20)` at alpha 0.35, keeping the existing dashed range circle.

Add `inspect: { col: number; row: number } | null` to `RenderState`. When it points to an existing tower, draw that tower's range as a dashed circle in its color, using the same style as the preview.

### 4. `index.html`

Replace the three tower buttons' contents with:

- `<span class="glyph kick">●</span> Kick <small class="cost"></small>`
- `<span class="glyph hat">▲</span> Hat <small class="cost"></small>`
- `<span class="glyph synth">◆</span> Synth <small class="cost"></small>`

Add `<p id="info"></p>` immediately after the closing `</main>` tag and before `#controls`.

### 5. `src/main.ts`

- On load, set each tower button's `.cost` text from `TOWERS`, as `$50`, `$35`, `$70`.
- Add `let inspect: { col: number; row: number } | null = null`. Pass it to `renderer.draw`.
- Add `updateInfo()`, which sets the text of `#info` by the first rule that applies:
  1. The hovered cell, or otherwise `inspect`, holds a tower: use that tower's type.
  2. `selected` is a tower type: use that type.
  3. `selected === 'sell'`: `Click a tower to sell it for ${Math.round(SELL_REFUND * 100)}% of its cost.`
  4. Otherwise: `Towers fire when the playhead reaches their column. Towers firing together form a chord: +${CHORD_BONUS_PER_TOWER * 100}% damage each.`
- For rules 1 and 2, the text is `${name} · $${cost} · ${role} · ${damage} damage · range ${range} — ${description}`, using `TOWER_INFO` and `TOWERS`.
- In the canvas click handler, if no tool is selected and the cell holds a tower, set `inspect` to that cell. If the cell holds no tower and no tool is selected, set `inspect = null`. This makes inspection work on touch screens.
- Clear `inspect` when the inspected tower is sold, and in `restart()`.
- Call `updateInfo()` after every selection change, hover change, click, and restart, and once on load.
- Add a key: `Escape` calls `selectTool(null)`, so a player can leave placement mode and inspect towers.

### 6. `src/style.css`

- `#info`: palette text color, 14-pixel font size, line height 1.4, a minimum height of 2.8em so the layout does not jump, and margins matching the existing spacing.
- `.glyph.kick`, `.glyph.hat`, `.glyph.synth`: use the palette colors.
- `.cost`: lower-contrast text at 12 pixels.
- Keep the page free of horizontal scrolling at 375 pixels wide, with buttons at least 44 pixels tall.

### 7. `tests/attacks.test.ts`

Using `Sim` directly:

- A kick in range of an enemy emits exactly one `shot`, before its `hit` events, with `x` and `y` matching the enemy's position.
- A tower with no target in range emits a `note` with `hit === false`, and no `shot`.
- A synth with three enemies within chain range emits one `shot` and two `chain` events, and each `hit` carries an existing enemy's id.
- A `chain` event's start point matches the previous target's position.
- Two towers on the same step each emit a `shot` with `chordSize === 2`.

## Acceptance

Run each from `/Users/sz/Documents/code/drumline`:

- `npm test` exits 0, and all tests pass, including the three existing balance assertions.
- `npm run typecheck` exits 0.
- `npm run build` exits 0.
- `git diff --quiet -- tests/sim.test.ts tests/bots.ts tests/balance.test.ts src/audio.ts src/music.ts src/scheduler.ts` exits 0.
- `grep -q "kind: 'shot'" src/sim.ts` exits 0.
- `grep -q "kind: 'chain'" src/sim.ts` exits 0.
- `grep -q 'TOWER_INFO' src/main.ts` exits 0.
- `grep -q 'id="info"' index.html` exits 0.
- `! grep -nE 'Math\.random|Date\.|document\.|window\.' src/sim.ts` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run any `gh` command, and do not change any git remote or GitHub setting.
- Do not add dependencies, external scripts, or asset files.
- TypeScript strict mode stays on. Do not use `any` or `@ts-ignore` in `src/`.
- Do not change any gameplay number or behavior.
- All colors come from `PALETTE` or the existing CSS variables.
- If npm cannot write to `~/.npm`, set `npm_config_cache="$TMPDIR/drumline-npm-cache"`.

## Out of scope

- Audio changes, including the limiter.
- Game balance.
- New towers, enemies, maps, or menus.
- Damage numbers.

## If blocked

If a step is wrong or impossible, stop, leave completed work in place, and write the blocker to `.handoff/report.md`. Include the failing command, its output, and the exact decision needed.
