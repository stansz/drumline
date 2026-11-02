# Plan: tower upgrades

Start here in a fresh session. Read `AGENTS.md`, `docs/balance.md`, and `docs/references.md` first.

## Goal

Add tower upgrades on the `upgrades` branch, and retune the game around them. Work without check-ins, using the defaults below, and stop only for the cases in **Stop and ask**.

Do this in its own git worktree, because other sessions may be using the main checkout.

## Why upgrades, from the balance work

- Focused builds run out of space at 36 towers, because a `col % 4` class has at most 22 cells. Upgrades give them something to spend money on.
- Kicks lag behind. Every Hard win spends under 20% on them, so they need the strongest upgrade.
- Hard comes down to the final boss. Competent and Strong bots nearly always lose there. Use upgrades to add more ways to prepare for it, not only more power.
- No-hat builds reach wave 30 but don't win. Upgrades should keep hats optional.

## Design defaults

Change these only if testing shows they don't work, and record why in the final report.

- **Levels:** each tower has levels 1, 2, and 3. New towers start at level 1.
- **Control:** add an **Upgrade** tool next to **Sell**, on key `5`. Clicking a tower with it buys the next level. Upgrades can be bought during a wave, like placing a tower.
- **Cost:** level 2 costs 100% of the tower's base cost, and level 3 costs 200%. Tune from there.
- **Effects:** each type keeps its role.

| Tower | Level 2 | Level 3 |
| --- | --- | --- |
| Kick | More damage | Wider splash and more damage |
| Hat | More range | More damage |
| Synth | More damage | One more chain link |

- **Sell:** refunds `sellRefund` of everything spent on the tower, including upgrades.
- **Inspecting:** the info text shows a tower's level and its next upgrade.

## Rules to keep

- Upgrades never change when a tower fires or how many towers count toward a chord. That keeps hats optional, and keeps timing and themes separate from balance.
- Put all upgrade values in `src/config.ts`, in `Rules`. Read them from `this.rules` in `src/sim.ts`.
- Show levels in whole art pixels, as sprite data in `src/sprites.ts`. Follow the `src/render.ts` rules in `AGENTS.md`.
- Keep the UI usable on phones held upright and sideways. The pad row is already tight.
- All `AGENTS.md` rules apply. Don't weaken `tests/balance.test.ts`.

## Harness work

This must land with the feature, or the balance results won't mean anything.

- `tools/playtest/plans.ts`: add an upgrade step to `BuildPlan`, and make `planBot` buy it.
- `tools/playtest/search.ts`: add mutation operations for upgrade steps, and count upgrade spending in `spentByType`.
- `tools/playtest/bots.ts` and `tiers.ts`: let policy bots buy upgrades, so Strong and Expert tiers use them.
- `tools/playtest/bound.ts`: include upgrades, because its estimate must stay an upper limit.
- `tests/bots.ts`: decide whether scripted bots buy upgrades, and record the decision in `docs/balance.md`.

## Balance work

1. Build the feature and the harness, with the existing tests passing.
2. Run the five searches, the `boss-cap` sweep, and the tiers, as `docs/balance.md` describes.
3. Retune the upgrade values first, then `bossHealthCap`. Widen the sweep's `values` if the cap moves past them.
4. Replace the expert fixtures with search wins if they stop winning.
5. Update `docs/balance.md`, including the hashes.

### Targets

- Everything in the **Targets** table of `docs/balance.md` still holds.
- Competent and Strong tiers win about 1% or less on Hard.
- A winning Hard build exists that spends 30% or more on kicks.
- A no-hat build and a 60% focused build each win in search, if that's possible without breaking the targets above.
- Fewer Strong games are decided at the final boss than the current 198 of 200.
- Try to get the `boss-cap` sweep passing again, and report it plainly if it doesn't.

## Branch and sync

- Create `upgrades` from the latest `main`, or use it if it already exists.
- Commit on that branch in small steps. Don't push to `main`, and don't merge into it.
- Pushing `upgrades` to GitHub needs the user's approval. Check `.handoff/plan-playtest-pipeline.md` first, because a workflow may deploy that branch to `/upgrades/`.
- `main` may gain telemetry work, which also changes `src/main.ts`. Merge `main` into `upgrades` when it does. If the run record exists by then, add upgrade fields to it and raise its `schema`.

## Done when

- Upgrades can be bought, sold, and inspected in a browser, on desktop and phone sizes.
- `npm test`, `npm run typecheck`, and `npm run build` pass.
- `docs/balance.md`, `README.md`, `docs/references.md`, and `AGENTS.md` are up to date.
- The final report gives results against every target above, including any that were missed.

## Stop and ask

- A target can only be met by changing a test or removing a target.
- The design needs a change to chord rules or tower timing.
- A push to `main`, a deploy, a GitHub setting change, or a new dependency seems necessary.

## Out of scope

- New tower types.
- Endless mode.
- Telemetry and the upgrades page, which `.handoff/plan-playtest-pipeline.md` covers.
- Making the final boss lethal on Easy.
