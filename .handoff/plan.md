# Plan: lower the boss health cap to 13,000

## Goal

Set `bossHealthCap` to 13000. A person approved this value after the strategy search. The final boss becomes 13,000 HP on Hard and 9,100 HP on Easy. Waves 10 and 20, and all runners, stay the same. Record the search's findings in `docs/balance.md`.

## Files to touch

Modify:

- `src/config.ts`
- `tests/boss-bound.test.ts`
- `tests/waves.test.ts`
- `tests/propose.test.ts`
- `docs/balance.md`

## Steps

### 1. Set the value

In `src/config.ts`, change `bossHealthCap: 14000,` to `bossHealthCap: 13000,`.

### 2. Update the tests

- In `tests/boss-bound.test.ts`, change `['hard', 30, 14000, 3256, 16679],` to `['hard', 30, 13000, 3256, 16679],`.
- In `tests/boss-bound.test.ts`, change `['easy', 30, 9800, 3886, 18247],` to `['easy', 30, 9100, 3886, 18247],`.
- In `tests/waves.test.ts`, in the `caps the final boss on hard` test, change `.toBe(14000)` to `.toBe(13000)`. Leave the `.toBe(29997)` line.
- In `tests/waves.test.ts`, in the `scales the cap by healthScale on easy` test, change `.toBe(9800)` to `.toBe(9100)`.
- In `tests/propose.test.ts`, in the `currentSetting` test, change `.toBe(14000)` to `.toBe(13000)`. Leave every other `14000` in that file, because they are test data.

### 3. Update `docs/balance.md`

Make these changes and no others.

- Replace the `bossHealthCap` row in **Current curve** with:

```md
| `bossHealthCap` | 13,000 | Highest boss health on Hard, scaled by `healthScale`, so the final boss can be killed |
```

- In **Sample waves on Hard**, replace the wave 30 row with:

```md
| 30 | 36,929 | Boss, 13,000 HP; 13 runners, 533 HP |
```

- In **Current results**, replace the Easy Spread row with:

```md
| Easy | Spread | Won with 30 lives | 78 | 12.7 min |
```

- In **Tuning findings**, replace the whole `**The final boss needs a cap.**` bullet with:

```md
- **The final boss needs a cap.** Boss health follows the wave budget, but board damage is limited
  by the 85 buildable cells. A `bossHealthCap` sweep on 2026-11-01 chose 14,000, but 258,000 search
  games then failed to win at that value. At 13,000, the best search builds win Hard with 2 lives
  left, while the best random bot deals 93% of the boss's health. That is 78% of the 16,679 damage
  a board bought with all possible income can deal.
- **Hats are mandatory on Hard.** With hats banned, the best build found stops at wave 20. Banning
  kicks costs about one wave, and banning synths costs almost nothing. Hats keep chords at full
  strength, so their value is higher than their damage share suggests.
- **Spread builds beat focused ones.** On Hard, no build with 60% or more of its towers in one
  `col % 4` group passed wave 20, and spending 60% or more on kicks also stopped there. Several
  spread mixes reached wave 30, from 13/17/28 to 26/27/14 kicks, hats, and synths.
```

- In **Open questions**, replace the whole `**Hard is unproven:**` item with:

```md
- **Hard is a narrow win:** the best search builds win with 2 lives left. That margin comes from
  bots, so a person still has to show that Hard can be won.
```

- In **Open questions**, add this item directly after the `**Easy's strong bots lose no lives:**` item:

```md
- **Easy has a skill cliff:** Casual bots win 0% of games and die at waves 22 to 25, while Competent
  bots, which buy up to 3 towers a wave, win 100%. There is little between the two.
```

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `git grep -n "bossHealthCap: 13000," -- src/config.ts` prints 1 line.
- `git grep -n "Hard is unproven" -- docs/balance.md` prints nothing.
- `git grep -n "chose 14,000: " -- docs/balance.md` prints nothing.
- `git diff --quiet -- src/sim.ts src/waves.ts src/main.ts src/render.ts tests/balance.test.ts tests/bots.ts tests/playtest.test.ts tools package.json package-lock.json` exits 0.

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
- Do not change any game value other than `bossHealthCap`.
- Do not change `tests/balance.test.ts`.

## Out of scope

- Any other balance change, including Easy's difficulty.
- Changes to `tools/playtest/` or its targets.
- Any further search or sweep.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
