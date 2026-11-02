# Plan: escalating boss leaks

## Goal

Make leaked bosses cost 5, 10, then 20 lives at waves 10, 20, and 30, on both difficulties. On Hard, 20 lives is the whole starting total, so the final boss stays lethal. Rerun the full harness and record the results in `docs/balance.md`.

The resulting config hashes are Hard `4ce87782` and Easy `ddbd5ac2`.

## Files to touch

Modify:

- `src/config.ts`
- `src/sim.ts`
- `tools/playtest/rules.ts`
- `tests/rules.test.ts`
- `docs/balance.md`
- `README.md`
- `AGENTS.md`

## Steps

### 1. Add the leaks to the config

In `src/config.ts`, add this directly after `export const SELL_REFUND = 0.7;`, separated by one blank line:

```ts
// Lives lost when each boss gets through, in order. Later bosses use ENEMIES.boss.leak.
export const BOSS_LEAKS: readonly number[] = [5, 10, 20];
```

Add `bossLeaks: readonly number[];` as the last field of `interface Rules`.

Add `bossLeaks: BOSS_LEAKS,` as the last field of `DEFAULT_RULES`.

Do not change `ENEMIES`.

### 2. Use the leaks in the sim

In `src/sim.ts`, in `step()`, replace:

```ts
this.lives = Math.max(0, this.lives - this.rules.enemies[enemy.type].leak);
```

with:

```ts
this.lives = Math.max(0, this.lives - this.leakCost(enemy));
```

Add this method directly before `private spawnDue(): void {`:

```ts
  private leakCost(enemy: Enemy): number {
    const leak = this.rules.enemies[enemy.type].leak;
    if (enemy.type !== 'boss') return leak;
    const bossIndex = this.wave / this.difficulty.curve.bossEvery - 1;
    return this.rules.bossLeaks[bossIndex] ?? leak;
  }
```

### 3. Let the harness change the leaks

In `tools/playtest/rules.ts`, add `bossLeaks?: number[];` as the last field of `RulesPatch`, and add this as the last field of the object `resolveRules` returns:

```ts
    bossLeaks: patch.bossLeaks ?? DEFAULT_RULES.bossLeaks,
```

### 4. Add the tests

In `tests/rules.test.ts`, add this directly before `describe('hit damage', () => {`:

```ts
describe('boss leaks', () => {
  function leakedLives(wave: number, rules = DEFAULT_RULES): number {
    const sim = new Sim(DIFFICULTIES.hard, rules);
    sim.lives = 1000;
    sim.wave = wave - 1;
    sim.startWave();
    while (sim.phase === 'wave') sim.step();
    const runners = sim.waves[wave - 1]?.find((group) => group.type === 'runner')?.count ?? 0;
    return 1000 - sim.lives - runners;
  }

  it('costs 5, 10, then 20 lives as the bosses progress', () => {
    expect(leakedLives(10)).toBe(5);
    expect(leakedLives(20)).toBe(10);
    expect(leakedLives(30)).toBe(20);
  });

  it('reads the leaks from the rules', () => {
    expect(leakedLives(10, resolveRules({ bossLeaks: [7] }))).toBe(7);
  });

  it('uses the boss leak once the list runs out', () => {
    expect(leakedLives(20, resolveRules({ bossLeaks: [7] }))).toBe(ENEMIES.boss.leak);
  });

  it('a leaked final boss still ends a full-lives run on hard', () => {
    const sim = new Sim();
    sim.wave = 29;
    sim.startWave();
    while (sim.phase === 'wave') sim.step();
    expect(sim.phase).toBe('lost');
  });
});
```

Do not change `tests/balance.test.ts` or `tests/fixtures/`.

### 5. Run the harness

Run these in order from the repository root. Create each `--out` directory first if it does not exist.

```sh
npm run playtest:search -- --search tools/playtest/searches/hard.json --out playtest-out/boss-leaks/search-hard
npm run playtest:search -- --search tools/playtest/searches/hard-no-hat.json --out playtest-out/boss-leaks/search-hard-no-hat
npm run playtest:search -- --search tools/playtest/searches/hard-no-kick.json --out playtest-out/boss-leaks/search-hard-no-kick
npm run playtest:search -- --search tools/playtest/searches/hard-no-synth.json --out playtest-out/boss-leaks/search-hard-no-synth
npm run playtest:search -- --search tools/playtest/searches/easy.json --out playtest-out/boss-leaks/search-easy
npm run playtest:sweep -- --sweep tools/playtest/sweeps/boss-cap.json --out playtest-out/boss-leaks/sweep-boss-cap
npm run playtest:tiers -- --plan tests/fixtures/hard-expert-a.json --games 200 --seed 1 --out playtest-out/boss-leaks/tiers-hard
npm run playtest:tiers -- --plan playtest-out/boss-leaks/search-easy/best-plan.json --games 200 --seed 1 --out playtest-out/boss-leaks/tiers-easy
node node_modules/vitest/vitest.mjs run tests/balance.test.ts --reporter=verbose --config vitest.sandbox.config.mjs
```

### 6. Update the docs

Update `docs/balance.md`, using only numbers produced by step 5 or given in this step. Keep the file's existing style.

- **Status:** set Hard to `4ce87782` and Easy to `ddbd5ac2`.
- **Scripted bots:** update the table and the paragraph after it wherever step 5 differs. Compute the Time column as `steps × stepSeconds(120) ÷ 60` from `playBot`.
- **Skill tiers:** replace the table and the paragraph about where Hard loses games from the `tiers.md` and `.jsonl` files.
- **Strategy search:** replace the table from the five reports, and update every number in the bullets that changed. Each search's winning styles and best result must match its report.
- **Final boss limits:** update from the sweep output, and state its proposal as a proposal only.
- **Open questions:**
  - In **Hard comes down to the final boss**, update the numbers.
  - Add **Easy can be won without killing the final boss:** give how many Easy Casual wins have no `30` in `bossKills`, from `tiers-easy-casual.jsonl`, and say that a boss leak costs 20 of Easy's 30 lives.
  - Update **Easy offers little challenge to steady builders** if its number changed.
- **History:** add `### Escalating boss leaks (2026-11-01)` under the existing tower balance entry. Say that leaks changed from 20 lives for every boss to 5, 10, and 20, on config `d2563c15` for Hard and `6ed440b5` for Easy, and that this softens wave 20 for Casual play without changing the final boss.
- **How waves are built:** after the wave table's following paragraph about speed and kill rewards, add one sentence: `A boss that gets through costs 5 lives at wave 10, 10 at wave 20, and 20 at wave 30, which is all of a Hard run's lives.`

Do not edit the existing `**Bosses dominate.**` History entry.

In `README.md`, replace `A boss arrives every 10 waves, and one that gets through costs 20 lives.` with `A boss arrives every 10 waves, and one that gets through costs 5, 10, then 20 lives.` Keep the paragraph wrapped as it is.

In `AGENTS.md`, in the rule that starts `In \`src/sim.ts\`, read tower, enemy, chord, and refund values`, change those words to `read tower, enemy, boss leak, chord, and refund values`, and keep the rule wrapped to about 100 columns.

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run test:sandbox` exits 0 with no failed tests.
- `node node_modules/vitest/vitest.mjs run tests/balance.test.ts --reporter=verbose --config vitest.sandbox.config.mjs` exits 0 and prints `hard spread result=lost` and `hard chord result=lost`.
- `git diff --quiet -- tests/balance.test.ts tests/balance-docs.test.ts tests/fixtures src/waves.ts src/main.ts src/render.ts tools/playtest/targets.ts package-lock.json` exits 0.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not run `git add`, `git mv`, `git stash`, or `git reset`.
- Do not touch files outside **Files to touch** except `.handoff/report.md` and `playtest-out/`.
- Do not change any game value other than the boss leaks in **Goal**.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.

## Out of scope

- Making the final boss lethal on Easy.
- Changing the boss cap, tower stats, or sweep targets.
- Changing the sweep's `values`.
- UI changes.
- Endless mode and tower upgrades.
- Browser replays.

## If blocked

If the config hashes differ from **Goal**, or any `tests/balance.test.ts` test fails, stop, write what happened to `.handoff/report.md`, and leave the working tree as it is. Do not change values to make a target pass.
