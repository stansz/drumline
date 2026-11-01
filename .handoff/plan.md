# Plan: playtest harness

## Goal

Build the headless harness for automated DrumlineTD playtesting. It runs thousands of seeded bot games in Node worker threads without a browser and writes one JSON line per game. Game values become injectable, so later balance sweeps can change them per game. A new test records the most damage any board can deal to each boss.

This changes no game value and no game behaviour. `new Sim()` must behave exactly as it does now. `tests/balance.test.ts` and `tests/bots.ts` stay unchanged.

## Files to touch

Create:

- `tools/playtest/resolve-ts.mjs`
- `tools/playtest/rules.ts`
- `tools/playtest/bots.ts`
- `tools/playtest/bound.ts`
- `tools/playtest/job.ts`
- `tools/playtest/run.mjs`
- `tools/playtest/same-lines.mjs`
- `tools/playtest/jobs/smoke.json`
- `tests/rules.test.ts`
- `tests/playtest.test.ts`
- `tests/boss-bound.test.ts`

Modify:

- `src/config.ts`
- `src/waves.ts`
- `src/sim.ts`
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `AGENTS.md`
- `README.md`
- `docs/references.md`
- `docs/balance.md`

## Steps

### 1. Add `Rules` to `src/config.ts`

Add this directly after the `ENEMIES` constant:

```ts
// Every game value the sim reads. Balance sweeps pass their own; the game uses DEFAULT_RULES.
export interface Rules {
  towers: Record<TowerType, TowerStats>;
  enemies: Record<EnemyType, EnemyStats>;
  chordBonusPerTower: number;
  chordMaxTowers: number;
  sellRefund: number;
}

export const DEFAULT_RULES: Rules = {
  towers: TOWERS,
  enemies: ENEMIES,
  chordBonusPerTower: CHORD_BONUS_PER_TOWER,
  chordMaxTowers: CHORD_MAX_TOWERS,
  sellRefund: SELL_REFUND,
};
```

Do not remove or rename any existing export. `src/main.ts` and `src/render.ts` keep using the constants.

### 2. Pass enemy stats through `src/waves.ts`

- Add `EnemyStats` to the type imports from `./config`.
- Change the signatures to:

```ts
export function buildWave(
  wave: number,
  difficulty: Difficulty,
  enemies: Record<EnemyType, EnemyStats> = ENEMIES,
): WaveGroup[] {
```

```ts
export function buildWaves(
  difficulty: Difficulty,
  enemies: Record<EnemyType, EnemyStats> = ENEMIES,
): WaveGroup[][] {
```

- Inside `buildWave`, replace both uses of `ENEMIES[type].hp` with `enemies[type].hp`.
- In `buildWaves`, pass `enemies` to `buildWave`.

### 3. Read rules in `src/sim.ts`

- In the `./config` import, remove `CHORD_BONUS_PER_TOWER`, `CHORD_MAX_TOWERS`, `ENEMIES`, `SELL_REFUND`, and `TOWERS`. Add `DEFAULT_RULES` and `type Rules`.
- Add `readonly rules: Rules;` to `Sim`, directly after `readonly difficulty: Difficulty;`.
- Change the constructor to:

```ts
  constructor(difficulty: Difficulty = DIFFICULTIES.hard, rules: Rules = DEFAULT_RULES) {
    this.difficulty = difficulty;
    this.rules = rules;
    this.waves = buildWaves(difficulty, rules.enemies);
```

  Keep the rest of the constructor as it is.

- Replace each remaining use:

| Old | New |
| --- | --- |
| `TOWERS[type].cost` in `placeTower` | `this.rules.towers[type].cost` |
| `TOWERS[tower.type].cost * SELL_REFUND` in `sellTower` | `this.rules.towers[tower.type].cost * this.rules.sellRefund` |
| `CHORD_BONUS_PER_TOWER` in `fireTowers` | `this.rules.chordBonusPerTower` |
| `CHORD_MAX_TOWERS` in `fireTowers` | `this.rules.chordMaxTowers` |
| `TOWERS[tower.type]` in `fireTowers` | `this.rules.towers[tower.type]` |
| `ENEMIES[enemy.type].bounty` in `step` | `this.rules.enemies[enemy.type].bounty` |
| `ENEMIES[enemy.type].speed` in `step` | `this.rules.enemies[enemy.type].speed` |
| `ENEMIES[enemy.type].leak` in `step` | `this.rules.enemies[enemy.type].leak` |

- In the `SimEvent` type, change the `hit` member to:

```ts
  | {
      kind: 'hit';
      x: number;
      y: number;
      towerType: TowerType;
      enemyId: number;
      damage: number;
    }
```

- Add `damage` to all four `kind: 'hit'` pushes in `fireTowers`:
  - kick: `damage: baseDamage`
  - synth target: `damage: baseDamage`
  - synth chain: `damage: baseDamage * 0.5`
  - hat: `damage: baseDamage`

Change nothing else in `src/sim.ts`. The chain falloff of `0.5` and chain gap of `2` stay as literals.

### 4. Project setup

- In `package.json`, add this script after `"build"`:

```json
"playtest": "node --import ./tools/playtest/resolve-ts.mjs tools/playtest/run.mjs"
```

- In `tsconfig.json`, change `"include"` to `["src","tests","tools","vite.config.ts"]`. Change nothing else.
- In `.gitignore`, add a line: `playtest-out/`.

### 5. Create `tools/playtest/resolve-ts.mjs`

Node strips TypeScript types on its own, but needs this hook for extensionless imports.

```js
// Lets Node run the game's TypeScript directly, where imports have no file extension.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});
```

### 6. Create `tools/playtest/rules.ts`

Import from `../../src/config`. Extensionless relative imports are fine in every `.ts` file under `tools/`. Do not import any `node:` module from a `.ts` file, because the project has no Node types. All Node API use stays in the `.mjs` files.

Export:

```ts
export interface RulesPatch {
  towers?: Partial<Record<TowerType, Partial<TowerStats>>>;
  enemies?: Partial<Record<EnemyType, Partial<EnemyStats>>>;
  chordBonusPerTower?: number;
  chordMaxTowers?: number;
  sellRefund?: number;
}

export interface DifficultyPatch {
  startMoney?: number;
  startLives?: number;
  waveBonus?: number;
  healthScale?: number;
  curve?: Partial<WaveCurve>;
}

export function resolveRules(patch?: RulesPatch): Rules;
export function resolveDifficulty(id: DifficultyId, patch?: DifficultyPatch): Difficulty;
export function configHash(rules: Rules, difficulty: Difficulty): string;
```

- `resolveRules` returns a new object with new `towers` and `enemies` records and new stat objects, merged over `DEFAULT_RULES`. It must never mutate `TOWERS` or `ENEMIES`.
- `resolveDifficulty` returns a new object merged over `DIFFICULTIES[id]`, with `curve` merged over that difficulty's `curve`.
- `configHash` is FNV-1a 32-bit over `JSON.stringify({ rules, difficulty })`, returned as 8 lowercase hex characters.

### 7. Create `tools/playtest/bots.ts`

Import `Sim`, `pathCells`, `type Phase`, and `type TowerType` from `../../src/sim`. Import `GRID_COLS`, `GRID_ROWS`, `STEPS_PER_BAR`, and the needed types from `../../src/config`.

Export:

```ts
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BotContext {
  sim: Sim;
  rng: Rng;
}

// All bot randomness comes from ctx.rng, because the sim has none.
export interface Bot {
  build(ctx: BotContext): void;
  onBar?(ctx: BotContext): void;
}

export interface Policy {
  weights: Record<TowerType, number>;
  // Bit n allows columns where col % 4 === n. 15 allows every column.
  classMask: number;
  midWave: boolean;
  earlyBias: number;
  // Picks at random among this many best cells. 1 always takes the best.
  topK: number;
  maxTowersPerWave: number | null;
}

export interface GameResult {
  result: Phase;
  wave: number;
  lives: number;
  money: number;
  towers: number;
  steps: number;
  mix: Record<TowerType, number>;
  livesByWave: number[];
  damageByType: Record<TowerType, number>;
  shots: number;
  chordAverage: number;
  chordCappedShare: number;
  idleNoteShare: number;
}

export function randomPolicy(rng: Rng): Policy;
export function policyBot(policy: Policy, rules: Rules): Bot;
export function playGame(bot: Bot, difficulty: Difficulty, rules: Rules, seed: number): GameResult;
```

`randomPolicy` builds its fields in this order:

- `weights.kick`, `weights.hat`, `weights.synth`: each is `rng() < 0.25 ? 0 : rng()`. If all three are 0, set `weights.hat` to 1.
- `classMask`: `rng() < 0.5 ? 15 : 1 + Math.floor(rng() * 15)`
- `midWave`: `rng() < 0.5`
- `earlyBias`: `rng() < 0.5 ? 0 : rng() * 3`
- `topK`: `1 + Math.floor(rng() * 3)`
- `maxTowersPerWave`: `rng() < 0.25 ? 1 + Math.floor(rng() * 3) : null`

`policyBot` precomputes a coverage table when created. `coverage[type][col][row]` is the number of `pathCells()` entries with `Math.hypot(pathCol - col, pathRow - row) <= rules.towers[type].range`. It keeps a `placedThisWave` counter, which `build` resets to 0 before spending. `build` always spends. `onBar` exists on the returned object and spends only when `policy.midWave` is true.

Spending repeats these steps until one of them stops it:

1. Stop if `maxTowersPerWave` is not null and `placedThisWave` has reached it.
2. Choose a type:

```ts
const total = weights.kick + weights.hat + weights.synth;
let best: TowerType = 'hat';
let bestDeficit = -Infinity;
for (const type of ['kick', 'hat', 'synth'] as const) {
  if (weights[type] === 0) continue;
  const have = sim.towers.filter((tower) => tower.type === type).length;
  const deficit = (weights[type] / total) * (sim.towers.length + 1) - have;
  if (deficit > bestDeficit) {
    bestDeficit = deficit;
    best = type;
  }
}
```

3. Stop if `sim.money` is below that type's cost.
4. Score each cell, looping `col` from 0 and `row` from 0, skipping columns where `(classMask >> (col % 4)) & 1` is 0 and cells where `sim.canPlace` is false:

```ts
coverage[type][col][row] - earlyBias * (row + (row > 2 ? col * 0.2 : 0))
```

5. Stop if there are no cells. With `topK` of 1, take the first cell holding the highest score, without calling `ctx.rng`. Otherwise stable-sort by score, highest first, and take index `Math.floor(ctx.rng() * Math.min(topK, cells.length))`.
6. Call `sim.placeTower`. Stop if it returns false. Otherwise add 1 to `placedThisWave`.

`playGame` runs exactly this loop:

```ts
const sim = new Sim(difficulty, rules);
const ctx: BotContext = { sim, rng: makeRng(seed) };
while (sim.phase !== 'won' && sim.phase !== 'lost') {
  bot.build(ctx);
  if (sim.phase === 'build') sim.startWave();
  while (sim.phase === 'wave') {
    if (bot.onBar && sim.totalSteps % STEPS_PER_BAR === 0) bot.onBar(ctx);
    // tally sim.step() here
    if (sim.totalSteps >= MAX_STEPS) throw new Error(`game exceeded ${MAX_STEPS} steps`);
  }
  livesByWave.push(sim.lives);
}
```

`MAX_STEPS` is `200000`. Tally the events from each `sim.step()`:

- `hit`: add `event.damage` to `damageByType[event.towerType]`.
- `shot`: add 1 to `shots`. Add `1 + rules.chordBonusPerTower * (Math.min(event.chordSize, rules.chordMaxTowers) - 1)` to a running total. Count it as capped when `event.chordSize >= rules.chordMaxTowers`.
- `note`: count it, and count it again as idle when `event.hit` is false.

`chordAverage` is the running total divided by `shots`. `chordCappedShare` is capped shots divided by `shots`. `idleNoteShare` is idle notes divided by all notes. Each is 0 when its divisor is 0. `mix` counts `sim.towers` by type at the end of the game.

### 8. Create `tools/playtest/bound.ts`

Import `firesThisStep`, `pathCells`, `pathLength`, `pathPoint`, and `type TowerType` from `../../src/sim`. Import `buildWaves` from `../../src/waves`. Import `GRID_COLS`, `GRID_ROWS`, `STEPS_PER_BAR`, and the needed types from `../../src/config`.

Start the file with this comment:

```ts
// The most damage any static board can deal to a boss. It is generous on purpose: every earlier
// enemy pays its bounty, nothing is spent on earlier waves, every shot gets the capped chord
// bonus, and no shot goes to another enemy. A boss above this limit can't be killed by a
// static board.
```

Export:

```ts
export interface BossBound {
  wave: number;
  bossHp: number;
  income: number;
  boardDamage: number;
  picks: Record<TowerType, number>;
  fullBoardDamage: number;
}

export function bossWaves(difficulty: Difficulty): number[];
export function maxIncomeBefore(wave: number, difficulty: Difficulty, rules: Rules): number;
export function towerBossDamage(type: TowerType, col: number, row: number, rules: Rules): number;
export function bossBound(wave: number, difficulty: Difficulty, rules: Rules): BossBound;
```

- `bossWaves` returns each wave number whose groups in `buildWaves(difficulty)` include a `boss`.
- `maxIncomeBefore` starts at `difficulty.startMoney`. For each wave from 1 to `wave - 1`, it adds `rules.enemies[group.type].bounty * group.count` for each group, plus `difficulty.waveBonus`. Wave groups come from `buildWaves(difficulty, rules.enemies)`.
- `towerBossDamage` walks the boss exactly as the sim does: `progress` and `step` start at 0. While `progress < pathLength()`, if `firesThisStep(type, col, step % STEPS_PER_BAR)` and the boss at `pathPoint(progress)` is within the tower's range, add `damage * (1 + chordBonusPerTower * (chordMaxTowers - 1))`. Then add `rules.enemies.boss.speed` to `progress` and 1 to `step`.
- `bossBound` lists every cell that is in the grid and not in `pathCells()`, with its damage for each tower type.
  - `fullBoardDamage` sums each cell's highest damage across the three types, ignoring money.
  - `boardDamage` is an exact multiple-choice knapsack: at most one tower per cell, budget `income`. Use the greatest common divisor of the three tower costs as the unit, with capacity `Math.floor(income / unit)`. Use a `Float64Array` for best damage, and keep one `Int8Array` per cell recording the chosen type so `picks` can be read back.
  - `bossHp` is the `boss` group's `hp` for that wave.

### 9. Create `tools/playtest/job.ts`

Export:

```ts
export interface Job {
  id: string;
  difficulty: DifficultyId;
  seed: number;
  games: number;
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
}

export function gameSeed(job: Job, index: number): number;
export function runGame(job: Job, index: number): string;
```

- `gameSeed` returns `(job.seed + Math.imul(index, 0x9e3779b1)) | 0`.
- `runGame` resolves the rules and difficulty, then does this:

```ts
const seed = gameSeed(job, index);
const policy = randomPolicy(makeRng(seed));
const result = playGame(policyBot(policy, rules), difficulty, rules, seed ^ 0x5bd1e995);
```

It returns `JSON.stringify` of an object with these keys, in this order: `job`, `index`, `config`, `seed`, `policy`, then every `GameResult` field. `job` is `job.id`, and `config` is `configHash(rules, difficulty)`. Do not include a timestamp or any other value that changes between runs.

Resolve rules and difficulty once per job, not once per game. Cache them in a module-level `Map` keyed by `job.id`.

### 10. Create `tools/playtest/run.mjs`

This is plain JavaScript and imports `./job.ts` by its full name.

Arguments: `--job <path>` and `--out <path>` are required. `--workers <n>` defaults to `os.availableParallelism()`. `--start <i>` defaults to 0, and `--end <j>` defaults to `job.games`. Exit 1 with a usage message on stderr if a required argument is missing.

Main thread:

- Read and parse the job file.
- Create the output's parent directory with `mkdirSync(..., { recursive: true })`, and open the output with `openSync(path, 'w')`.
- Split `[start, end)` into `workers` contiguous ranges of near-equal size, skipping empty ranges.
- Start one `new Worker(fileURLToPath(import.meta.url), { workerData: { job, start, end } })` per range. Workers inherit `--import` by default, so do not pass `execArgv`.
- On each `message`, a string of complete lines, call `writeSync` on the output.
- On a worker `error` event, print the error to stderr and call `process.exit(1)`.
- When all workers have exited, close the file and print exactly one line to stdout:

```text
games=<n> workers=<n> seconds=<s.s> gamesPerSecond=<n>
```

Worker thread, when `isMainThread` is false: for each index in its range, call `runGame`, collect lines, and `parentPort.postMessage(lines.join('\n') + '\n')` every 100 games and at the end.

### 11. Create `tools/playtest/same-lines.mjs`

`node tools/playtest/same-lines.mjs <first> <rest...>` compares the file `<first>` with the combined lines of every `<rest>` file. Read each file, split into non-empty lines, and sort both lists. If they match, print `same <line count>` and exit 0. Otherwise print `different` and exit 1.

### 12. Create `tools/playtest/jobs/smoke.json`

```json
{ "id": "smoke-hard", "difficulty": "hard", "seed": 1, "games": 200 }
```

### 13. Add the tests

Create `tests/rules.test.ts`:

- `DEFAULT_RULES.towers` is `TOWERS` and `DEFAULT_RULES.enemies` is `ENEMIES`, using `toBe`.
- `new Sim().rules` is `DEFAULT_RULES`, using `toBe`.
- `buildWaves(DIFFICULTIES.hard)` equals `buildWaves(DIFFICULTIES.hard, ENEMIES)`.
- A `Sim` given `resolveRules({ towers: { kick: { cost: 10 } } })` charges 10 for a kick.
- A `Sim` given `resolveRules({ sellRefund: 0.5 })` refunds `Math.floor(cost * 0.5)`.
- A `Sim` given `resolveRules({ enemies: { blip: { hp: 60 } } })` builds waves with different blip health from the default.
- `resolveRules({ towers: { kick: { damage: 99 } } })` leaves `TOWERS.kick.damage` at 12.
- Hit damage: with one synth and three enemies pushed into `sim.enemies` close together in its range, stepping until it fires gives `hit` damages of 14, 7, and 7. Follow the setup style of `tests/attacks.test.ts`. Set `sim.phase = 'wave'` if the test needs it.
- Chord damage: with two towers firing on the same step, each `hit` event's `damage` is 1.25 times that tower's base damage.

Create `tests/playtest.test.ts`. Define `const base = (kick, hat, synth): Policy` with `classMask: 15`, `midWave: false`, `earlyBias: 0`, `topK: 1`, and `maxTowersPerWave: null`.

- `playGame(policyBot(base(1, 1, 1), rules), hard, rules, 1)` gives `result` `lost`, `wave` 28, `towers` 56, and `mix` `{ kick: 19, hat: 19, synth: 18 }`.
- The same on Easy gives `result` `won`, `lives` 10, `towers` 75, and `mix` `{ kick: 25, hat: 25, synth: 25 }`.
- `base(0, 1, 0)` on Hard gives `result` `lost`, `wave` 25, and `towers` 70.
- `runGame(job, 7)` called twice returns the same string.
- `runGame(job, 7)` and `runGame(job, 8)` return different strings.
- `resolveRules({ chordMaxTowers: 5 })` gives a different `configHash` from `resolveRules()`.
- A policy with `topK: 5` gives different `towers` placements under two seeds. Compare by running `new Sim(DIFFICULTIES.hard)` through `bot.build` directly.
- With `maxTowersPerWave: 1` and `midWave: true`, `result.towers` is at most `result.wave`.
- For `base(1, 1, 1)` on Hard, every `damageByType` value is above 0, and `chordAverage` is between 1 and 1.75.

Create `tests/boss-bound.test.ts`. In all of these, use `Math.round` on damage values.

```ts
const expected = [
  ['hard', 10, 1862, 814, 6321],
  ['hard', 20, 8350, 1879, 12056],
  ['hard', 30, 29997, 3256, 16679],
  ['easy', 10, 1303, 1044, 7691],
  ['easy', 20, 5845, 2309, 13636],
  ['easy', 30, 20998, 3886, 18247],
] as const;
```

- For each row of `[difficulty, wave, bossHp, income, boardDamage]`, `bossBound` returns those values.
- `fullBoardDamage` rounds to 21487.
- `bossWaves(DIFFICULTIES.hard)` equals `[10, 20, 30]`.
- `boardDamage >= bossHp` for the wave 10 and wave 20 bosses on both difficulties, as ordinary `it` tests.
- `it.fails('a full-income board can kill the wave 30 boss on hard', ...)` asserts `boardDamage >= bossHp`.
- `it.fails('a full-income board can kill the wave 30 boss on easy', ...)` asserts the same.
- `it.fails('a full board of synths beats hard', ...)` uses `new Sim({ ...DIFFICULTIES.hard, startMoney: 1e7 })`, places a synth on every cell where `canPlace` is true, starts waves until the game ends without any more placements, and asserts `sim.phase` is `won`.

Add this comment above the three `it.fails` tests:

```ts
// Known balance bug: these bosses can't be killed. Remove `.fails` when boss health is fixed.
```

### 14. Update the docs

In `AGENTS.md`:

- Add `npm run playtest` to the command list in the second paragraph.
- Add these rules after the `Keep src/sim.ts free` rule:

```md
- In `src/sim.ts`, read tower, enemy, chord, and refund values from `this.rules`, not the config
  constants, so balance sweeps can change them per game.
- Keep `tools/playtest/` free of browser APIs, and keep Node APIs in its `.mjs` files.
```

- Add this to the **Read before changing** list:

```md
- Playtest harness: [docs/references.md](docs/references.md)
```

In `README.md`, add `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/smoke.jsonl` to the `## Commands` code block, after `npm run build`.

In `docs/references.md`:

- In **Files**, add after the `tests/bots.ts` entry:

```md
- `tools/playtest/`: headless balance harness. See [Playtest harness](#playtest-harness).
```

- Change the `src/config.ts` entry to also list `DEFAULT_RULES`.
- Add this section before `## Saved settings`:

````md
## Playtest harness

`tools/playtest/` plays seeded bot games in Node worker threads, with no browser or build step.
The sim has no randomness, so the same bot always gets the same result. Each game therefore uses a
different seeded policy, and all bot randomness stays in the bot.

```sh
npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/smoke.jsonl
```

- A job file sets `id`, `difficulty`, `seed`, and `games`, with optional `rules` and
  `difficultyPatch` changes to game values.
- The output has one JSON line per game. `config` is a hash of the resolved values, so results
  from different configs can't be mixed by mistake.
- `--workers` sets the thread count. `--start` and `--end` run part of a job, so it can be split
  across machines. Combined shards match a single run line for line once sorted, which
  `tools/playtest/same-lines.mjs` checks.
- `Sim` takes a `Rules` object as its second argument. `resolveRules` and `resolveDifficulty` in
  `tools/playtest/rules.ts` build changed copies without touching the config constants.
- `tools/playtest/bound.ts` works out the most damage any static board can deal to a boss.
- A new bot implements `Bot` from `tools/playtest/bots.ts`, and takes randomness only from
  `ctx.rng`.
````

In `docs/balance.md`, add this as the first item under `## Open questions`:

```md
- **Final bosses can't be killed:** on Hard, the wave 30 boss has 29,997 HP, while a board bought
  with all the money the game pays out deals at most 16,679 damage to it. Even 85 synths with
  unlimited money deal about 20,000 and lose. Easy's boss has 20,998 HP against a 18,247 limit, so
  Easy wins depend on it leaking. Boss health grows with the wave budget, but board damage is
  capped by the 85 buildable cells. `tests/boss-bound.test.ts` records this with `it.fails`.
```

Change nothing else in `docs/balance.md`.

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/one.jsonl --workers 1` exits 0 and prints a line starting `games=200 workers=1`.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/four.jsonl --workers 4` exits 0 and prints a line starting `games=200 workers=4`.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/s1.jsonl --workers 2 --start 0 --end 120` exits 0.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/s2.jsonl --workers 2 --start 120 --end 200` exits 0.
- `node tools/playtest/same-lines.mjs playtest-out/one.jsonl playtest-out/four.jsonl` prints `same 200`.
- `node tools/playtest/same-lines.mjs playtest-out/one.jsonl playtest-out/s1.jsonl playtest-out/s2.jsonl` prints `same 200`.
- `git grep -nE "\b(TOWERS|ENEMIES|SELL_REFUND|CHORD_BONUS_PER_TOWER|CHORD_MAX_TOWERS)\b" -- src/sim.ts` prints nothing.
- `git diff --quiet -- src/main.ts src/render.ts tests/balance.test.ts tests/bots.ts tests/sim.test.ts tests/waves.test.ts tests/attacks.test.ts package-lock.json` exits 0.
- `git status --porcelain -- playtest-out` prints nothing.

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
- Do not add dependencies, and do not change `package-lock.json`.
- Do not change any game value, wave, or balance target.
- Do not use `Math.random`, `Date.now`, or the current time in `src/sim.ts`, `tools/playtest/bots.ts`, or `tools/playtest/job.ts`.
- Do not change the `spawn EPERM`-related rule in `AGENTS.md`.

## Out of scope

- Fixing boss health or any other balance change.
- MAP-Elites, genetic search, or skill tiers.
- Reports or charts built from the JSONL output.
- Novita or any remote execution.
- Browser replay checks.
- Moving towers during a wave as a bot strategy.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
