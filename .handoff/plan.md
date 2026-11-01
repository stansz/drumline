# Plan: apply the approved boss health cap

## Goal

Set `bossHealthCap` to 14000. A person approved this value from the `boss-cap` sweep. The final boss becomes 14,000 HP on Hard and 9,800 HP on Easy, which makes it killable. Waves 10 and 20, and all runners, stay the same.

## Files to touch

Modify:

- `src/config.ts`
- `tests/boss-bound.test.ts`
- `tests/waves.test.ts`
- `tests/playtest.test.ts`
- `tests/propose.test.ts`
- `docs/balance.md`

## Steps

### 1. Set the value

In `src/config.ts`, change `bossHealthCap: 1000000,` to `bossHealthCap: 14000,`.

### 2. Update `tests/boss-bound.test.ts`

- In `expected`, change the `['hard', 30, ...]` row to `['hard', 30, 14000, 3256, 16679],`.
- In `expected`, change the `['easy', 30, ...]` row to `['easy', 30, 9800, 3886, 18247],`.
- Delete the `// Known balance bug` comment line.
- Change all three `it.fails(` calls to `it(`. Keep their names and bodies.

### 3. Update `tests/waves.test.ts`

Replace the whole `describe('boss health cap', ...)` block with:

```ts
describe('boss health cap', () => {
  const uncappedHard = {
    ...DIFFICULTIES.hard,
    curve: { ...WAVE_CURVE, bossHealthCap: 1000000 },
  };

  function bossHp(wave: number, difficulty: typeof DIFFICULTIES.hard): number | undefined {
    return buildWave(wave, difficulty).find((group) => group.type === 'boss')?.hp;
  }

  it('caps the final boss on hard', () => {
    expect(bossHp(30, DIFFICULTIES.hard)).toBe(14000);
    expect(bossHp(30, uncappedHard)).toBe(29997);
  });

  it('scales the cap by healthScale on easy', () => {
    expect(bossHp(30, DIFFICULTIES.easy)).toBe(9800);
  });

  it('leaves the final wave runners alone', () => {
    const capped = buildWave(30, DIFFICULTIES.hard).filter((group) => group.type === 'runner');
    const uncapped = buildWave(30, uncappedHard).filter((group) => group.type === 'runner');
    expect(capped).toEqual(uncapped);
  });

  it('leaves earlier bosses below the cap unchanged', () => {
    expect(bossHp(10, DIFFICULTIES.hard)).toBe(bossHp(10, uncappedHard));
    expect(bossHp(20, DIFFICULTIES.hard)).toBe(bossHp(20, uncappedHard));
  });
});
```

### 4. Update the other tests

- In `tests/playtest.test.ts`, in `a mixed bot wins on easy`, change `expect(result.lives).toBe(10);` to `expect(result.lives).toBe(30);`.
- In `tests/propose.test.ts`, in the `currentSetting` test, change `.toBe(1000000)` to `.toBe(14000)`. Leave the other `1000000` values in that file alone, because they are test data.

### 5. Update `docs/balance.md`

Make these changes and no others.

- Change `Last tuned 2026-10-31.` to `Last tuned 2026-11-01.`
- In **How waves are built**, change the end of step 4 from `not its final health.` to `not its final health. Bosses stop at \`bossHealthCap\`.` Rewrap the step to 100 columns.
- Replace the `bossHealthCap` row in **Current curve** with:

```md
| `bossHealthCap` | 14,000 | Highest boss health on Hard, scaled by `healthScale`, so the final boss can be killed |
```

- In **Sample waves on Hard**, replace the wave 30 row with:

```md
| 30 | 36,929 | Boss, 14,000 HP; 13 runners, 533 HP |
```

- Replace `Easy uses the same waves with 70% of this health.` with:

```md
Easy uses the same waves with 70% of this health. The final boss is capped, so wave 30 has less
total health than its budget.
```

- In **Current results**, replace the three Easy rows with:

```md
| Easy | Casual | Lost at wave 21 | 21 | 13.4 min |
| Easy | Spread | Won with 30 lives | 78 | 12.8 min |
| Easy | Stack | Won with 30 lives | 63 | 12.7 min |
```

- In **Tuning findings**, add this bullet at the end of the list:

```md
- **The final boss needs a cap.** Boss health follows the wave budget, but board damage is limited
  by the 85 buildable cells. A `bossHealthCap` sweep on 2026-11-01 chose 14,000: the best random bot
  deals 87% of that, and it is 84% of the 16,679 damage a board bought with all possible income can
  deal.
```

- In **Open questions**, delete the whole `**Final bosses can't be killed:**` item and the whole `**Bosses leak on Easy:**` item.
- In **Open questions**, add these two items directly after the `**Human testing:**` item:

```md
- **Hard is unproven:** the final boss can now be killed, but no bot has won Hard. The strategy
  search still has to show that strong play can.
- **Easy's strong bots lose no lives:** both win with all 30 lives now that they kill the final boss.
  Easy may be too easy for a player who builds well.
```

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `git grep -n "bossHealthCap: 14000," -- src/config.ts` prints 1 line.
- `git grep -n "it.fails" -- tests/boss-bound.test.ts` prints nothing.
- `git grep -n "Known balance bug" -- tests` prints nothing.
- `git grep -n "Bosses leak on Easy" -- docs/balance.md` prints nothing.
- `git grep -n "can't be killed" -- docs/balance.md` prints nothing.
- `git diff --quiet -- src/sim.ts src/waves.ts src/main.ts src/render.ts tests/balance.test.ts tests/bots.ts tools package.json package-lock.json` exits 0.

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
- Any further sweep.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
