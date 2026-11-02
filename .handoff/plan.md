# Plan: tower upgrades, part 1 (feature and harness)

## Goal

Add three-level tower upgrades to the game and to every playtest tool, using the starting values below. Do not run searches, sweeps, or tiers, and do not retune anything. Balance work comes in a later plan.

## Files to touch

Modify:

- `index.html`
- `src/config.ts`
- `src/sim.ts`
- `src/sprites.ts`
- `src/render.ts`
- `src/main.ts`
- `src/style.css`
- `tools/playtest/bots.ts`
- `tools/playtest/plans.ts`
- `tools/playtest/search.ts`
- `tools/playtest/tiers.ts`
- `tools/playtest/bound.ts`
- `tools/playtest/rules.ts`
- `tests/plans.test.ts`
- `tests/search.test.ts`
- `tests/playtest.test.ts`
- `tests/tiers.test.ts`
- `tests/report.test.ts`
- `tests/boss-bound.test.ts`
- `tests/sprites.test.ts`
- `tests/sim.test.ts`, `tests/attacks.test.ts`, `tests/rules.test.ts`, but only if a compile error or an exact-match assertion on `Tower` or the `shot` event requires it
- `docs/balance.md`
- `docs/references.md`
- `README.md`
- `AGENTS.md`

Create:

- `tests/upgrades.test.ts`

## Steps

### 1. Config (`src/config.ts`)

Add directly after `TOWERS`:

```ts
export const MAX_TOWER_LEVEL = 3;

// One level bought on a tower: its price as a share of the tower's cost, and what it adds.
export interface TowerUpgrade {
  costShare: number;
  damage?: number;
  range?: number;
  splash?: number;
  chain?: number;
}

// Levels 2 and 3 of each tower, in order. They never change when a tower fires or chords.
export const TOWER_UPGRADES: Record<TowerType, readonly TowerUpgrade[]> = {
  kick: [
    { costShare: 1, damage: 12 },
    { costShare: 2, damage: 12, splash: 0.5 },
  ],
  hat: [
    { costShare: 1, range: 1 },
    { costShare: 2, damage: 2 },
  ],
  synth: [
    { costShare: 1, damage: 9 },
    { costShare: 2, chain: 1 },
  ],
};
```

Add `upgrades: readonly [string, string]` to each `TOWER_INFO` entry:

- kick: `['more damage', 'wider splash and more damage']`
- hat: `['more range', 'more damage']`
- synth: `['more damage', 'one more chain link']`

Add `upgrades: Record<TowerType, readonly TowerUpgrade[]>;` as the last field of `Rules`, and `upgrades: TOWER_UPGRADES,` as the last field of `DEFAULT_RULES`.

Add these three functions directly after `DEFAULT_RULES`:

```ts
export function towerStats(rules: Rules, type: TowerType, level: number): TowerStats {
  const stats = { ...rules.towers[type] };
  for (const upgrade of rules.upgrades[type].slice(0, level - 1)) {
    stats.damage += upgrade.damage ?? 0;
    stats.range += upgrade.range ?? 0;
    stats.splash += upgrade.splash ?? 0;
    stats.chain += upgrade.chain ?? 0;
  }
  return stats;
}

// The price of the level after `level`, or null when there isn't one.
export function upgradeCost(rules: Rules, type: TowerType, level: number): number | null {
  const upgrade = rules.upgrades[type][level - 1];
  if (!upgrade) return null;
  return Math.round(rules.towers[type].cost * upgrade.costShare);
}

export function towerSpent(rules: Rules, type: TowerType, level: number): number {
  let spent = rules.towers[type].cost;
  for (let current = 1; current < level; current += 1) {
    spent += upgradeCost(rules, type, current) ?? 0;
  }
  return spent;
}
```

### 2. Sim (`src/sim.ts`)

- Add `level: number` to `Tower`. `placeTower` pushes `level: 1`.
- Add `splash: number` to the `shot` event, set from `stats.splash`.
- Add `private readonly statsByLevel: Record<TowerType, TowerStats[]>`. Build it in the constructor from `towerStats(rules, type, level)` for levels 1 to `MAX_TOWER_LEVEL`.
- In `fireTowers`, set `stats` to `this.statsByLevel[tower.type][tower.level - 1]`. Do not change `firing`, `chordSize`, or `multiplier`.
- Add `upgradeTower(col: number, row: number): boolean` directly after `placeTower`. It returns `false` when the phase is `won` or `lost`, when no tower is on the cell, when `upgradeCost(this.rules, tower.type, tower.level)` is `null`, or when `money` is below the cost. Otherwise it subtracts the cost, adds 1 to `tower.level`, and returns `true`.
- In `sellTower`, refund `Math.floor(towerSpent(this.rules, tower.type, tower.level) * this.rules.sellRefund)`.

### 3. Sprites (`src/sprites.ts`)

Add `'upgrade'` to `SpriteName`. Add this sprite directly after `sell`, using the same rows for both frames:

```ts
'................',
'.......00.......',
'......0ii0......',
'.....0iigg0.....',
'....0iigggg0....',
'...0iigggggg0...',
'..0iigggggggg0..',
'..00000gg00000..',
'......0gh0......',
'......0gh0......',
'......0gh0......',
'......0gh0......',
'......0gh0......',
'......0000......',
'................',
'................',
```

Add directly after `SPRITES`:

```ts
// Drawn over a tower's top-left corner to show its level. Level 1 has no badge.
export const LEVEL_BADGES: Readonly<Record<number, readonly string[]>> = {
  2: ['0000', '0660', '0660', '0000'],
  3: ['0000000', '0660660', '0660660', '0000000'],
};
```

### 4. Renderer (`src/render.ts`)

- Widen `RenderState.selected` to `TowerType | 'sell' | 'upgrade' | null`.
- After the `BAKED` loop, add `const BADGES = new Map<number, HTMLCanvasElement>();` and fill it with `bake(rows)` for each `LEVEL_BADGES` entry.
- In `drawTowers`, after drawing the tower, draw `BADGES.get(tower.level)` at the tower's cell origin when it exists.
- In `drawRanges`, use `towerStats(state.sim.rules, tower.type, tower.level).range`.
- In `drawPreview`, also return when `selected === 'upgrade'`.
- Rename `drawSellOutline` to `drawToolOutline`, and update its call. It returns unless `selected` is `sell` or `upgrade`. When `selected` is `upgrade`, it strokes only a tower that `upgradeCost` says can level up, with `PIXEL_COLORS.g`. `sell` keeps `PIXEL_COLORS.r`.
- Add `splash: number` to `KickEffect`, pass `event.splash` in `spawnEffect`, and use `t * effect.splash * ART_CELL + 1` in `drawEffects`.

### 5. Page and input (`index.html`, `src/main.ts`, `src/style.css`)

`index.html`: add this directly after the `tool-sell` button, on its own line:

```html
<button id="tool-upgrade" class="pad" type="button"><span class="led"></span><canvas data-sprite="upgrade" width="16" height="16"></canvas><b>Upgrade</b><small class="cost"></small><kbd>5</kbd></button>
```

`src/main.ts`:

- Add `upgradeButton`, wired like `sellButton`, and include it in `updateSelection`.
- Widen `selected` and the `selectTool` parameter to `TowerType | 'sell' | 'upgrade' | null`.
- In `updateStepHints`, treat `upgrade` like `sell`.
- Add key `5` for `selectTool('upgrade')`.
- Add a `towerText(tower: Tower): string` function. It returns `${name} · Level ${level} · ${role} · ${damage} damage · range ${range} · ${next}`. `damage` and `range` come from `towerStats(sim.rules, tower.type, tower.level)`. `next` is `Next: level ${level + 1}, $${cost}, ${TOWER_INFO[type].upgrades[level - 1]}` when `upgradeCost` isn't null, and `Max level` otherwise. Use it in the tower branch of `updateInfo`. Selecting a tool with no tower under it keeps the existing text.
- For `selected === 'upgrade'` with no tower to show, the info text is `Click a tower to buy its next level.`
- Change the sell text to `Click a tower to sell it for ${percent}% of what you spent on it.`
- At the start of `updateInfo`, set the upgrade pad's `.cost` text. With a tower under `towerAt(hover) ?? towerAt(inspect)`, show `$${cost}`, or `MAX` when `upgradeCost` is null. Otherwise show `LV+`. Phones held sideways hide `#info`, so this is their only price display.
- In the canvas click handler, add a branch before `else if (selected)`:

```ts
} else if (selected === 'upgrade') {
  sim.upgradeTower(cell.col, cell.row);
  inspect = towerAt(cell) ? { ...cell } : null;
}
```

`src/style.css`:

- Change `.pads` to `repeat(5, 1fr)`.
- Add `#tool-upgrade { --c: #a6d94a; }` directly after the `#tool-sell` rule.
- In `@media (max-width: 760px)`, add `padding-inline: 2px;` to `.pad`, and add `.pad b { font-size: 0.6rem; }`.
- In `@media (max-height: 520px) and (orientation: landscape)`, add `gap: 4px` on `.pads`, add `padding-inline: 1px;` to `.pad`, and add `.pad small { font-size: 0.95rem; }`.

### 6. Rules patches (`tools/playtest/rules.ts`)

Add `upgrades?: Partial<Record<TowerType, TowerUpgrade[]>>;` as the last field of `RulesPatch`. Add this as the last field of the object `resolveRules` returns, so its JSON key order matches `DEFAULT_RULES`:

```ts
upgrades: { ...DEFAULT_RULES.upgrades, ...patch.upgrades },
```

### 7. Build plans (`tools/playtest/plans.ts`)

Change `PlanStep.type` to `TowerType | 'upgrade'`. A step with type `upgrade` buys the next level of the tower on its cell. Existing fixtures stay valid.

Export this helper:

```ts
export function placeSteps(plan: BuildPlan): Array<PlanStep & { type: TowerType }> {
  return plan.filter((step): step is PlanStep & { type: TowerType } => step.type !== 'upgrade');
}
```

`planBot.spend`: add this branch at the top of the loop, after the `!step` check:

```ts
if (step.type === 'upgrade') {
  const tower = sim.towers.find((item) => item.col === step.col && item.row === step.row);
  const cost = tower ? upgradeCost(sim.rules, tower.type, tower.level) : null;
  if (cost === null) {
    next += 1;
    continue;
  }
  if (sim.money < cost) return;
  sim.upgradeTower(step.col, step.row);
  next += 1;
  continue;
}
```

`recordPlan`: pass an `onBuy` callback to `policyBot` that pushes each step to a local list, and return that list. Purchases keep the order they were made in. The returned plan for a bot that never upgrades matches the old result.

`noisyPlan`:

- Build `used` from `placeSteps(copy)`.
- In the swap branch, `continue` without swapping when both steps share a cell.
- In the cell-change branch, `continue` when `step.type === 'upgrade'`. When a place step moves, also move every upgrade step on its old cell to the new cell.

### 8. Bots (`tools/playtest/bots.ts`, `tools/playtest/tiers.ts`)

Add to `Policy`:

```ts
// Buys upgrades instead of towers once the board has this many towers. null never upgrades.
upgradeAt: number | null;
```

`randomPolicy`: draw last, so earlier draws keep their order: `const upgradeAt = rng() < 0.5 ? null : 20 + Math.floor(rng() * 41);`

`policyBot(policy, rules, onBuy?: (step: PlanStep) => void)`, using `import type { PlanStep } from './plans'`:

- At the top of the `spend` loop, after the `maxTowersPerWave` check, when `policy.upgradeAt !== null && sim.towers.length >= policy.upgradeAt`, pick the target. Among towers where `upgradeCost` isn't null, take the lowest level, then the highest `coverage[type][col][row]`, then the earliest in `sim.towers`. When there is a target: return if `sim.money` is below its cost; otherwise call `sim.upgradeTower`, call `onBuy` with `{ type: 'upgrade', col, row }`, add 1 to `placedThisWave`, and `continue`. With no target, carry on to placing a tower.
- After a successful `placeTower`, call `onBuy` with `{ type, col: chosen.col, row: chosen.row }`.

`playGame`:

- `spentByType[tower.type] += towerSpent(rules, tower.type, tower.level);`
- Add `upgrades: number` to `GameResult`, as the total of `tower.level - 1` over `sim.towers`.

`tierPolicy`: casual and competent set `upgradeAt: null`. Strong sets `upgradeAt: 36 + Math.floor(rng() * 25)`, drawn after the three weights, and only for strong.

### 9. Search (`tools/playtest/search.ts`)

- `freeCells`: build `used` from `placeSteps(plan)`.
- `behaviourOf`: `const towers = placeSteps(plan).slice(0, result.towers);`
- Add `upgrades: number` to `Evaluation`, from `result.upgrades`. Add a `| Upgrades | ${best.upgrades} |` row after `Synth` in the Best build table.
- `changeType` and `moveCell`: pick only among place steps. `moveCell` also moves the upgrade steps on the old cell.
- `deleteStep`: when the deleted step is a place step, also remove the upgrade steps on its cell.
- Add three operations to `Operation` and to the end of `OPERATIONS`:
  - `insertUpgrade`: pick a random place step with fewer than `MAX_TOWER_LEVEL - 1` upgrade steps on its cell, and insert an upgrade step for that cell at a random index after the place step.
  - `deleteUpgrade`: remove a random upgrade step. Do nothing if there are none.
  - `appendUpgrades`: repeat `1 + Math.floor(rng() * 4)` times: pick a place step the same way, and push an upgrade step. Stop early if no place step qualifies.

### 10. Boss bound (`tools/playtest/bound.ts`)

- Add a final `level = 1` parameter to `towerBossDamage`, and read stats from `towerStats(rules, type, level)`.
- In `bossBound`, each cell's choices become every type at every level from 1 to `MAX_TOWER_LEVEL`. A choice's weight uses `towerSpent` and its value uses `towerBossDamage` at that level.
- Keep `costs` as a flat list of options, compute `unit` as the gcd of all of them, and store the option index in `choices`.
- `fullBoardDamage` is the highest option on each cell, summed.
- `picks` still counts towers by type.
- Rewrite the top comment so it says the estimate lets every cell hold a tower at any level, and that level 3 kick splash and synth chains are among the small effects left out.

### 11. Tests

Add `upgradeAt: null` to each `Policy` in the existing tests. Add `upgrades: 0` to each result or evaluation helper. Change `{ type: 'hat', col: free[0], row: free[1] }` in `tests/plans.test.ts` to include `level: 1`. In the `mutatePlan` test, check uniqueness on `placeSteps(mutated)`.

Do not change `tests/balance.test.ts`, `tests/balance-docs.test.ts`, `tests/bots.ts`, or `tools/playtest/targets.ts`.

Create `tests/upgrades.test.ts` covering:

- New towers start at level 1.
- Costs: a kick pays 50, then 100, and is then at max level, using `resolveRules()` values through `upgradeCost`.
- `upgradeTower` returns `false` with no tower, too little money, at max level, and after the game ends. It works during a wave.
- Selling a level 3 kick refunds `Math.floor(200 * sellRefund)`, which is 140.
- Upgrading never changes `firesThisStep` output or `chordSize`: two towers on one step give the same `chordSize` at every level.
- A level 2 kick's `hit` event deals `towerStats` damage.
- A level 3 kick hits an enemy that a level 2 kick's splash misses.
- A level 2 hat hits an enemy beyond its level 1 range.
- A level 3 synth produces 3 `chain` events with 4 or more enemies close together, and a level 2 synth produces 2.
- A `resolveRules({ upgrades: { kick: [{ costShare: 3, damage: 1 }] } })` game charges `150` and adds 1 damage, which proves the sim reads `this.rules`.

Add to `tests/plans.test.ts`:

- `planBot` buys an upgrade step, waits for money, and skips one with no tower or at max level.
- `recordPlan` returns upgrade steps for a policy with `upgradeAt: 10`.
- `noisyPlan` at rate 1 keeps upgrade steps on the same cell as their place step.

Add to `tests/search.test.ts`:

- `mutatePlan` over 200 seeds, on a plan with upgrade steps: place cells stay unique, every upgrade step's cell has a place step, and no cell has more than 2 upgrade steps.
- `behaviourOf` ignores upgrade steps when counting focus.

Add to `tests/playtest.test.ts`: `spentByType` includes upgrade spending, and a policy with `upgradeAt: 10` reports `upgrades` above 0.

Add to `tests/tiers.test.ts`: strong's `upgradeAt` is from 36 to 60. Casual and competent have `null`.

In `tests/boss-bound.test.ts`:

- Keep the `expected` rows, but pass `resolveRules({ upgrades: { kick: [], hat: [], synth: [] } })`. Those numbers must not change, including `35519` for the full board.
- Add an `upgraded` table with the same layout, using default rules, with values taken from a real run.
- Add a test that every upgraded `boardDamage` is at least the matching old value.
- Add a test that `towerBossDamage` rises from level 1 to level 2 for a kick and for a hat on a cell that reaches the path.

Add to `tests/sprites.test.ts`: `LEVEL_BADGES` rows are rectangular, fit inside 16×16, and only use defined colors.

### 12. Docs

`README.md`:

- Change `**Hat** (35)` to `**Hat** (40)`.
- Replace the sentence that starts `Select **Sell**` with text saying: select **Upgrade** and click a tower to buy its next level, up to level 3, even during a wave. Level 2 costs the tower's price again and level 3 costs twice its price. **Sell** refunds 70% of everything spent on a tower.
- In Controls, change the line to `**1** Kick, **2** Hat, **3** Synth, **4** Sell, **5** Upgrade`.

`AGENTS.md`: change `read tower, enemy, boss leak, chord, and refund values` to `read tower, upgrade, enemy, boss leak, chord, and refund values`, keeping the rule wrapped to about 100 columns.

`docs/references.md`:

- In Visuals, add that a tower's level shows as `LEVEL_BADGES` in its top-left corner, and that the Upgrade pad shows the next price because sideways phones hide `#info`.
- In Playtest harness, say a build plan can hold `upgrade` steps, `Policy.upgradeAt` sets when a policy bot starts buying levels, and `bound.ts` allows every level.

`docs/balance.md`:

- Print the new hashes with this command, and set them in **Status**:

```sh
node --import ./tools/playtest/resolve-ts.mjs --input-type=module -e "import { configHash } from './tools/playtest/rules.ts'; import { DEFAULT_RULES, DIFFICULTIES } from './src/config.ts'; console.log(configHash(DEFAULT_RULES, DIFFICULTIES.hard), configHash(DEFAULT_RULES, DIFFICULTIES.easy));"
```

- Replace the sentence that starts `Everything under [Current results]` with: `**Out of date:** [Current results](#current-results) were measured before tower upgrades, on configs \`4ce87782\` for Hard and \`ddbd5ac2\` for Easy, and will be measured again before this branch is finished. No human playtest has confirmed any of it.` Keep the rest of that paragraph.
- Add a `## Tower upgrades` section directly before `## Targets`, with a table of each tower's level 2 and level 3 effects and prices from `TOWER_UPGRADES`.
- In that section, add: `The scripted bots in \`tests/bots.ts\` never buy upgrades. They measure tower-only play, and the two-thirds board target in \`tests/balance.test.ts\` counts their towers, so spending on levels would change what that target means. Casual and Competent tiers don't buy upgrades either. Strong starts at 36 to 60 towers, chosen per game, and Expert follows its plan.`
- In `## Keeping this file current`, change `Any change to tower, enemy,` to `Any change to tower, upgrade, enemy,`.

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run test:sandbox` exits 0 with no failed tests.
- `node node_modules/vitest/vitest.mjs run tests/balance.test.ts --reporter=verbose --config vitest.sandbox.config.mjs` exits 0 and prints `hard spread result=lost` and `hard chord result=lost`.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/upgrades-smoke.jsonl` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/smoke.json --out playtest-out/upgrades-smoke-search` exits 0, and `playtest-out/upgrades-smoke-search/archive.json` contains `"type": "upgrade"`.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.
- `git diff --quiet -- tests/balance.test.ts tests/balance-docs.test.ts tests/bots.ts tests/fixtures tools/playtest/targets.ts tools/playtest/searches tools/playtest/sweeps package-lock.json package.json` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not run `git add`, `git mv`, `git stash`, or `git reset`.
- Do not touch files outside **Files to touch** except `.handoff/report.md` and `playtest-out/`.
- Do not change any value in `src/config.ts` other than what step 1 adds.
- Do not change `tests/balance.test.ts`.
- `src/render.ts` must not use `arc`, `shadowBlur`, `globalAlpha`, `setLineDash`, `fillText`, or `ctx.scale`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package.json` or `package-lock.json`.

## Out of scope

- Running the five searches, the `boss-cap` sweep, or `playtest:tiers`.
- Retuning upgrade values, `bossHealthCap`, or any other balance value.
- Replacing the expert fixtures.
- New tower types, endless mode, telemetry, and the upgrades page.

## If blocked

If a test in `tests/balance.test.ts` fails, or a step can't be done as written, stop, write what happened to `.handoff/report.md`, and leave the working tree as it is. Do not change values to make a target pass.
