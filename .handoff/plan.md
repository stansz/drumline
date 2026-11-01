# Plan: boss health setting and sim-driven proposals

## Goal

Add a tool chain that turns playtest results into a reviewed proposal: summarize a run, check it against balance targets, sweep one setting, and write a proposal file. The first sweep is a new `bossHealthCap` setting.

This does not change the game. `bossHealthCap` ships at a value too high to have any effect, and no tool may edit `src/config.ts`. A person applies an approved proposal later.

Also fix three harness problems: `run.mjs` accepts bad arguments, `job.ts` caches settings by job id, and a comment in `bound.ts` overclaims.

## Files to touch

Create:

- `tools/playtest/args.mjs`
- `tools/playtest/pool.mjs`
- `tools/playtest/worker.mjs`
- `tools/playtest/report.ts`
- `tools/playtest/report.mjs`
- `tools/playtest/targets.ts`
- `tools/playtest/propose.ts`
- `tools/playtest/sweep.mjs`
- `tools/playtest/sweeps/boss-cap.json`
- `tools/playtest/sweeps/smoke.json`
- `tests/report.test.ts`
- `tests/propose.test.ts`

Modify:

- `src/config.ts`
- `src/waves.ts`
- `tools/playtest/bots.ts`
- `tools/playtest/bound.ts`
- `tools/playtest/job.ts`
- `tools/playtest/run.mjs`
- `tests/waves.test.ts`
- `tests/playtest.test.ts`
- `package.json`
- `AGENTS.md`
- `README.md`
- `docs/references.md`
- `docs/balance.md`

## Steps

### 1. Add `bossHealthCap`

In `src/config.ts`:

- Add `bossHealthCap: number;` to `WaveCurve`, directly after `bossBudget: number;`.
- Add `bossHealthCap: 1000000,` to `WAVE_CURVE`, directly after `bossBudget: 1,`.

In `src/waves.ts`, replace the `return roster.map(...)` statement in `buildWave` with:

```ts
  const bossCap = Math.round(curve.bossHealthCap * difficulty.healthScale);
  return roster.map(([type, count]) => {
    const hp = Math.max(1, Math.round(enemies[type].hp * scale));
    return {
      type,
      count,
      gapSteps: type === 'boss' ? 0 : gapSteps,
      hp: type === 'boss' ? Math.min(hp, bossCap) : hp,
    };
  });
```

Keep the existing `gapSteps` constant above it.

### 2. Record boss results in `tools/playtest/bots.ts`

Add these fields to `GameResult`, directly after `idleNoteShare`:

```ts
  bossDamageByWave: Record<string, number>;
  bossKills: number[];
  finalBossWave: number;
```

In `playGame`:

- Add `const bossIds = new Set<number>();`, `const bossDamageByWave: Record<string, number> = {};`, and `const bossKills: number[] = [];` beside the other counters.
- Replace `for (const event of sim.step()) {` with:

```ts
      const events = sim.step();
      for (const enemy of sim.enemies) {
        if (enemy.type === 'boss') bossIds.add(enemy.id);
      }
      for (const event of events) {
```

- In the `hit` branch, after adding to `damageByType`, add:

```ts
          if (bossIds.has(event.enemyId)) {
            const key = String(sim.wave);
            bossDamageByWave[key] = (bossDamageByWave[key] ?? 0) + event.damage;
          }
```

- Add a branch: when `event.kind === 'kill'` and `event.enemyType === 'boss'`, push `sim.wave` to `bossKills`.
- Before the `return`, work out the last boss wave:

```ts
  let finalBossWave = 0;
  sim.waves.forEach((groups, index) => {
    if (groups.some((group) => group.type === 'boss')) finalBossWave = index + 1;
  });
```

- Add the three new fields to the returned object.

### 3. Fix `tools/playtest/job.ts`

- Replace the `resolvedJobs` `Map` with `const resolvedJobs = new WeakMap<Job, Resolved>();`. `resolveJob` keeps its logic, now keyed by the job object, so two jobs that share an `id` can never share settings.
- Export the record type:

```ts
export type GameRecord = {
  job: string;
  difficulty: DifficultyId;
  index: number;
  config: string;
  seed: number;
  policy: Policy;
} & GameResult;
```

- Import `type GameResult` and `type Policy` from `./bots`.
- In `runGame`, add `difficulty: job.difficulty,` directly after `job: job.id,`.

### 4. Correct the comment in `tools/playtest/bound.ts`

Replace the first four comment lines with:

```ts
// A close estimate of the most damage a static board can deal to a boss. It is generous: every
// earlier enemy pays its bounty, nothing is spent on earlier waves, every shot gets the capped
// chord bonus, and no shot goes to another enemy. It leaves out three small effects: synth chains
// and kick splash that reach the boss through a runner, and bounties from the boss's own wave.
```

### 5. Create `tools/playtest/args.mjs`

```js
// Strict flag parsing, so a mistyped flag stops the run instead of being ignored.
export function parseFlags(argv, allowed) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--') || !allowed.includes(flag.slice(2))) {
      throw new Error(`unknown argument: ${flag}`);
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${flag}`);
    }
    flags[flag.slice(2)] = value;
  }
  return flags;
}

export function parseCount(flags, name, fallback) {
  if (flags[name] === undefined) return fallback;
  const value = Number(flags[name]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a whole number`);
  }
  return value;
}
```

### 6. Move the worker pool out of `run.mjs`

Create `tools/playtest/worker.mjs`:

```js
import { parentPort, workerData } from 'node:worker_threads';
import { runGame } from './job.ts';

const { job, start, end } = workerData;
let lines = [];
for (let index = start; index < end; index += 1) {
  lines.push(runGame(job, index));
  if ((index - start + 1) % 100 === 0) {
    parentPort.postMessage(lines.join('\n') + '\n');
    lines = [];
  }
}
if (lines.length > 0) parentPort.postMessage(lines.join('\n') + '\n');
```

Create `tools/playtest/pool.mjs`, exporting `runJob({ job, out, workers, start, end })`. It returns a `Promise` resolving to `{ games, workers, seconds }`. Move the range splitting, output file handling, and worker events from `run.mjs` unchanged, with these differences:

- Start each worker with `new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { job, start, end } })`.
- A worker `error` event closes the file and rejects the promise.
- `workers` in the result is the number of ranges started, and `seconds` is a number.
- It never prints and never calls `process.exit`.

Rewrite `tools/playtest/run.mjs` as a command-line wrapper:

- Parse with `parseFlags(process.argv.slice(2), ['job', 'out', 'workers', 'start', 'end'])`.
- `--job` and `--out` are required.
- `workers` is `parseCount(flags, 'workers', availableParallelism())`, and must be at least 1.
- `start` is `parseCount(flags, 'start', 0)`, and `end` is `parseCount(flags, 'end', job.games)`.
- Require `start <= end` and `end <= job.games`.
- For any argument error, print the message and the usage line to stderr, then exit 1.
- On success, print exactly the same line as now:

```text
games=<n> workers=<n> seconds=<s.s> gamesPerSecond=<n>
```

- If `runJob` rejects, print the error to stderr and exit 1.

### 7. Create `tools/playtest/report.ts`

Export:

```ts
export interface Summary {
  config: string;
  difficulty: DifficultyId;
  games: number;
  wins: number;
  winRate: number;
  cleanWinRate: number;
  waveP10: number;
  waveP50: number;
  waveP90: number;
  deathsByWave: Record<string, number>;
  damageShare: Record<TowerType, number>;
  meanChordAverage: number;
  meanIdleNoteShare: number;
  finalBossWave: number;
  bestFinalBossDamage: number;
}

export function summarize(records: GameRecord[]): Summary;
export function formatSummary(summary: Summary): string;
export function formatComparison(before: Summary, after: Summary): string;
```

`summarize` throws if `records` is empty, or if the records hold more than one `config` value.

- `wins` counts `result === 'won'`, and `winRate` is `wins / games`.
- `cleanWinRate` is the share of wins where `bossKills` includes `finalBossWave`. It is 0 with no wins.
- `waveP10`, `waveP50`, and `waveP90` come from the sorted `wave` values, at index `Math.floor(q * (games - 1))`.
- `deathsByWave` counts lost games by `wave`, keyed by `String(wave)`.
- `damageShare` is each type's total `damageByType` over all games, divided by the total for all types. All are 0 when the total is 0.
- `meanChordAverage` and `meanIdleNoteShare` are plain means across games.
- `finalBossWave` is taken from the first record.
- `bestFinalBossDamage` is the highest `bossDamageByWave[String(finalBossWave)]`, treating a missing value as 0.

`formatSummary` returns a Markdown table with columns `Measure` and `Value`, and one row each for games, win rate, clean win rate, the three wave percentiles, best final boss damage, and the three damage shares. Show rates and shares as percentages to 1 decimal place, and damage as whole numbers.

`formatComparison` returns a Markdown table with columns `Measure`, `Before`, and `After`, using the same rows and formatting.

### 8. Create `tools/playtest/report.mjs`

Arguments: `--in <path>` is required, and `--compare <path>` is optional. Parse with `parseFlags`. Read each file as JSONL into `GameRecord` objects, skipping empty lines.

Without `--compare`, print `formatSummary(summarize(records))`. With `--compare`, treat the `--compare` file as before and the `--in` file as after, and print `formatComparison`. For any error, print it to stderr and exit 1.

### 9. Create `tools/playtest/targets.ts`

```ts
export type Metric = 'winRate' | 'cleanWinRate' | 'bossBoundShare' | 'bossBotShare';

export interface Target {
  id: string;
  difficulty: DifficultyId;
  metric: Metric;
  min?: number;
  max?: number;
}

// Random policies stand in for strong play until the strategy search exists, so these targets
// only support coarse changes.
export const TARGETS: Target[] = [
  { id: 'hard-bots-lose', difficulty: 'hard', metric: 'winRate', max: 0.01 },
  { id: 'hard-boss-killable', difficulty: 'hard', metric: 'bossBoundShare', max: 0.9 },
  { id: 'hard-bots-fall-short', difficulty: 'hard', metric: 'bossBotShare', max: 0.95 },
  { id: 'easy-bots-win', difficulty: 'easy', metric: 'winRate', min: 0.4 },
  { id: 'easy-clean-wins', difficulty: 'easy', metric: 'cleanWinRate', min: 0.5 },
  { id: 'easy-boss-killable', difficulty: 'easy', metric: 'bossBoundShare', max: 0.9 },
];

export interface TargetCheck {
  id: string;
  difficulty: DifficultyId;
  metric: Metric;
  value: number;
  min: number | null;
  max: number | null;
  pass: boolean;
  margin: number;
}

export function metricsFor(
  summary: Summary,
  difficulty: Difficulty,
  rules: Rules,
): Record<Metric, number>;

export function checkTarget(target: Target, value: number): TargetCheck;
```

`metricsFor`:

- `winRate` and `cleanWinRate` come straight from `summary`.
- Get `bound` from `bossBound(summary.finalBossWave, difficulty, rules)`.
- `bossBoundShare` is `bound.bossHp / bound.boardDamage`.
- `bossBotShare` is `Math.min(1, summary.bestFinalBossDamage / bound.bossHp)`.

`checkTarget`:

- With `min`, its margin is `(value - min) / min`.
- With `max`, its margin is `(max - value) / max`.
- With both, use the smaller.
- `pass` is true when `margin >= 0`.
- Store `null` for a missing `min` or `max`, so the result is valid JSON.

### 10. Create `tools/playtest/propose.ts`

Export:

```ts
export interface Sweep {
  id: string;
  setting: string;
  values: number[];
  games: number;
  seed: number;
}

export interface SettingPatch {
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
}

export interface Candidate {
  value: number | null;
  pass: boolean;
  worstMargin: number;
  checks: TargetCheck[];
  summaries: Record<DifficultyId, Summary>;
}

export interface Proposal {
  sweep: string;
  setting: string;
  currentValue: number;
  proposed: number | null;
  games: number;
  seed: number;
  candidates: Candidate[];
}

export function patchForSetting(setting: string, value: number): SettingPatch;
export function currentSetting(setting: string, rules: Rules, difficulty: Difficulty): number;
export function buildCandidate(
  value: number | null,
  summaries: Record<DifficultyId, Summary>,
  resolved: Record<DifficultyId, { difficulty: Difficulty; rules: Rules }>,
): Candidate;
export function chooseValue(candidates: Candidate[]): number | null;
export function formatProposal(proposal: Proposal): string;
```

`patchForSetting` and `currentSetting` support exactly these forms, and throw on anything else:

| Setting | Meaning |
| --- | --- |
| `curve.<key>` | `difficultyPatch.curve[key]` |
| `towers.<type>.<stat>` | `rules.towers[type][stat]` |
| `enemies.<type>.<stat>` | `rules.enemies[type][stat]` |
| `chordBonusPerTower`, `chordMaxTowers`, `sellRefund` | The matching `rules` value |

`buildCandidate` runs `metricsFor` for each difficulty, then `checkTarget` for every entry in `TARGETS`, in order. `pass` is true when all checks pass. `worstMargin` is the smallest check margin.

`chooseValue` ignores candidates with a null `value` and candidates that don't pass. It returns the `value` with the highest `worstMargin`, using the lowest `value` to break ties. It returns null if none remain.

`formatProposal` returns Markdown in this order:

1. A `# Proposal: <sweep>` heading.
2. A line: `Set \`<setting>\` to <proposed> (now <currentValue>).`, or `No tested value meets every target.` when `proposed` is null.
3. The line `Nothing has been changed. This needs a person's approval before it goes into \`src/config.ts\`.`
4. A `## Candidates` table with columns `Value`, `Passes`, `Worst margin`, then one column per target id. The current config comes first, labelled `Current`. Show each target's value to 3 decimal places.
5. When `proposed` is not null, a `## Before and after` section with a `formatComparison` table for each difficulty, comparing the current config with the proposed one.
6. When `proposed` is not null, a `## To apply` section with the line: `Set \`<setting>\` to <proposed> in \`src/config.ts\`, run \`npm test\`, then update the results in \`docs/balance.md\`.`

### 11. Create `tools/playtest/sweep.mjs`

Arguments: `--sweep <path>` and `--out <dir>` are required. `--workers <n>` defaults to `availableParallelism()` and must be at least 1. Parse with `parseFlags` and `parseCount`. For any error, print it to stderr and exit 1.

Run the candidates one at a time, in this order: the current config (`value: null`), then each entry in `sweep.values`.

For each candidate, for each difficulty in `['hard', 'easy']`:

- Build a `Job` with `id` `<sweep.id>-<difficulty>-<value or current>`, `difficulty`, `seed: sweep.seed`, and `games: sweep.games`. Add the fields from `patchForSetting(sweep.setting, value)` unless `value` is null.
- Call `runJob` with `out` set to `<out>/<job id>.jsonl`.
- Read that file back and call `summarize`.
- Get `difficulty` and `rules` from `resolveDifficulty` and `resolveRules`.

Then:

- Call `buildCandidate`.
- Get `currentValue` from `currentSetting` using Hard's default rules and difficulty.
- Set `proposed` with `chooseValue`.
- Write the `Proposal` to `<out>/proposal.json` with `JSON.stringify(proposal, null, 2) + '\n'`.
- Write `formatProposal(proposal)` to `<out>/proposal.md`.
- Print exactly one line: `proposal: <setting> = <proposed or none> (<out>/proposal.md)`.

No tool may write outside `<out>`, and neither output file may contain a timestamp, duration, or worker count.

### 12. Add the sweep files

`tools/playtest/sweeps/boss-cap.json`:

```json
{
  "id": "boss-cap",
  "setting": "curve.bossHealthCap",
  "values": [10000, 10500, 11000, 11500, 12000, 12500, 13000, 13500, 14000, 14500, 15000, 15500, 16000],
  "games": 2000,
  "seed": 11
}
```

`tools/playtest/sweeps/smoke.json`:

```json
{
  "id": "smoke",
  "setting": "curve.bossHealthCap",
  "values": [12000, 14000],
  "games": 40,
  "seed": 11
}
```

### 13. Add npm scripts

In `package.json`, add these after `"playtest"`:

```json
"playtest:report": "node --import ./tools/playtest/resolve-ts.mjs tools/playtest/report.mjs",
"playtest:sweep": "node --import ./tools/playtest/resolve-ts.mjs tools/playtest/sweep.mjs"
```

### 14. Add the tests

In `tests/waves.test.ts`, add a `describe('boss health cap', ...)` block:

- `buildWave(30, DIFFICULTIES.hard)`'s boss has 29997 HP.
- With `{ ...DIFFICULTIES.hard, curve: { ...WAVE_CURVE, bossHealthCap: 14000 } }`, wave 30's boss has 14000 HP, and its runners have the same HP as with the default curve.
- The same cap on `DIFFICULTIES.easy` gives wave 30's boss 9800 HP.
- That cap leaves wave 10's and wave 20's bosses unchanged on Hard.

In `tests/playtest.test.ts`, add:

- `playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1)` has `bossKills` equal to `[10, 20]`, and `finalBossWave` of 30.
- `bossDamageByWave['10']` in that result is at least 1862.
- Two `Job` objects with the same `id`, one patching `difficultyPatch: { curve: { bossHealthCap: 1000 } }`, give different `config` values from `runGame`.

Create `tests/report.test.ts`, using hand-built `GameRecord` objects:

- `summarize` throws on an empty list.
- `summarize` throws on mixed `config` values.
- It works out `winRate`, `cleanWinRate`, percentiles, `deathsByWave`, `damageShare`, and `bestFinalBossDamage` correctly.
- A win without the final boss in `bossKills` isn't counted as clean.
- `formatComparison` output contains both the before and after win rates.

Create `tests/propose.test.ts`:

- `patchForSetting('curve.bossHealthCap', 14000)` gives `{ difficultyPatch: { curve: { bossHealthCap: 14000 } } }`.
- `patchForSetting('towers.hat.damage', 4)` gives `{ rules: { towers: { hat: { damage: 4 } } } }`.
- `patchForSetting('sellRefund', 0.5)` gives `{ rules: { sellRefund: 0.5 } }`.
- `patchForSetting('nonsense', 1)` throws.
- `currentSetting('curve.bossHealthCap', DEFAULT_RULES, DIFFICULTIES.hard)` is 1000000.
- `checkTarget` passes a `max` target at or below `max`, and fails one above it, with the margin from the formula in step 9.
- `checkTarget` does the same for a `min` target.
- `chooseValue` picks the highest `worstMargin` among passing candidates, ignores failing candidates and the null-value candidate, breaks ties with the lowest value, and returns null when none pass.
- `formatProposal` contains `Nothing has been changed` both with a proposal and without one. It contains `No tested value meets every target.` when `proposed` is null.

### 15. Update the docs

In `AGENTS.md`:

- Add `npm run playtest:report` and `npm run playtest:sweep` to the commands sentence.
- Add this rule after the `tools/playtest/` rule:

```md
- Playtest tools only write inside `playtest-out/` or their `--out` path. They never edit
  `src/config.ts`. A person approves each proposal before it's applied.
```

In `README.md`, add these to the `## Commands` code block, after the existing playtest line:

```sh
npm run playtest:report -- --in playtest-out/smoke.jsonl
npm run playtest:sweep -- --sweep tools/playtest/sweeps/boss-cap.json --out playtest-out/boss-cap
```

In `docs/references.md`:

- In **Playtest harness**, add these bullets at the end of the list:

```md
- `npm run playtest:report` summarizes a JSONL file. Add `--compare <before.jsonl>` for a
  before-and-after table.
- `tools/playtest/targets.ts` holds the balance targets a script can check.
- `npm run playtest:sweep` tries each value of one setting, checks every value against the
  targets, and writes `proposal.md` and `proposal.json`. A sweep file sets `id`, `setting`,
  `values`, `games`, and `seed`. The proposal is the passing value with the largest worst-case
  margin across the targets.
```

In `docs/balance.md`:

- In the **Current curve** table, add this row after `bossBudget`:

```md
| `bossHealthCap` | 1,000,000 | Highest boss health on Hard, scaled by `healthScale`. No effect yet |
```

- Change the "Bosses are too strong or too weak" row in **How to retune** to:

```md
| Bosses are too strong or too weak | `bossHealthCap` for the final boss, `bossBudget` for all bosses |
```

- Add this section before `## Research`:

```md
## Proposing a change

`npm run playtest:sweep` tries a list of values for one setting and writes a proposal. It only
suggests a value, and a person decides whether to use it. To apply one, change `src/config.ts`,
run `npm test`, and update the results in this file.

Until the strategy search exists, the bots are random policies, not strong players. Use proposals
for coarse fixes, not fine tuning.
```

- In the **Final bosses can't be killed** open question, change `against a 18,247 limit` to `against an 18,247 limit`.

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/one.jsonl --workers 1` exits 0 and prints a line starting `games=200 workers=1`.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/four.jsonl --workers 4` exits 0.
- `node tools/playtest/same-lines.mjs playtest-out/one.jsonl playtest-out/four.jsonl` prints `same 200`.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/bad.jsonl --workers 0` exits 1.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/bad.jsonl --end 999` exits 1.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/bad.jsonl --start 5 --end 2` exits 1.
- `npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/bad.jsonl --worker 2` exits 1.
- `npm run playtest:report -- --in playtest-out/one.jsonl` exits 0 and prints a Markdown table.
- `npm run playtest:report -- --in playtest-out/one.jsonl --compare playtest-out/four.jsonl` exits 0 and prints a Markdown table.
- `npm run playtest:sweep -- --sweep tools/playtest/sweeps/smoke.json --out playtest-out/sweep-a --workers 1` exits 0 and prints a line starting `proposal: curve.bossHealthCap =`.
- `npm run playtest:sweep -- --sweep tools/playtest/sweeps/smoke.json --out playtest-out/sweep-b --workers 3` exits 0.
- `node tools/playtest/same-lines.mjs playtest-out/sweep-a/proposal.json playtest-out/sweep-b/proposal.json` prints a line starting `same`.
- `node tools/playtest/same-lines.mjs playtest-out/sweep-a/proposal.md playtest-out/sweep-b/proposal.md` prints a line starting `same`.
- `git diff --quiet -- src/sim.ts src/main.ts src/render.ts tests/balance.test.ts tests/bots.ts tests/boss-bound.test.ts package-lock.json` exits 0.
- `git status --porcelain -- playtest-out` prints nothing.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.
- `npm run playtest:sweep -- --sweep tools/playtest/sweeps/boss-cap.json --out playtest-out/boss-cap` exits 0 and writes `playtest-out/boss-cap/proposal.md`.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.
- Do not change `src/sim.ts`, or any game value other than adding `bossHealthCap` at 1000000.
- Do not change `tests/balance.test.ts` or `tests/boss-bound.test.ts`, and keep every `it.fails`.
- No tool may write to `src/`, `tests/`, or `docs/`.
- Do not import a `node:` module from a `.ts` file. Node API use stays in `.mjs` files.
- Do not use `Math.random`, `Date.now`, or the current time in any `.ts` file under `tools/playtest/`.

## Out of scope

- Applying a proposal, or setting `bossHealthCap` to a working value.
- Removing `.fails` from `tests/boss-bound.test.ts`.
- Changing the results tables in `docs/balance.md`.
- MAP-Elites, genetic search, or skill tiers.
- Sweeping more than one setting at a time.
- Charts, Novita, or remote execution.
- Browser replay checks.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
