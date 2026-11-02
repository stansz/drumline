# Plan: tower upgrades, part 2 (boss wave score and mid-width pads)

## Goal

Make a lost boss wave score by damage dealt to the boss, so the search can tell near-wins apart, and stop the five pad labels overflowing at widths from 761px to 1100px. Change no game value.

## Files to touch

Modify:

- `tools/playtest/bots.ts`
- `tests/playtest.test.ts`
- `src/style.css`
- `docs/references.md`

## Steps

### 1. Boss wave progress (`tools/playtest/bots.ts`)

In `playGame`, replace the `waveHealth` and `finalWaveProgress` code with:

```ts
const groups = sim.waves[sim.wave - 1] ?? [];
const waveHealth = groups.reduce((sum, group) => sum + group.hp * group.count, 0);
const boss = groups.find((group) => group.type === 'boss');
const waveProgress = boss
  ? (bossDamageByWave[String(sim.wave)] ?? 0) / boss.hp
  : waveDamage / (waveHealth || 1);
const finalWaveProgress = Math.min(1, waveProgress);
```

### 2. Test (`tests/playtest.test.ts`)

Add this inside `describe('playGame', ...)`, after `records boss kills, boss damage, and the final boss wave`:

```ts
it('scores a lost boss wave by the damage dealt to the boss', () => {
  const result = playGame(policyBot(base(1, 1, 1), rules), DIFFICULTIES.hard, rules, 1);
  expect(result.result).toBe('lost');
  expect(result.wave).toBe(30);
  expect(result.finalWaveProgress).toBeCloseTo((result.bossDamageByWave['30'] ?? 0) / 20500);
  expect(result.finalWaveProgress).toBeLessThan(1);
});
```

### 3. Pads (`src/style.css`)

Add this block directly before the `/* ---- Small phones ---- */` comment:

```css
/* ---- Mid-size screens: five pads need stacked labels ---- */
@media (min-width: 761px) and (max-width: 1100px) {
  .pad {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    padding-inline: 2px;
  }

  .pad b {
    font-size: 0.6rem;
  }

  .pad canvas {
    grid-row: auto;
    width: 24px;
    height: 24px;
  }
}
```

### 4. Docs (`docs/references.md`)

In the `npm run playtest:search` entry of Playtest harness, add this sentence after the sentence that ends `plus how many towers share a \`col % 4\` class.`: `A lost plan scores by the waves it cleared plus its progress through the last wave, which on a boss wave is the share of the boss's health it removed.`

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run test:sandbox` exits 0 with no failed tests.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not run `git add`, `git mv`, `git stash`, or `git reset`.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not change `src/config.ts` or `tests/balance.test.ts`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package.json` or `package-lock.json`.

## Out of scope

- Upgrade values, `bossHealthCap`, and any other balance value.
- Running searches, sweeps, or tiers.
- Other layout changes.

## If blocked

If a step can't be done as written, or the new test fails, stop, write what happened to `.handoff/report.md`, and leave the working tree as it is.
