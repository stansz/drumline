# Code reference

How Drumline's code fits together. [AGENTS.md](../AGENTS.md) holds the rules.

## Files

- `src/config.ts`: tunable values, including `WAVE_CURVE`, `DIFFICULTIES`, `TOWERS`, `ENEMIES`,
  `DEFAULT_RULES`, `SPEED_BPMS`, and `AUTO_WAVE_STEPS`.
- `src/sim.ts`: game rules. `step()` advances one sixteenth note and returns `SimEvent`s.
- `src/waves.ts`: builds the waves from `WAVE_CURVE`.
- `src/scheduler.ts`: step clock that runs on `AudioContext` time, slightly ahead of playback.
- `src/audio.ts`: `Audio_`, which owns the audio chain and every generated sound.
- `src/music.ts`: chords, arpeggios, and how the backing music builds up.
- `src/themes.ts`: one entry for each music theme.
- `src/render.ts`: draws the board into a 256×128 buffer, then scales it onto the canvas.
- `src/sprites.ts`: colors, sprites, and bitmap letters, stored as data.
- `src/pixel.ts`: pixel line, circle, and dither helpers with no DOM.
- `src/fonts/`: self-hosted fonts and their licenses.
- `src/main.ts`: connects everything, and handles input, the HUD, and saved settings.
- `tests/bots.ts`: scripted players used by `tests/balance.test.ts`. The `chord` bot is called Stack
  in the docs.
- `tools/playtest/`: headless balance harness. See [Playtest harness](#playtest-harness).
- `tests/fixtures/`: expert build plans from the strategy search, replayed by `tests/balance.test.ts`.
- `vitest.sandbox.config.mjs`: runs the tests inside the Windows `dsh` sandbox, through
  `npm run test:sandbox`.
- `tests/loudness.ts`: browser-only audio check, with Neon's target levels stored in
  `tests/loudness-baseline.ts`.
- `.handoff/`: specs for work handed to another agent. The `plan*.md` files are tracked, while
  `report.md` and `last-run.log` are ignored.

## How a step works

1. `Scheduler` calls `onStep` in `src/main.ts` slightly before the step is due to play. That lead is
   `LOOKAHEAD_SECONDS`.
2. `onStep` schedules the music, calls `sim.step()`, and schedules each note at the step's audio
   time.
3. Events wait in `queued`, and `frame()` hands them to the renderer once audio time reaches them.

The sim always runs slightly ahead of what the player sees and hears, so read visuals against
audio time, not against the sim's current state.

## Audio chain

```text
tower, music, and fx buses → master → trim → crusher → filter → limiter → soft clip → analyser → volume → output
```

- A `WaveShaper` curve can only be set once, so themes crossfade the crusher in and out instead of
  replacing its curve.
- The limiter lets through only about 0.4 dB for each 1 dB of `space.trim`, so loudness has to be
  measured, not worked out. [themes.md](themes.md) has the steps.
- The player's volume slider sits after the limiter, so it never changes the mix. It only turns the
  sound down from full level, and the loudness page renders at full level.
- Changing Neon or the shared chain means refreshing `tests/loudness-baseline.ts`.

## Visuals

`Renderer` draws into a 256×128 buffer, one 16px tile per board cell. `present()` scales that up by a
whole number to at least the canvas's displayed size, then CSS scales it to fit. This keeps every art
pixel the same size at any width, which `image-rendering: pixelated` can't promise at fractional
scales.

The step strip above the board is DOM. `main.ts` lights the playhead's step, and outlines the steps
that the hovered or inspected tower plays on.

On phones held upright, the board's size is limited by the screen width, so it runs edge to edge.
On phones held sideways, the controls sit in a column beside the board, which gives it most of the
screen. `#rotate-hint` on the start screen points players to that layout. These layouts were
measured in headless Edge at phone sizes, not on a real phone. On 360px-wide phones, selecting Synth
still moves the board by 5px, because its description wraps to an extra line.

## Audio load

Each sound costs audio CPU, and phones run out long before desktops. On one desktop core, a 75-tower
board took about 70% before voice limits and 28% after, and Techno went from 102% to 42%.

- `pickVoices` caps each instrument per step with `TOWER_VOICE_LIMITS`. Towers past the limit still
  fire and deal damage. `playNote` gets the number of voices played, not the chord size, so a capped
  chord stays about as loud.
- Don't add automation to long-lived `AudioParam`s on every step. Those events add up over a run.
- The game uses `latencyHint: 'playback'`, because nothing depends on tapping in time. `frame()`
  subtracts the output latency, so the board matches what's heard.

## Playtest harness

`tools/playtest/` plays seeded bot games in Node worker threads, with no browser or build step.
The sim has no randomness, so the same bot always gets the same result. Each game therefore uses a
different seeded policy, and all bot randomness stays in the bot.

```sh
npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/smoke.jsonl
```

The playtest commands load TypeScript directly through Node, and have only been run on Node 24. The
deploy workflow uses Node 22, but it only runs the tests and the build, not these commands.

- A job file sets `id`, `difficulty`, `seed`, and `games`, with optional `rules` and
  `difficultyPatch` changes to game values, and an optional `bot` that picks a skill tier or a
  build plan.
- The output has one JSON line per game. `config` is a hash of the resolved values, so results
  from different configs can't be mixed by mistake.
- `--workers` sets the thread count. `--start` and `--end` run part of a job, so it can be split
  across machines. Combined shards match a single run line for line once sorted, which
  `tools/playtest/same-lines.mjs` checks.
- `Sim` takes a `Rules` object as its second argument. `resolveRules` and `resolveDifficulty` in
  `tools/playtest/rules.ts` build changed copies without touching the config constants.
- `tools/playtest/bound.ts` works out the most damage any static board can deal to a boss.
- A new bot implements `Bot` from `tools/playtest/bots.ts`, and takes randomness only from
  `ctx.rng`.
- `npm run playtest:report` summarizes a JSONL file. Add `--compare <before.jsonl>` for a
  before-and-after table.
- `tools/playtest/targets.ts` holds the balance targets a script can check.
- `npm run playtest:sweep` tries each value of one setting, checks every value against the
  targets, and writes `proposal.md` and `proposal.json`. A sweep file sets `id`, `setting`,
  `values`, `games`, and `seed`. The proposal is the passing value with the largest worst-case
  margin across the targets.
- `npm run playtest:search` runs a MAP-Elites search over build plans, which are ordered lists of
  towers to buy. It keeps the best plan for each style, where a style is the share of money spent
  on kicks and synths, plus how many towers share a `col % 4` class. A search file can set
  `bannedTowers`, which shows how much a tower is worth. It writes `report.md`, `archive.json`,
  and `best-plan.json`.
- `npm run playtest:tiers` runs Casual, Competent, Strong, and Expert bots and writes `tiers.md`.
  Expert replays a search's best plan with seeded mistakes. `--plan` takes a `best-plan.json` or a
  file from `tests/fixtures/`. A clean win in its table means the final boss was killed, not that no
  lives were lost.

## Saved settings

`localStorage` keys are `drumline-theme`, `drumline-auto-wave`, and `drumline-volume`. Speed and
Mute aren't saved, and they reset when a new run starts.

## Browser testing

- Audio won't start until a real click on **Easy** or **Hard**, because browsers require one.
- `window.__drumline` exposes `sim`, `scheduler`, and `audio` for debugging.
- `requestAnimationFrame` stops in a hidden tab, so the canvas stops updating. A hidden browser
  pane can also report a 0×0 viewport, which makes layout measurements meaningless. Set a real size
  first.
- With `npm run dev` running, `/tests/loudness.html` reports audio levels. Add `?theme=<id>` to
  check one theme.
- `npx vitest run tests/balance.test.ts --reporter=verbose` prints each bot's result.
