# Plan: per-wave metrics, strategy search, and skill tiers

## Goal

Add three playtest tools. None of them changes the game.

- **Per-wave metrics:** reports show where runs lose lives and die, and how much damage each tower type deals per dollar.
- **Strategy search:** a MAP-Elites search over ordered build plans. It keeps the best build for each style of play, and its best build is the expert ceiling.
- **Skill tiers:** Casual, Competent, Strong, and Expert bots, with seeded mistakes, give win-rate distributions.

## Files to touch

Create:

- `tools/playtest/plans.ts`
- `tools/playtest/search.ts`
- `tools/playtest/search-pool.mjs`
- `tools/playtest/search-worker.mjs`
- `tools/playtest/search-cli.mjs`
- `tools/playtest/tiers.ts`
- `tools/playtest/tiers-cli.mjs`
- `tools/playtest/searches/smoke.json`
- `tools/playtest/searches/hard.json`
- `tools/playtest/searches/easy.json`
- `tools/playtest/searches/hard-no-kick.json`
- `tools/playtest/searches/hard-no-hat.json`
- `tools/playtest/searches/hard-no-synth.json`
- `tests/plans.test.ts`
- `tests/search.test.ts`
- `tests/tiers.test.ts`

Modify:

- `tools/playtest/bots.ts`
- `tools/playtest/job.ts`
- `tools/playtest/report.ts`
- `tools/playtest/report-cli.mjs`
- `tests/report.test.ts`
- `tests/propose.test.ts`
- `package.json`
- `AGENTS.md`
- `README.md`
- `docs/references.md`
- `docs/balance.md`

## Steps

### 1. Extend `GameResult` in `tools/playtest/bots.ts`

Add these fields directly after `finalBossWave`:

```ts
  startLives: number;
  spentByType: Record<TowerType, number>;
  finalWaveProgress: number;
```

In `playGame`:

- Add `let waveDamage = 0;` beside the other counters.
- Set `waveDamage = 0;` on the line after `if (sim.phase === 'build') sim.startWave();`.
- In the `hit` branch, add `event.damage` to `waveDamage`.
- After the main loop, work out the new fields:

```ts
  const spentByType: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  for (const tower of sim.towers) spentByType[tower.type] += rules.towers[tower.type].cost;

  const waveHealth = (sim.waves[sim.wave - 1] ?? []).reduce(
    (sum, group) => sum + group.hp * group.count,
    0,
  );
  const finalWaveProgress = waveHealth === 0 ? 0 : Math.min(1, waveDamage / waveHealth);
```

- Return `startLives: difficulty.startLives`, `spentByType`, and `finalWaveProgress`.

### 2. Add per-wave metrics to `tools/playtest/report.ts`

Add to `Summary`:

```ts
  damagePerDollar: Record<TowerType, number>;
  byWave: WaveStats[];
```

Export:

```ts
export interface WaveStats {
  wave: number;
  reached: number;
  deaths: number;
  meanLivesLost: number;
}

export function formatWaveTable(summary: Summary): string;
```

In `summarize`:

- `damagePerDollar[type]` is the summed `damageByType[type]` across games, divided by the summed `spentByType[type]`. It is 0 when nothing was spent.
- `byWave` has one entry for each wave from 1 to the highest `wave` in the records.
  - `reached` counts records with `record.wave >= wave`.
  - `deaths` is `deathsByWave[String(wave)] ?? 0`.
  - `meanLivesLost` is the mean, across reached records, of the lives lost in that wave. For wave 1 that is `startLives - livesByWave[0]`. For later waves it is `livesByWave[wave - 2] - livesByWave[wave - 1]`.

Add these rows to the end of `summaryRows`, shown to 2 decimal places: `Kick damage per dollar`, `Hat damage per dollar`, and `Synth damage per dollar`.

`formatWaveTable` returns a Markdown table with columns `Wave`, `Reached`, `Deaths`, and `Mean lives lost`, with the last shown to 2 decimal places.

In `tools/playtest/report-cli.mjs`, when `--compare` is not set, print `formatSummary`, then an empty line, then `formatWaveTable`. Change nothing else there.

### 3. Create `tools/playtest/plans.ts`

Export:

```ts
export interface PlanStep {
  type: TowerType;
  col: number;
  row: number;
}

export type BuildPlan = PlanStep[];

export function buildableCells(): Array<[number, number]>;
export function planBot(plan: BuildPlan): Bot;
export function recordPlan(
  policy: Policy,
  difficulty: Difficulty,
  rules: Rules,
  seed: number,
): BuildPlan;
export function noisyPlan(plan: BuildPlan, rng: Rng, rate: number): BuildPlan;
```

- `buildableCells` returns every grid cell not in `pathCells()`, looping `col` from 0 and `row` from 0. Cache it in a module-level constant.
- `planBot` keeps a `next` index, starting at 0. Its `build` and `onBar` both run this loop:

```ts
while (next < plan.length) {
  const step = plan[next];
  if (!step) return;
  if (!sim.canPlace(step.col, step.row)) {
    next += 1;
    continue;
  }
  if (sim.money < sim.rules.towers[step.type].cost) return;
  sim.placeTower(step.type, step.col, step.row);
  next += 1;
}
```

- `recordPlan` wraps `policyBot(policy, rules)` in a `Bot` that stores `ctx.sim` in `build`, calls `playGame` with that wrapper, and returns `sim.towers` as `{ type, col, row }` steps, in order. Bots here never sell, so that is purchase order.
- `noisyPlan` copies the plan, then loops over each index in ascending order. If `rng() < rate`, then:
  - if `rng() < 0.5` and a next step exists, swap this step with the next step;
  - otherwise, move this step to a random cell from `buildableCells()` that no step in the copy uses, if one exists.

### 4. Create `tools/playtest/search.ts`

Export:

```ts
export interface SearchConfig {
  id: string;
  difficulty: DifficultyId;
  seed: number;
  initial: number;
  generations: number;
  batch: number;
  bannedTowers?: TowerType[];
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
}

export interface Behaviour {
  kickBin: number;
  synthBin: number;
  focusBin: number;
}

export interface Evaluation {
  score: number;
  won: boolean;
  wave: number;
  lives: number;
  towers: number;
  mix: Record<TowerType, number>;
  damageByType: Record<TowerType, number>;
  behaviour: Behaviour;
}

export interface Elite extends Evaluation {
  key: string;
  plan: BuildPlan;
}

export type Archive = Map<string, Elite>;

export interface WaveHeadroom {
  wave: number;
  multiplier: number | null;
}

export interface SearchOutput {
  id: string;
  difficulty: DifficultyId;
  config: string;
  games: number;
  elites: Elite[];
  headroom: WaveHeadroom[];
}

export const HEADROOM_MULTIPLIERS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5];

export function planScore(result: GameResult, difficulty: Difficulty): number;
export function behaviourOf(plan: BuildPlan, result: GameResult): Behaviour;
export function evaluatePlan(plan: BuildPlan, difficulty: Difficulty, rules: Rules): Evaluation;
export function insertElite(archive: Archive, plan: BuildPlan, evaluation: Evaluation): boolean;
export function initialPolicy(config: SearchConfig, index: number): { policy: Policy; seed: number };
export function mutatePlan(plan: BuildPlan, rng: Rng, config: SearchConfig): BuildPlan;
export function childPlans(archive: Archive, rng: Rng, config: SearchConfig): BuildPlan[];
export function sortedElites(archive: Archive): Elite[];
export function bestElite(elites: Elite[]): Elite;
export function headroomByWave(plan: BuildPlan, difficulty: Difficulty, rules: Rules): WaveHeadroom[];
export function formatSearchReport(output: SearchOutput): string;
```

`planScore`:

```ts
if (result.result === 'won') return result.wave + result.lives / difficulty.startLives;
return result.wave - 1 + result.finalWaveProgress;
```

`behaviourOf`:

- `kickBin` is `Math.min(4, Math.floor(share * 5))`, where `share` is `spentByType.kick` over all spending. `synthBin` does the same with `spentByType.synth`. Both are 0 when nothing was spent.
- `focusBin` uses `plan.slice(0, result.towers)`. Let `focus` be the largest share of those towers with the same `col % 4`. `focusBin` is 0 if `focus < 0.4`, 1 if `focus < 0.6`, otherwise 2. It is 0 with no towers.

`evaluatePlan` calls `playGame(planBot(plan), difficulty, rules, 0)`, and builds an `Evaluation` from the result, with `won` true when `result.result === 'won'`.

`insertElite` uses the key `${kickBin}-${synthBin}-${focusBin}`. It stores the elite if the key is empty or the new score is strictly higher, and returns whether it stored it.

`initialPolicy`:

```ts
const seed = (config.seed + Math.imul(index, 0x9e3779b1)) | 0;
const policy = randomPolicy(makeRng(seed));
```

Then set the weight of each type in `bannedTowers` to 0. If all three weights are then 0, set the first allowed type in the order kick, hat, synth to 1.

`mutatePlan` copies the plan and applies `1 + Math.floor(rng() * 3)` operations. Each picks one of these six at random. An operation that can't apply, for example on an empty plan or with no free cell, does nothing. A free cell is one from `buildableCells()` that no step in the copy uses. An allowed type is one not in `bannedTowers`.

| Operation | Effect |
| --- | --- |
| `changeType` | Give a random step a random allowed type |
| `moveCell` | Move a random step to a random free cell |
| `swapOrder` | Swap step `i` with step `Math.min(length - 1, i + 1 + Math.floor(rng() * 5))` |
| `insertStep` | Insert a step with a random allowed type and free cell at a random index |
| `deleteStep` | Delete a random step |
| `appendSteps` | Append `1 + Math.floor(rng() * 4)` steps, each with a random allowed type and free cell |

`childPlans` returns `config.batch` plans. For each, it takes a random elite from `sortedElites(archive)` and calls `mutatePlan` on its plan.

`sortedElites` sorts by `key`. `bestElite` returns the highest `score`, using the lowest `key` to break ties, and throws on an empty list.

`headroomByWave`:

- For each multiplier, run `playGame(planBot(plan), { ...difficulty, healthScale: difficulty.healthScale * multiplier }, rules, 0)`.
- Waves cleared is `difficulty.curve.waves` for a win, otherwise `result.wave - 1`.
- Return one entry per wave. `multiplier` is the highest multiplier that cleared that wave, or null if none did.

`formatSearchReport` returns Markdown in this order:

1. `# Search: <id>`, then a line giving the difficulty, `config`, games, cells filled, and how many cells hold a winning build.
2. `## Best build`, with its score, wave, lives, towers, kick/hat/synth counts, and damage share by type.
3. `## Styles`, with one table per `focusBin`, under the headings `### Chord focus: spread`, `### Chord focus: mixed`, and `### Chord focus: focused`. Rows are the kick spending bins and columns are the synth spending bins, labelled `0–19%`, `20–39%`, `40–59%`, `60–79%`, and `80–100%`. Each cell shows the score to 1 decimal place, prefixed `W ` for a win, or `-` when empty.
4. `## Top cells`, a table of the 5 highest scores, with columns `Key`, `Score`, `Wave`, `Lives`, and `K/H/S`.
5. `## Headroom`, a table of the best build's `headroom`, with columns `Wave` and `Highest health multiplier cleared`. Show null as `-`.

### 5. Create the search pool and worker

`tools/playtest/search-worker.mjs` receives `workerData` of `{ difficulty, rules }`, and listens with `parentPort.on('message', ...)` for `{ id, kind, items }`:

- `kind: 'record'`: `items` are `{ policy, seed }`. Each result is `recordPlan(policy, difficulty, rules, seed ^ 0x5bd1e995)`.
- `kind: 'evaluate'`: `items` are plans. Each result is `evaluatePlan(plan, difficulty, rules)`.

It replies with `{ id, results }`.

`tools/playtest/search-pool.mjs` exports `createPool({ difficulty, rules, workers })`, returning `{ run(kind, items), close() }`.

- `run` splits `items` into `Math.min(workers, items.length)` contiguous chunks of near-equal size, sends one chunk to each worker, and resolves to all results in the original order. It resolves to `[]` for no items.
- `close` calls `terminate` on every worker.
- A worker `error` event rejects any waiting `run`.
- Start workers with `new Worker(new URL('./search-worker.mjs', import.meta.url), { workerData })`.

### 6. Create `tools/playtest/search-cli.mjs`

Arguments: `--search <path>` and `--out <dir>` are required. `--workers <n>` defaults to `availableParallelism()` and must be at least 1. Use `parseFlags` and `parseCount`. Print any error to stderr and exit 1.

```text
rules = resolveRules(config.rules)
difficulty = resolveDifficulty(config.difficulty, config.difficultyPatch)
archive = new Map()
rng = makeRng(config.seed ^ 0x2545f491)
games = 0

plans = await pool.run('record', indices 0..initial-1 mapped through initialPolicy)
games += initial
evaluations = await pool.run('evaluate', plans)
games += plans.length
insert each plan and evaluation, in order

repeat config.generations times:
  plans = childPlans(archive, rng, config)
  evaluations = await pool.run('evaluate', plans)
  games += plans.length
  insert each plan and evaluation, in order
```

Then:

- Close the pool.
- Get `elites` from `sortedElites`, and `best` from `bestElite`.
- Get `headroom` from `headroomByWave(best.plan, difficulty, rules)`.
- Build a `SearchOutput` with `config: configHash(rules, difficulty)`.
- Create `--out` with `mkdirSync(..., { recursive: true })`.
- Write `<out>/archive.json` as `JSON.stringify(output, null, 2) + '\n'`.
- Write `<out>/best-plan.json` as `JSON.stringify({ difficulty: config.difficulty, score: best.score, plan: best.plan }, null, 2) + '\n'`.
- Write `<out>/report.md` from `formatSearchReport(output)`.
- Print exactly one line: `search: <id> games=<n> cells=<n> best=<score to 2 decimals> won=<yes or no>`.

No output file may hold a timestamp, duration, or worker count.

### 7. Create `tools/playtest/tiers.ts`

```ts
export type Tier = 'casual' | 'competent' | 'strong' | 'expert';
export type PolicyTier = Exclude<Tier, 'expert'>;

export const EXPERT_NOISE = 0.05;

const TIER_SETTINGS: Record<
  PolicyTier,
  { maxTowersPerWave: number | null; topK: number; midWave: boolean }
> = {
  casual: { maxTowersPerWave: 1, topK: 6, midWave: false },
  competent: { maxTowersPerWave: 3, topK: 3, midWave: false },
  strong: { maxTowersPerWave: null, topK: 2, midWave: true },
};

export function tierPolicy(tier: PolicyTier, rng: Rng): Policy;
export function formatTierTable(rows: Array<{ tier: Tier; summary: Summary }>): string;
```

`tierPolicy` returns the tier's settings, with `classMask: 15`, `earlyBias: 0`, and each of the three weights set to `0.2 + rng()`, in the order kick, hat, synth.

`formatTierTable` returns a Markdown table with columns `Tier`, `Games`, `Win rate`, `Clean win rate`, `Wave p10`, `Wave p50`, and `Wave p90`.

### 8. Add tier and plan bots to `tools/playtest/job.ts`

Add to `Job`:

```ts
  bot?:
    | { kind: 'tier'; tier: PolicyTier }
    | { kind: 'plan'; plan: BuildPlan; noise: number };
```

Change `policy: Policy;` in `GameRecord` to `policy: Policy | null;`.

In `runGame`, keep `const seed = gameSeed(job, index);`, then choose the bot:

- No `job.bot`: keep today's behaviour exactly, so existing job output doesn't change.
- `kind: 'tier'`: `const rng = makeRng(seed);`, `policy = tierPolicy(job.bot.tier, rng);`, and `policyBot(policy, rules)`.
- `kind: 'plan'`: `policy = null`, and `planBot(noisyPlan(job.bot.plan, makeRng(seed), job.bot.noise))`.

All three call `playGame` with `seed ^ 0x5bd1e995`.

### 9. Create `tools/playtest/tiers-cli.mjs`

Arguments: `--plan <path>`, `--games <n>`, `--seed <n>`, and `--out <dir>` are required. `--workers <n>` defaults to `availableParallelism()` and must be at least 1. Use `parseFlags` and `parseCount`. Print any error to stderr and exit 1.

Read `difficulty` and `plan` from the `--plan` file. Run one job at a time with `runJob`, in the order casual, competent, strong, expert. Use id `tiers-<difficulty>-<tier>`, the given `seed` and `games`, and `start: 0`, `end: games`. The expert job's `bot` is `{ kind: 'plan', plan, noise: EXPERT_NOISE }`.

Write each job to `<out>/<id>.jsonl`, read it back, and call `summarize`. Write `<out>/tiers.md` holding a `# Tiers: <difficulty>` heading, `formatTierTable`, then a `## <tier>` section with `formatWaveTable` for each tier. Print exactly one line: `tiers: <difficulty> <path to tiers.md>`.

### 10. Add the search files

`tools/playtest/searches/smoke.json`:

```json
{ "id": "smoke", "difficulty": "hard", "seed": 21, "initial": 40, "generations": 3, "batch": 20 }
```

`tools/playtest/searches/hard.json`:

```json
{ "id": "hard", "difficulty": "hard", "seed": 21, "initial": 2000, "generations": 100, "batch": 500 }
```

`tools/playtest/searches/easy.json`:

```json
{ "id": "easy", "difficulty": "easy", "seed": 21, "initial": 2000, "generations": 100, "batch": 500 }
```

`tools/playtest/searches/hard-no-kick.json`:

```json
{ "id": "hard-no-kick", "difficulty": "hard", "seed": 21, "initial": 2000, "generations": 100, "batch": 500, "bannedTowers": ["kick"] }
```

Create `hard-no-hat.json` and `hard-no-synth.json` the same way, with id `hard-no-hat` and `["hat"]`, and id `hard-no-synth` and `["synth"]`.

### 11. Add npm scripts

In `package.json`, add these after `"playtest:sweep"`:

```json
"playtest:search": "node --import ./tools/playtest/resolve-ts.mjs tools/playtest/search-cli.mjs",
"playtest:tiers": "node --import ./tools/playtest/resolve-ts.mjs tools/playtest/tiers-cli.mjs"
```

### 12. Update and add tests

In `tests/report.test.ts`:

- Add `startLives: 20`, `spentByType: { kick: 0, hat: 0, synth: 0 }`, and `finalWaveProgress: 0` to the `record` fixture.
- Add a test that `damagePerDollar` is damage over spending, and is 0 with no spending.
- Add a test for `byWave`, using two records with `startLives: 20` and hand-written `livesByWave`, checking `reached`, `deaths`, and `meanLivesLost`.
- Add a test that `formatWaveTable` contains `| Wave | Reached | Deaths | Mean lives lost |`.

In `tests/propose.test.ts`, add `damagePerDollar: { kick: 0, hat: 0, synth: 0 }` and `byWave: []` to the `summary` fixture.

Create `tests/plans.test.ts`:

- `buildableCells()` has 85 entries.
- `planBot` buys steps in order and stops at the first it can't afford. Use a `Sim` with `startMoney: 100` and a plan of a kick (50), a synth (70), then a hat (35): after `build`, only the kick is placed.
- `planBot` skips a step whose cell is already taken.
- `planBot` buys more on `onBar` once there is money.
- `recordPlan` for `base(1, 1, 1)`, with the same policy fixture as `tests/playtest.test.ts`, returns 56 steps on Hard.
- `noisyPlan` at rate 0 returns an equal plan.
- `noisyPlan` at rate 1 returns a plan with unique cells, all from `buildableCells()`.

Create `tests/search.test.ts`:

- `planScore` gives `wave + lives / startLives` for a win, and `wave - 1 + finalWaveProgress` for a loss.
- `behaviourOf` works out all three bins. Include all towers in one `col % 4` giving `focusBin` 2, and an empty plan giving 0 bins.
- `insertElite` stores a new key, replaces on a higher score, and keeps the old elite on an equal or lower score.
- `mutatePlan` keeps cells unique over 200 runs, only uses buildable cells, and never uses a banned type.
- `mutatePlan` gives the same result for the same seed.
- `initialPolicy` gives 0 weight to a banned type, and at least one positive weight when two types are banned.
- `bestElite` breaks ties with the lowest key, and throws on an empty list.
- `headroomByWave` returns 30 entries for a recorded `base(1, 1, 1)` Hard plan, and wave 1's multiplier is not null.
- `formatSearchReport` contains `## Best build`, `### Chord focus: focused`, and `## Headroom`.

Create `tests/tiers.test.ts`:

- `tierPolicy('casual', rng)` has `maxTowersPerWave` 1 and `topK` 6.
- `tierPolicy('strong', rng)` has a null `maxTowersPerWave` and `midWave` true.
- All three weights are at least 0.2.
- `runGame` with `bot: { kind: 'tier', tier: 'casual' }` is deterministic, and its record has at most `wave` towers.
- `runGame` with `bot: { kind: 'plan', plan, noise: 0 }` has `policy` null.
- `formatTierTable` contains `| Tier | Games | Win rate |`.

### 13. Update the docs

In `AGENTS.md`, add `npm run playtest:search` and `npm run playtest:tiers` to the commands sentence.

In `README.md`, add these to the `## Commands` code block, after the last playtest line:

```sh
npm run playtest:search -- --search tools/playtest/searches/hard.json --out playtest-out/search-hard
npm run playtest:tiers -- --plan playtest-out/search-hard/best-plan.json --games 200 --seed 1 --out playtest-out/tiers-hard
```

In `docs/references.md`, add these bullets at the end of the **Playtest harness** list:

```md
- `npm run playtest:search` runs a MAP-Elites search over build plans, which are ordered lists of
  towers to buy. It keeps the best plan for each style, where a style is the share of money spent
  on kicks and synths, plus how many towers share a `col % 4` class. A search file can set
  `bannedTowers`, which shows how much a tower is worth. It writes `report.md`, `archive.json`,
  and `best-plan.json`.
- `npm run playtest:tiers` runs Casual, Competent, Strong, and Expert bots and writes `tiers.md`.
  Expert replays a search's best plan with seeded mistakes.
```

In `docs/balance.md`, add this to the end of the **Proposing a change** section:

```md
The strategy search and skill tiers show what strong play can do, and where each tier loses. Their
targets aren't in `tools/playtest/targets.ts` yet.
```

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/smoke.json --out playtest-out/search-a --workers 1` exits 0 and prints a line starting `search: smoke games=`.
- `npm run playtest:search -- --search tools/playtest/searches/smoke.json --out playtest-out/search-b --workers 3` exits 0.
- `node tools/playtest/same-lines.mjs playtest-out/search-a/archive.json playtest-out/search-b/archive.json` prints a line starting `same`.
- `node tools/playtest/same-lines.mjs playtest-out/search-a/report.md playtest-out/search-b/report.md` prints a line starting `same`.
- `node tools/playtest/same-lines.mjs playtest-out/search-a/best-plan.json playtest-out/search-b/best-plan.json` prints a line starting `same`.
- `npm run playtest:search -- --search tools/playtest/searches/smoke.json --out playtest-out/bad --workers 0` exits 1.
- `npm run playtest:tiers -- --plan playtest-out/search-a/best-plan.json --games 20 --seed 1 --out playtest-out/tiers-a --workers 1` exits 0 and prints a line starting `tiers: hard`.
- `npm run playtest:tiers -- --plan playtest-out/search-a/best-plan.json --games 20 --seed 1 --out playtest-out/tiers-b --workers 3` exits 0.
- `node tools/playtest/same-lines.mjs playtest-out/tiers-a/tiers.md playtest-out/tiers-b/tiers.md` prints a line starting `same`.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/one.jsonl --workers 2` exits 0.
- `npm run playtest:report -- --in playtest-out/one.jsonl` exits 0 and prints a table holding a `Mean lives lost` column.
- `npm run playtest:sweep -- --sweep tools/playtest/sweeps/smoke.json --out playtest-out/sweep-a --workers 2` exits 0.
- `git diff --quiet -- src tests/balance.test.ts tests/bots.ts tests/boss-bound.test.ts tests/waves.test.ts package-lock.json` exits 0.
- `git status --porcelain -- playtest-out` prints nothing.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/hard.json --out playtest-out/search-hard` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/easy.json --out playtest-out/search-easy` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/hard-no-kick.json --out playtest-out/search-hard-no-kick` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/hard-no-hat.json --out playtest-out/search-hard-no-hat` exits 0.
- `npm run playtest:search -- --search tools/playtest/searches/hard-no-synth.json --out playtest-out/search-hard-no-synth` exits 0.
- `npm run playtest:tiers -- --plan playtest-out/search-hard/best-plan.json --games 200 --seed 1 --out playtest-out/tiers-hard` exits 0.
- `npm run playtest:tiers -- --plan playtest-out/search-easy/best-plan.json --games 200 --seed 1 --out playtest-out/tiers-easy` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.
- Do not change anything under `src/`, or any game value.
- Do not change `tests/balance.test.ts`.
- Do not change `tools/playtest/targets.ts`, `propose.ts`, or `sweep.mjs`.
- Do not give a `.mjs` and a `.ts` file in `tools/playtest/` the same base name.
- Do not import a `node:` module from a `.ts` file. Node API use stays in `.mjs` files.
- Do not use `Math.random`, `Date.now`, or the current time in any `.ts` file under `tools/playtest/`.
- With no `job.bot`, `runGame` must pick the same policy and play the same game as it does now.

## Out of scope

- Applying any balance change.
- Adding the tiers or search results to `docs/balance.md`, or new entries to `TARGETS`.
- Bots that sell towers or move them during a wave.
- Freezing expert builds into `tests/balance.test.ts`.
- Charts, Novita, or remote execution.
- Browser replay checks.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
