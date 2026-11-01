# AGENTS.md

DrumlineTD is a browser tower defense game where the towers play a 16-step sequencer. It uses
TypeScript, Vite, Canvas, and Web Audio, with no framework or runtime dependencies.

Commands: `npm run dev`, `npm test`, `npm run test:sandbox`, `npm run typecheck`,
`npm run build`, `npm run playtest`, `npm run playtest:report`, `npm run playtest:sweep`,
`npm run playtest:search`, `npm run playtest:tiers`.
Pushing to `main` deploys to GitHub Pages, and a failing test blocks the deploy.

## Read before changing

- Audio, step timing, or browser testing: [docs/references.md](docs/references.md)
- Waves or difficulty: [docs/balance.md](docs/balance.md)
- Themes or loudness: [docs/themes.md](docs/themes.md)
- Playtest harness: [docs/references.md](docs/references.md)

## Rules

- Keep `src/sim.ts` free of the DOM, audio, and randomness.
- In `src/sim.ts`, read tower, enemy, chord, and refund values from `this.rules`, not the config
  constants, so balance sweeps can change them per game.
- Keep `tools/playtest/` free of browser APIs, and keep Node APIs in its `.mjs` files.
- Don't give a `.mjs` and a `.ts` file in `tools/playtest/` the same base name. Vite resolves
  `./name` to the `.mjs` file, while Node resolves it to the `.ts` file.
- Playtest tools only write inside `playtest-out/` or their `--out` path. They never edit
  `src/config.ts`. A person approves each proposal before it's applied.
- Count game time in steps, never seconds, so speed can't change balance.
- Themes change the sound only, never the tempo, tower timing, or balance.
- `new Sim()` must stay on Hard with `autoWave` off, because bots and tests rely on that.
- Wrap every `localStorage` call in `try`/`catch`, and make the game work without it.
- Keep Neon's `space.trim` at 1. It is the loudness reference.
- Draw the board in whole art pixels. In `src/render.ts`, don't use `arc`, `shadowBlur`,
  `globalAlpha`, `setLineDash`, `fillText`, or `ctx.scale`.
- Keep sprites as data in `src/sprites.ts`, and keep `src/pixel.ts` free of the DOM.
- Keep the `drumline-*` `localStorage` keys and `window.__drumline` names when the game's name
  changes, so saved settings survive.
- Don't weaken `tests/balance.test.ts` to get a change through.
- Vitest has no Web Audio or DOM, so unit test audio logic through exported pure functions. Check
  UI and audio changes in a browser.
- On Windows, `npm test` and `npm run build` fail with `spawn EPERM` inside the
  `dsh --profile headless` sandbox. Use `npm run test:sandbox` there, and still run `npm test`
  outside the sandbox before committing. Don't widen the sandbox, set `NODE_OPTIONS`, or stub
  modules.
- Update the matching doc in the same change: `README.md` for controls, modes, or commands, the
  docs above for their topics, and this file for rules.
