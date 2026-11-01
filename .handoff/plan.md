# Plan: lower Easy's enemy health to 50%

## Goal

Set Easy's `healthScale` to 0.5, so a casual player can beat Easy about half the time. A person approved this value. Hard does not change.

## Files to touch

Modify:

- `src/config.ts`
- `tests/boss-bound.test.ts`
- `tests/waves.test.ts`
- `README.md`
- `docs/balance.md`

## Steps

### 1. Set the value

In `src/config.ts`, in `DIFFICULTIES.easy`, change `healthScale: 0.7,` to `healthScale: 0.5,`. Do not change Hard's `healthScale`.

### 2. Update the tests

In `tests/boss-bound.test.ts`, replace the three Easy rows of `expected` with:

```ts
  ['easy', 10, 931, 1044, 7691],
  ['easy', 20, 4175, 2309, 13636],
  ['easy', 30, 6500, 3886, 18247],
```

In `tests/waves.test.ts`, in the `scales the cap by healthScale on easy` test, change `.toBe(9100)` to `.toBe(6500)`.

### 3. Update `README.md`

In the mode table, replace the Easy row with:

```md
| Easy | 30 | $150 | $40 | 50% |
```

### 4. Update `docs/balance.md`

Make these changes and no others.

- In **Quick reference**, change `| Enemy health | 70% | 100% |` to `| Enemy health | 50% | 100% |`.
- Change `Easy uses the same waves with 70% of this health.` to `Easy uses the same waves with 50% of this health.`
- In **Current results**, replace the three Easy rows with:

```md
| Easy | Casual | Lost at wave 27 | 27 | 15.5 min |
| Easy | Spread | Won with 30 lives | 78 | 10.1 min |
| Easy | Stack | Won with 30 lives | 63 | 10.3 min |
```

- In **Tuning findings**, add this bullet at the end of the list:

```md
- **Only enemy health changes Easy for casual players.** Bots that buy one tower a wave can't spend
  extra income, so raising `waveBonus` to 120 or `startMoney` to 300 changed nothing, and 50 starting
  lives only moved them from wave 23 to wave 26. At 60% health they won 0% of games, at 50% they
  won 54%, and at 45% they won 97%.
```

- In **Open questions**, delete the whole `**Easy's strong bots lose no lives:**` item and the whole `**Easy has a skill cliff:**` item.
- In **Open questions**, add this item directly after the `**Hard is a narrow win:**` item:

```md
- **Easy offers little challenge to steady builders:** Casual bots win about half their games, while
  Competent bots win every game without losing a life. A Normal mode could fill that gap.
```

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `git grep -n "healthScale: 0.5," -- src/config.ts` prints 1 line.
- `git grep -n "Easy has a skill cliff" -- docs/balance.md` prints nothing.
- `git grep -n "with 70% of this health" -- docs/balance.md` prints nothing.
- `git diff --quiet -- src/sim.ts src/waves.ts src/main.ts src/render.ts tests/balance.test.ts tests/bots.ts tests/playtest.test.ts tests/fixtures tools package.json package-lock.json` exits 0.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.
- `npm run playtest:tiers -- --plan playtest-out/search-easy/best-plan.json --games 200 --seed 1 --out playtest-out/tiers-easy-50` exits 0.
- `npm run playtest:tiers -- --plan tests/fixtures/hard-expert-a.json --games 200 --seed 1 --out playtest-out/tiers-hard-final` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.
- Do not change any game value other than Easy's `healthScale`.
- Do not change `tests/balance.test.ts`.

## Out of scope

- Any change to Hard, including `bossHealthCap`.
- Adding a Normal mode.
- Changes to `tools/playtest/`.
- New searches or sweeps.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
