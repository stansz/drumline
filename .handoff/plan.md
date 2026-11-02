# Plan: tower balance before upgrades

## Goal

Make hats optional on Hard and let chord-focused builds pass wave 20, without letting Competent or Strong bots beat Hard. Apply exactly four config values, update the tests pinned to the old numbers, replace both expert fixtures, rerun the full harness, and record the results in `docs/balance.md`.

| Value | Old | New |
| --- | --- | --- |
| `CHORD_MAX_TOWERS` | 4 | 6 |
| `TOWERS.hat.cost` | 35 | 40 |
| `TOWERS.synth.damage` | 14 | 18 |
| `WAVE_CURVE.bossHealthCap` | 13000 | 20500 |

The resulting config hashes are Hard `d2563c15` and Easy `6ed440b5`.

## Files to touch

Modify:

- `src/config.ts`
- `tests/boss-bound.test.ts`
- `tests/waves.test.ts`
- `tests/propose.test.ts`
- `tests/rules.test.ts`
- `tests/plans.test.ts`
- `tests/playtest.test.ts`
- `tests/fixtures/hard-expert-a.json`
- `tests/fixtures/hard-expert-b.json`
- `tools/playtest/sweeps/boss-cap.json`
- `docs/balance.md`
- `docs/references.md`

## Steps

### 1. Change the config

In `src/config.ts`, change only the four values in **Goal**.

### 2. Update the pinned tests

`tests/boss-bound.test.ts`: replace the `expected` rows with these, and change the full-board test's title to `a full board deals 35519 damage` and its value to `35519`.

```ts
  ['hard', 10, 1862, 814, 8012],
  ['hard', 20, 8350, 1879, 16274],
  ['hard', 30, 20500, 3256, 25157],
  ['easy', 10, 931, 1044, 9902],
  ['easy', 20, 4175, 2309, 19258],
  ['easy', 30, 10250, 3886, 28202],
```

`tests/waves.test.ts`: in `caps the final boss on hard`, change `13000` to `20500`. In `scales the cap by healthScale on easy`, change `6500` to `10250`.

`tests/propose.test.ts`: on the `curve.bossHealthCap` line, change `13000` to `20500`.

`tests/rules.test.ts`: change `[14, 7, 7]` to `[18, 9, 9]`.

`tests/plans.test.ts`: change `toHaveLength(56)` to `toHaveLength(60)`.

`tests/playtest.test.ts`:

- Rename `a mixed bot loses at wave 28 on hard` to `a mixed bot loses at wave 30 on hard`. Expect wave `30`, towers `60`, and mix `{ kick: 20, hat: 20, synth: 20 }`.
- In `a mixed bot wins on easy`, expect towers `72` and mix `{ kick: 24, hat: 24, synth: 24 }`.
- Rename `a hat-only bot loses at wave 25 on hard` to `a hat-only bot loses at wave 26 on hard`. Expect wave `26` and towers `64`.
- In `records damage for every type and plausible chords`, change `toBeLessThan(1.75)` to `toBeLessThan(2.25)`.

Do not change `tests/balance.test.ts`.

### 3. Widen the boss cap sweep

In `tools/playtest/sweeps/boss-cap.json`, set `values` to:

```json
[17000, 17500, 18000, 18500, 19000, 19500, 20000, 20500, 21000, 21500, 22000, 22500, 23000, 23500, 24000]
```

### 4. Run the searches

Run these in order from the repository root. Create each `--out` directory first if it does not exist.

```sh
npm run playtest:search -- --search tools/playtest/searches/hard.json --out playtest-out/tower-balance/search-hard
npm run playtest:search -- --search tools/playtest/searches/hard-no-hat.json --out playtest-out/tower-balance/search-hard-no-hat
npm run playtest:search -- --search tools/playtest/searches/hard-no-kick.json --out playtest-out/tower-balance/search-hard-no-kick
npm run playtest:search -- --search tools/playtest/searches/hard-no-synth.json --out playtest-out/tower-balance/search-hard-no-synth
npm run playtest:search -- --search tools/playtest/searches/easy.json --out playtest-out/tower-balance/search-easy
```

### 5. Replace the expert fixtures

Read `playtest-out/tower-balance/search-hard/archive.json`. Expected: `config` is `d2563c15`, and `elites` holds 3 entries with `won: true`, with keys `0-2-0`, `0-3-0`, and `0-4-0`.

- Write the `plan` of key `0-3-0` to `tests/fixtures/hard-expert-a.json`.
- Write the `plan` of key `0-4-0` to `tests/fixtures/hard-expert-b.json`.

Each file is `{ "difficulty": "hard", "plan": [...] }` formatted with `JSON.stringify(value, null, 2)` and a trailing newline.

### 6. Finish the harness

```sh
npm run playtest:sweep -- --sweep tools/playtest/sweeps/boss-cap.json --out playtest-out/tower-balance/sweep-boss-cap
npm run playtest:tiers -- --plan tests/fixtures/hard-expert-a.json --games 200 --seed 1 --out playtest-out/tower-balance/tiers-hard
npm run playtest:tiers -- --plan playtest-out/tower-balance/search-easy/best-plan.json --games 200 --seed 1 --out playtest-out/tower-balance/tiers-easy
node node_modules/vitest/vitest.mjs run tests/balance.test.ts --reporter=verbose --config vitest.sandbox.config.mjs
```

### 7. Update the docs

Update `docs/balance.md`, using only numbers produced by steps 4 and 6 or given in this step. Keep the file's existing style.

- **Status:** set Hard to `d2563c15` and Easy to `6ed440b5`.
- **Current curve:** set `bossHealthCap` to 20,500.
- **Sample waves on Hard:** set wave 30's boss to 20,500 HP.
- **Scripted bots:** replace the whole table and the paragraph after it from the verbose test output in step 6. If you cannot compute the Time column the way the existing table does, say so in `.handoff/report.md` and leave that column's old values out.
- **Skill tiers:** replace the table and the sentence about where Hard loses games from the `tiers.md` files.
- **Strategy search:** replace the table from the five reports. Replace the bullets so they say what the new reports show:
  - Both expert builds came from the standard Hard search on this config.
  - Banning hats no longer stops a build at wave 20.
  - The best score reached by builds with 60% or more of their towers in one `col % 4` group, from `Chord focus: focused` in the Hard report.
  - The 85 cells split into `col % 4` classes of 22, 20, 21, and 22, so a 60% focused build has at most 36 towers.
  - Every winning Hard build spends under 20% on kicks.
- **Browser replay:** move this section's content to **History** under `### Browser replay of the old expert builds (2026-11-01)`, stating it used the 13,000 cap config. In its place, write that the current expert builds have not been replayed in a browser.
- **Final boss limits:** rewrite from the sweep output. The bound for Hard is 20,500 of 25,157, or 81%. State the sweep's proposal as a proposal only.
- **Open questions:** in **Hard is a narrow win**, replace the text with the new Expert win rate and the winning builds' lives. Remove **Tower balance**. Add **Kicks lag behind:** Hard's winning builds spend little on kicks, so review kicks before adding tower upgrades.
- **History:** add `### Tower balance pass (2026-11-01)`, listing the four old and new values and why: the hat cost and synth damage make hats optional, the chord cap of 6 lets focused builds pass wave 20, and the boss cap keeps Competent and Strong bots from winning. Move the old Strategy search bullets that no longer apply into it. Say that the earlier finding that a 14,000 cap could not be won applied to the old towers only.
- **Quick reference** and every other section: update any quoted value that changed.

In `docs/references.md`, in the `tests/fixtures/` entry, replace `They came from searches at a higher boss cap, as [balance.md](balance.md) explains.` with `They came from the standard Hard search, as [balance.md](balance.md) explains.`

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run test:sandbox` exits 0 with no failed tests.
- `node node_modules/vitest/vitest.mjs run tests/balance.test.ts --reporter=verbose --config vitest.sandbox.config.mjs` exits 0 and prints `hard spread result=lost` and `hard chord result=lost`.
- `git diff --quiet -- tests/balance.test.ts tests/balance-docs.test.ts src/sim.ts src/waves.ts src/main.ts src/render.ts tools/playtest/targets.ts package-lock.json` exits 0.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not run `git add`, `git mv`, `git stash`, or `git reset`.
- Do not touch files outside **Files to touch** except `.handoff/report.md` and `playtest-out/`.
- Do not change any game value other than the four in **Goal**.
- Do not change `tests/balance.test.ts`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.

## Out of scope

- Tower upgrades.
- Kick stats.
- Changes to `tools/playtest/targets.ts`, the search, or the bots.
- A Normal mode.
- Browser replays of the new expert builds.

## If blocked

If the search does not produce the three winning keys in step 5, or any `tests/balance.test.ts` test fails, stop, write what happened to `.handoff/report.md`, and leave the working tree as it is. Do not change values to make a target pass.
