# Plan: protect the expert builds with a test

## Goal

Store the two best Hard build plans in the repository and test that both win Hard, so a later change can't make Hard unwinnable without a test failing. This changes no game value.

## Files to touch

Create:

- `tests/fixtures/hard-expert-a.json`
- `tests/fixtures/hard-expert-b.json`

Modify:

- `tests/balance.test.ts`
- `docs/balance.md`
- `docs/references.md`

## Steps

### 1. Create the fixtures

`playtest-out/` is ignored by git, and both source files below already exist.

Read `playtest-out/search-hard/best-plan.json` and write `tests/fixtures/hard-expert-a.json`. Read `playtest-out/search-hard-deep/best-plan.json` and write `tests/fixtures/hard-expert-b.json`. Each output file holds only the `difficulty` and `plan` fields of its source, formatted as `JSON.stringify({ difficulty, plan }, null, 2) + '\n'`. Keep every plan step, in the same order. Drop `score`, because it was measured at a different boss cap.

Use a one-off `node -e` command. Do not add a script to the repository.

### 2. Add the test

In `tests/balance.test.ts`, add only new lines. Do not change or remove any existing line.

Add these imports after the existing imports:

```ts
import { DEFAULT_RULES } from '../src/config';
import { playGame } from '../tools/playtest/bots';
import { planBot, type BuildPlan } from '../tools/playtest/plans';
import expertA from './fixtures/hard-expert-a.json';
import expertB from './fixtures/hard-expert-b.json';
```

Add this block at the end of the file:

```ts
describe('expert builds', () => {
  for (const [name, fixture] of [
    ['a', expertA],
    ['b', expertB],
  ] as const) {
    it(`expert build ${name} beats hard`, () => {
      const plan = fixture.plan as BuildPlan;
      const result = playGame(planBot(plan), DIFFICULTIES.hard, DEFAULT_RULES, 0);
      expect(result.result).toBe('won');
      expect(result.bossKills).toEqual([10, 20, 30]);
    });
  }
});
```

### 3. Update the docs

In `docs/balance.md`, in the **Targets** table, add this row directly after the `Hard: a casual bot loses by wave 20` row:

```md
| Hard: the expert builds in `tests/fixtures/` win | Strong play has to be able to finish the game |
```

In `docs/balance.md`, directly after the sentence ending `either the change went too far or the target needs to move.`, add this paragraph, separated by an empty line:

```md
If a change breaks an expert build, run a new search before deciding the build is out of date.
`npm run playtest:search` finds a replacement, and its `best-plan.json` holds the plan to store.
```

In `docs/references.md`, in **Files**, add this directly after the `tools/playtest/` entry:

```md
- `tests/fixtures/`: expert build plans from the strategy search, replayed by `tests/balance.test.ts`.
```

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `node -e "const a=require('./tests/fixtures/hard-expert-a.json'),b=require('./tests/fixtures/hard-expert-b.json');console.log(Object.keys(a).join(),a.plan.length,Object.keys(b).join(),b.plan.length)"` prints `difficulty,plan 78 difficulty,plan 78`.
- `git diff --numstat -- tests/balance.test.ts` shows 0 deleted lines.
- `git diff --quiet -- src tools tests/bots.ts package.json package-lock.json` exits 0.
- `git status --porcelain -- playtest-out` prints nothing.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.
- `npm run playtest:tiers -- --plan tests/fixtures/hard-expert-a.json --games 200 --seed 1 --out playtest-out/tiers-hard-13000` exits 0.
- `npm run playtest:tiers -- --plan playtest-out/search-easy/best-plan.json --games 200 --seed 1 --out playtest-out/tiers-easy-13000` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.
- Do not change any game value.
- Do not change or remove any existing line in `tests/balance.test.ts`.

## Out of scope

- Any balance change, including Easy's difficulty.
- Changes to `tools/playtest/`.
- New searches or sweeps.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
