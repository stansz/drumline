# Code reference

How Drumline's code fits together. [AGENTS.md](../AGENTS.md) holds the rules.

## Files

- `src/config.ts`: tunable values, including `WAVE_CURVE`, `DIFFICULTIES`, `TOWERS`, `ENEMIES`,
  `SPEED_BPMS`, and `AUTO_WAVE_STEPS`.
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
- `tests/loudness.ts`: browser-only audio check, with Neon's target levels stored in
  `tests/loudness-baseline.ts`.
- `.handoff/`: specs for work handed to another agent. The `plan*.md` files are tracked, while
  `report.md` and `last-run.log` are ignored.

## How a step works

1. `Scheduler` calls `onStep` in `src/main.ts` slightly before the step is due to play.
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
