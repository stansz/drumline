# Balance notes

How Drumline's difficulty works, what the current numbers are, and how to change them. This file is
the only place that records balance results. Where it disagrees with old specs, branches, or
anything in `playtest-out/`, this file and `src/config.ts` win.

## Status

Last measured 2026-11-01, on these configs:

| Mode | Config hash |
| --- | --- |
| Hard | `4ce87782` |
| Easy | `ddbd5ac2` |

Everything under [Current results](#current-results) was measured on these configs. No human
playtest has confirmed any of it. Results come from bots, either the scripted ones in `tests/bots.ts`
or the playtest tools in `tools/playtest/`.

Every search report, tier run, and sweep record shows the config it ran on. If a hash there differs
from this table, the result is out of date. See [Keeping this file current](#keeping-this-file-current).

## Quick reference

| Setting | Easy | Hard |
| --- | --- | --- |
| Waves | 30 | 30 |
| Starting lives | 30 | 20 |
| Starting money | $150 | $100 |
| Bonus for clearing a wave | $40 | $20 |
| Enemy health | 50% | 100% |

Enemy speed, tower stats, kill rewards, and the chord bonus are the same on both.

All tunable values live in `src/config.ts`, in `WAVE_CURVE` and `DIFFICULTIES`. The wave
generator is `src/waves.ts`. `AUTO_WAVE_STEPS` sets the gap between automatic waves.

## How waves are built

Each wave has a total health budget, which is shared out among its enemies:

```text
budget(wave) = baseHealth × (1 + ramp × (wave − 1)) × growth^(wave − 1)
```

Boss waves multiply this by `bossBudget`. The steps are:

1. **Budget:** calculate the wave's total health. On Easy it is then scaled by `healthScale`.
2. **Size:** start at `baseEnemies`, add `enemiesPerWave` each wave, and stop at `maxEnemies`.
3. **Mix:** choose the enemy types from the pattern below.
4. **Health:** scale all enemies equally to fill the budget. The `hp` values in `ENEMIES` set
   how tough each type is relative to the others, not its final health. Bosses stop at
   `bossHealthCap`.
5. **Spacing:** enemies start 8 steps apart, and that shrinks by 1 step every 5 waves, down to a
   minimum of 2.

| Wave | Enemies |
| --- | --- |
| Every 10th | 1 boss, plus runners equal to half the normal wave size |
| 1, 4, 7, ... | Blips |
| 2, 5, 8, ... | 60% blips, 40% runners |
| 3, 6, 9, ... | 30% brutes, 70% runners |

Enemy speed never changes. Kill rewards are flat too, so late enemies get tougher without paying
more, and enemy numbers are what grow income. A boss that gets through costs 5 lives at wave 10, 10
at wave 20, and 20 at wave 30, which is all of a Hard run's lives.

### Current curve

| Setting | Value | Effect |
| --- | --- | --- |
| `waves` | 30 | Run length |
| `bossEvery` | 10 | Bosses at waves 10, 20, and 30 |
| `bossBudget` | 1 | Boss waves use a normal budget |
| `bossHealthCap` | 20,500 | Highest boss health on Hard, scaled by `healthScale`, so the final boss can be killed |
| `baseHealth` | 240 | Wave 1 budget |
| `ramp` | 0.3 | Steady early growth |
| `growth` | 1.10 | 10% compounding growth per wave |
| `baseEnemies` | 8 | Wave 1 size |
| `enemiesPerWave` | 0.6 | Added enemies per wave, which also controls income |
| `maxEnemies` | 30 | Cap on wave size |

### Sample waves on Hard

| Wave | Budget | Enemies |
| --- | --- | --- |
| 1 | 240 | 8 blips, 30 HP |
| 3 | 465 | 3 brutes, 122 HP; 6 runners, 16 HP |
| 5 | 773 | 6 blips, 95 HP; 4 runners, 51 HP |
| 10 | 2,094 | Boss, 1,862 HP; 7 runners, 33 HP |
| 15 | 4,739 | 5 brutes, 733 HP; 11 runners, 98 HP |
| 20 | 9,834 | Boss, 8,350 HP; 10 runners, 148 HP |
| 25 | 19,384 | 22 blips, 881 HP |
| 29 | 32,534 | 15 blips, 1,600 HP; 10 runners, 853 HP |
| 30 | 36,929 | Boss, 20,500 HP; 13 runners, 533 HP |

Easy uses the same waves with 50% of this health. The final boss is capped, so wave 30 has less
total health than its budget.

## Targets

| Target | Why |
| --- | --- |
| Hard: strong bots reach wave 25 or later, then lose | Bots place towers by simple rules, so a thinking player should be able to go further and win |
| Hard: a casual bot loses by wave 20 | Buying one tower a wave should not be enough |
| Hard: the expert builds in `tests/fixtures/` win | Strong play has to be able to finish the game |
| Hard: about two thirds of the board is built at the peak | From the Goal Defense article, which suggests peaking at 60–70% full |
| Easy: strong bots win | A sensible build should finish the game |
| Easy: a casual bot reaches wave 15 or later | A relaxed player should see a good part of the run |
| Doing nothing loses within 3 waves | Building has to matter from the start |

`tests/balance.test.ts` enforces these targets. If a change breaks one, either the change went
too far or the target needs to move.

## Current results

### Scripted bots

| Mode | Bot | Result | Towers | Time at 120 BPM |
| --- | --- | --- | --- | --- |
| Hard | Casual | Lost at wave 15 | 15 | 10.8 min |
| Hard | Spread | Lost at wave 30 | 60 | 17.4 min |
| Hard | Stack | Lost at wave 30 | 62 | 15.3 min |
| Easy | Casual | Lost at wave 30 | 30 | 16.9 min |
| Easy | Spread | Won with 30 lives | 75 | 9.0 min |
| Easy | Stack | Won with 30 lives | 63 | 9.1 min |

Times count wave play only, not time spent building. Runs take half as long at 240 BPM. With
**Auto** on, waiting out every countdown adds about 3.9 minutes at 120 BPM.

The Hard spread and stack bots both reach the final wave, then lose the final boss. Hard's pressure
therefore arrives at the final boss rather than spreading across the late waves.

- **Casual:** buys one tower before each wave, placed for good coverage.
- **Spread:** spends everything, keeping columns as even as it can.
- **Stack:** spends everything, stacking up to 4 towers in a column for the chord bonus. Its name
  in `tests/bots.ts` and the test output is `chord`.
- **Idle:** builds nothing.

The bots run with **Auto** off and build between waves with no time limit. The gap doesn't change
how much money a player earns, and towers can be placed during a wave, but it does limit thinking
time. A player who needs longer can turn **Auto** off.

### Skill tiers

`npm run playtest:tiers` plays 200 seeded games at each tier. These results use seed 1.

| Mode | Tier | Win rate | Typical final wave | Wave reached by the worst 10% |
| --- | --- | --- | --- | --- |
| Hard | Casual | 0% | 21 | 18 |
| Hard | Competent | 0.5% | 30 | 30 |
| Hard | Strong | 1% | 30 | 30 |
| Hard | Expert | 91.5% | 30 | 30 |
| Easy | Casual | 76.5% | 30 | 30 |
| Easy | Competent | 100% | 30 | 30 |
| Easy | Strong | 100% | 30 | 30 |
| Easy | Expert | 100% | 30 | 30 |

Casual buys one tower a wave, Competent up to three, and Strong as many as it can afford. Each game
uses a different random tower mix. Expert replays a search build with 5% seeded mistakes, using
`tests/fixtures/hard-expert-a.json` on Hard and the best plan from `searches/easy.json` on Easy.

The scripted Casual bot and the Casual tier differ. The scripted bot always follows the same rules
and falls at wave 15 on Hard, while the tier's random mixes usually reach wave 21.

Hard now loses its games at the final boss: 17 of the 200 Expert games, 199 of the 200 Competent
games, and 198 of the 200 Strong games ended there. Casual games most often stop at wave 20, where
67 of 200 died.

### Strategy search

Each search below played 54,000 games with the settings in `tools/playtest/searches/`.

| Search | Best result | Winning styles |
| --- | --- | --- |
| Hard | Won with 19 lives | 3 of 45 |
| Hard, no hats | Reached wave 30 and lost | 0 of 21 |
| Hard, no kicks | Won with 19 lives | 3 of 15 |
| Hard, no synths | Reached wave 30 and lost | 0 of 15 |
| Easy | Won with 30 lives | 44 of 45 |

- **Both expert builds came from the standard Hard search on this config.** They won with 19 and 18
  lives.
- **Banning hats no longer stops a build at wave 20.** Without hats, the best Hard build reaches
  wave 30 and loses with no lives left.
- **Focused builds still fall short.** The best score among builds with 60% or more of their towers
  in one `col % 4` group is 29.7, from `Chord focus: focused`, so they reach the final boss and lose
  rather than winning.
- **The 85 cells split into `col % 4` classes of 22, 20, 21, and 22**, so a 60% focused build has at
  most 36 towers.
- **Every winning Hard build spends under 20% on kicks.** The best standard-search win used 5 of its
  55 towers, and the no-kick search also found winning builds.

### Browser replay

The current expert builds have not been replayed in a browser.

### Final boss limits

These come from the `boss-cap` sweep and `tools/playtest/bound.ts`.

- The final boss's 20,500 HP is 81% of the 25,157 damage a board bought with all possible income can
  deal.
- The best random bot deals 20,588 damage on Hard, just over the final boss's 20,500 HP.
- The widened sweep proposes no value: no cap it tested, from 17,000 to 24,000, met every target. The
  current setting misses the sweep's bot-win target, because random bots win 2.1% of Hard games, and
  its fall-short target, because the best random bot kills the final boss. As for every sweep, that
  is a proposal only, and a person decides whether to change the cap.

## How to retune

| Problem | Change first |
| --- | --- |
| Late game too hard or too easy | `growth`, in steps of 0.01 |
| Early game too hard or too easy | `ramp` or `baseHealth` |
| Bosses are too strong or too weak | `bossHealthCap` for the final boss, `bossBudget` for all bosses |
| Board fills too quickly or too slowly | `enemiesPerWave`, then `waveBonus` |
| Only one mode feels wrong | That mode's `healthScale`, `startMoney`, or `waveBonus` |

Change one setting at a time, then run `npm test` and read the balance results. Run
`npx vitest run tests/balance.test.ts --reporter=verbose` to print each bot's result.

If a change breaks an expert build, run a new search before deciding the build is out of date. Its
`best-plan.json` holds the plan to store, but the standard search may not find a win, so don't weaken
the test to get a change through. If you can't find a new winning build, treat Hard as too hard.

## Proposing a change

`npm run playtest:sweep` tries a list of values for one setting and writes a proposal. It only
suggests a value, and a person decides whether to use it. To apply one, change `src/config.ts`,
run `npm test`, and update the results in this file.

Sweeps use random policies, not strong players, so use their proposals for coarse fixes only, and
check them against the strategy search. Hard's sweep targets were also set after seeing bot damage,
so they aren't independent proof.

The strategy search and skill tiers show what strong play can do, and where each tier loses. Their
targets aren't in `tools/playtest/targets.ts` yet.

## Keeping this file current

Any change to tower, enemy, chord, refund, wave, or difficulty values changes a config hash, which
makes the results above out of date. `tests/balance-docs.test.ts` then fails, which blocks the
deploy, until the hashes in [Status](#status) are updated. In the same change:

1. Run the five searches in `tools/playtest/searches/` (not `smoke.json`), the `boss-cap` sweep, and
   `npm run playtest:tiers` for both modes.
2. Update [Status](#status), [Current results](#current-results), and any value quoted elsewhere.
3. Move any result that no longer applies to [History](#history), with its date and config.

`playtest-out/` is scratch space and isn't tracked by git. Don't quote a result from it unless its
config hash matches the [Status](#status) table.

## Open questions

- **Human testing:** the bots are a stand-in. Hard is meant to be beatable by a thoughtful player,
  and that has not been proven.
- **Hard comes down to the final boss:** Expert wins 91.5% of its 200 games, and the standard
  search's three winning builds finish with 19, 18, and 15 of 20 lives, while 199 of 200 Competent
  games and 198 of 200 Strong games end at the final boss. A person still has to show that Hard can
  be won, and that one deciding fight feels fair.
- **Kicks lag behind:** Hard's winning builds spend little on kicks, so review kicks before adding
  tower upgrades.
- **Easy can be won without killing the final boss:** 145 of the 153 Easy Casual wins in
  `tiers-easy-casual.jsonl` have no `30` in `bossKills`. A leaked final boss costs 20 of Easy's 30
  lives, so a casual build can let it through and still win.
- **Easy offers little challenge to steady builders:** Casual bots win 76.5% of their games, while
  Competent bots win every game without losing a life. A Normal mode could fill that gap.
- **Late collapse on Hard:** runs hold steady and then fall apart quickly. If that feels abrupt,
  lower `growth` and raise `ramp`.
- **Music build-up:** `intensity` in `src/music.ts` still peaks by wave 5, so the soundtrack stops
  building for the rest of a 30-wave run.
- **Sending waves early:** this earns nothing extra, so it only saves time. A bonus would give
  strong players a reason to take the risk, but it would also add income the targets don't allow
  for.
- **Normal mode:** the game has two modes for now. A third would mean adding one entry to
  `DIFFICULTIES` and a button on the difficulty screen.

## History

These results explain past decisions. They come from older configs, so don't use them as current
numbers.

### The original 5 waves

The original game had 5 hand-written waves. Comparing total enemy health with the money earned so far
showed why it felt too easy:

| Wave | Total enemy health | Money earned so far | Health per dollar |
| --- | --- | --- | --- |
| 1 | 240 | $100 | 2.4 |
| 2 | 396 | $180 | 2.2 |
| 3 | 880 | $294 | 3.0 |
| 4 | 1,380 | $464 | 3.0 |
| 5 (boss) | 1,092 | $694 | 1.6 |

Towers stay on the board, so damage builds up over a run, but enemy health barely outgrew income. The
final boss wave was the easiest wave for the money available.

### Earlier tuning

- **Bosses dominate.** A boss that gets through costs 20 lives, so it ends a Hard run outright. At
  a `bossBudget` of 3, every bot died at wave 10 or 20 and normal waves stopped mattering. That is
  why the boss budget is 1, even though boss waves in other games often use far more.
- **`growth` is sensitive.** On Hard, 1.08 to 1.09 lets strong bots reach the final boss, while
  1.12 stops them at wave 20.
- **`enemiesPerWave` is really an income setting.** At 0.8 with higher bonuses, bots filled 78 of
  85 cells on Hard, well past the two-thirds target.
- **The final boss needed a cap (2026-11-01).** Boss health follows the wave budget, but board damage
  is limited by the 85 buildable cells. Uncapped, Hard's final boss had 29,997 HP, which no board
  could kill. A full board of 85 synths with unlimited money dealt 67% of it.
- **Only enemy health changes Easy for casual players (2026-11-01).** Bots that buy one tower a wave
  can't spend extra income, so raising `waveBonus` to 120 or `startMoney` to 300 changed nothing, and
  50 starting lives only moved them from wave 23 to wave 26. Casual tier bots won 0% of games at 60%
  health, 54% at 50%, and 97% at 45%.

### Tower balance pass (2026-11-01)

This pass changed four values from the `90999138` config:

| Setting | Old | New |
| --- | --- | --- |
| `CHORD_MAX_TOWERS` | 4 | 6 |
| `TOWERS.hat.cost` | 35 | 40 |
| `TOWERS.synth.damage` | 14 | 18 |
| `WAVE_CURVE.bossHealthCap` | 13,000 | 20,500 |

The hat cost and synth damage make hats optional on Hard. The chord cap of 6 lets focused builds pass
wave 20. The boss cap mostly keeps Competent and Strong bots from winning: they win 1 and 2 games of
200. The earlier finding that a 14,000 cap could not be won applied to the old towers only: at that
cap, 258,000 search games failed to win.

The old search results, from the `90999138` config:

- **Hard's only known wins came from a higher boss cap.** The old fixture builds were found by
  searches at a 14,000 cap, which lost, and they won when replayed at 13,000 with 2 lives left. A new
  search at 13,000 found no win, so `npm run playtest:search` couldn't be relied on to find a
  replacement.
- **Hats are mandatory on Hard.** With hats banned, the best build stops at wave 20. Banning kicks
  costs about one wave, and banning synths costs almost nothing. Hats keep chords at full strength,
  so their value is higher than their damage share suggests.
- **Spread builds beat focused ones.** On Hard, no build with 60% or more of its towers in one
  `col % 4` group passed wave 20, and spending 60% or more on kicks also stopped there. Builds with
  40–60% in one group reached wave 27.
- **Several mixes reach wave 30 on Hard.** They run from 12/12/31 to 29/38/6 kicks, hats, and synths.
- **Easy punishes almost nothing.** Nearly every style wins, including builds with no synths and
  builds with no hats.

### Escalating boss leaks (2026-11-01)

Boss leaks changed from 20 lives for every boss to 5, 10, and 20, on config `d2563c15` for Hard and
`6ed440b5` for Easy. This softens wave 20 for Casual play without changing the final boss.

### Browser replay of the old expert builds (2026-11-01)

On 2026-11-01, both expert builds were replayed in the deployed game in headless Edge at 240 BPM,
with the game's own audio clock driving each step. Both won with 2 lives left, and lives matched the
sim at the end of all 30 waves. A script placed the towers and started each wave at the exact step
the sim does, so this shows the browser plays the same game as the sim, not that a person can match
that timing. This used the 13,000 cap config.

## Research

Numbers from other games were not copied directly. Most are built for 20 to 80 waves, so their
growth rates do not suit a shorter run. These ideas were used instead:

| Source | Idea used |
| --- | --- |
| [Goal Defense developer article](https://www.gamedeveloper.com/design/balance-in-td-games) | New towers needed every 1–2 waves; peak at 60–70% of the board |
| [UnityTowerDefense setup checklist](https://git.marlboro-bc.duckdns.org/yeahweregames/UnityTowerDefense/src/branch/main/Docs/2.0_Setup_Checklist.md) | Health budget shared across a wave; speed never scaled |
| [Kingdom Rush enemy data](https://wikily.gg/kingdom-rush-6-genesis/enemies) | Easier modes scale enemy health, around 70% of the standard value |
| [Mindustry `Waves.java`](https://raw.githubusercontent.com/Anuken/Mindustry/master/core/src/mindustry/game/Waves.java) | Formula-driven waves with capped enemy counts |
| [Bloons TD 6 rounds](https://www.bloonswiki.com/List_of_rounds_in_BTD6) and [ZOMG data](https://www.bloonswiki.com/ZOMG_(BTD6)) | About 10% health growth per round between rounds 40 and 80, from partial data |

The 1.10 growth rate here was chosen by testing with the bots. It happens to sit close to the
Bloons figure, but on top of it, `ramp` adds extra growth in the early waves.
