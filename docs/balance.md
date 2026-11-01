# Balance notes

How Drumline's difficulty works, why it is set up this way, and how to change it.

Last tuned 2026-10-31. Every result below comes from the bots in `tests/bots.ts`. No human
playtest has confirmed these numbers yet.

## Quick reference

| Setting | Easy | Hard |
| --- | --- | --- |
| Waves | 30 | 30 |
| Starting lives | 30 | 20 |
| Starting money | $150 | $100 |
| Bonus for clearing a wave | $40 | $20 |
| Enemy health | 70% | 100% |

Enemy speed, tower stats, kill rewards, and the chord bonus are the same on both.

All tunable values live in `src/config.ts`, in `WAVE_CURVE` and `DIFFICULTIES`. The wave
generator is `src/waves.ts`.

## Why it changed

The original game had 5 hand-written waves. Comparing total enemy health with the money earned
so far showed why it felt too easy:

| Wave | Total enemy health | Money earned so far | Health per dollar |
| --- | --- | --- | --- |
| 1 | 240 | $100 | 2.4 |
| 2 | 396 | $180 | 2.2 |
| 3 | 880 | $294 | 3.0 |
| 4 | 1,380 | $464 | 3.0 |
| 5 (boss) | 1,092 | $694 | 1.6 |

Towers stay on the board, so damage builds up over a run, but enemy health barely outgrew
income. The final boss wave was the easiest wave for the money available.

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
   how tough each type is relative to the others, not its final health.
5. **Spacing:** enemies start 8 steps apart, and that shrinks by 1 step every 5 waves, down to a
   minimum of 2.

| Wave | Enemies |
| --- | --- |
| Every 10th | 1 boss, plus runners equal to half the normal wave size |
| 1, 4, 7, ... | Blips |
| 2, 5, 8, ... | 60% blips, 40% runners |
| 3, 6, 9, ... | 30% brutes, 70% runners |

Enemy speed never changes. Kill rewards are flat too, so late enemies get tougher without paying
more, and enemy numbers are what grow income.

### Current curve

| Setting | Value | Effect |
| --- | --- | --- |
| `waves` | 30 | Run length |
| `bossEvery` | 10 | Bosses at waves 10, 20, and 30 |
| `bossBudget` | 1 | Boss waves use a normal budget |
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
| 30 | 36,929 | Boss, 29,997 HP; 13 runners, 533 HP |

Easy uses the same waves with 70% of this health.

## Targets

| Target | Why |
| --- | --- |
| Hard: strong bots reach wave 25 or later, then lose | Bots place towers by simple rules, so a thinking player should be able to go further and win |
| Hard: a casual bot loses by wave 20 | Buying one tower a wave should not be enough |
| Hard: about two thirds of the board is built at the peak | From the Goal Defense article, which suggests peaking at 60–70% full |
| Easy: strong bots win | A sensible build should finish the game |
| Easy: a casual bot reaches wave 15 or later | A relaxed player should see a good part of the run |
| Doing nothing loses within 3 waves | Building has to matter from the start |

`tests/balance.test.ts` enforces these targets. If a change breaks one, either the change went
too far or the target needs to move.

## Current results

| Mode | Bot | Result | Towers | Time at 1× |
| --- | --- | --- | --- | --- |
| Hard | Casual | Lost at wave 10 | 10 | 7.0 min |
| Hard | Spread | Lost at wave 28 | 58 | 16.6 min |
| Hard | Stack | Lost at wave 29 | 61 | 15.9 min |
| Easy | Casual | Lost at wave 21 | 21 | 13.5 min |
| Easy | Spread | Won with 10 lives | 78 | 13.2 min |
| Easy | Stack | Won with 10 lives | 63 | 13.0 min |

Times count wave play only, not time spent building. Runs take half as long at 2× speed.

The Hard spread bot holds at 15 lives and the Hard stack bot at 20 until the late waves, then both
collapse quickly. Pressure on Hard therefore arrives late.

### What the bots do

- **Casual:** buys one tower before each wave, placed for good coverage.
- **Spread:** spends everything, keeping columns as even as it can.
- **Stack:** spends everything, stacking up to 4 towers in a column for the chord bonus.
- **Idle:** builds nothing.

## Tuning findings

- **Bosses dominate.** A boss that gets through costs 20 lives, so it ends a Hard run outright. At
  a `bossBudget` of 3, every bot died at wave 10 or 20 and normal waves stopped mattering. That is
  why the boss budget is 1, even though boss waves in other games often use far more.
- **`growth` is sensitive.** On Hard, 1.08 to 1.09 lets strong bots reach the final boss, while
  1.12 stops them at wave 20.
- **`enemiesPerWave` is really an income setting.** At 0.8 with higher bonuses, bots filled 78 of
  85 cells on Hard, well past the two-thirds target.

## How to retune

| Problem | Change first |
| --- | --- |
| Late game too hard or too easy | `growth`, in steps of 0.01 |
| Early game too hard or too easy | `ramp` or `baseHealth` |
| Bosses are too strong or too weak | `bossBudget` |
| Board fills too quickly or too slowly | `enemiesPerWave`, then `waveBonus` |
| Only one mode feels wrong | That mode's `healthScale`, `startMoney`, or `waveBonus` |

Change one setting at a time, then run `npm test` and read the balance results. Run
`npx vitest run tests/balance.test.ts --reporter=verbose` to print each bot's result.

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

## Open questions

- **Human testing:** the bots are a stand-in. Hard is meant to be beatable by a thoughtful player,
  and that has not been proven.
- **Late collapse on Hard:** runs hold steady and then fall apart quickly. If that feels abrupt,
  lower `growth` and raise `ramp`.
- **Bosses leak on Easy:** both strong Easy bots won while the final boss got through, dropping
  from 30 lives to 10. A win where the boss escapes may feel flat.
- **Stacking:** the stack bot survives one wave longer than the spread bot on Hard, so the gap
  remains small. The chord bonus was left unchanged.
- **Music build-up:** `intensity` in `src/music.ts` still peaks by wave 5, so the soundtrack stops
  building for the rest of a 30-wave run.
- **Normal mode:** the game has two modes for now. A third would mean adding one entry to
  `DIFFICULTIES` and a button on the difficulty screen.
