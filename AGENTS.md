# AGENTS.md

Drumline is a browser tower defense game where the towers play a 16-step sequencer. It uses
TypeScript, Vite, Canvas, and Web Audio, with no framework or runtime dependencies.

Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`. Pushing to `main`
deploys to GitHub Pages, and a failing test blocks the deploy.

## Read before changing

- Audio, step timing, or browser testing: [docs/references.md](docs/references.md)
- Waves or difficulty: [docs/balance.md](docs/balance.md)
- Themes or loudness: [docs/themes.md](docs/themes.md)

## Rules

- Keep `src/sim.ts` free of the DOM, audio, and randomness.
- Count game time in steps, never seconds, so speed can't change balance.
- Themes change the sound only, never the tempo, tower timing, or balance.
- `new Sim()` must stay on Hard with `autoWave` off, because bots and tests rely on that.
- Wrap every `localStorage` call in `try`/`catch`, and make the game work without it.
- Keep Neon's `space.trim` at 1. It is the loudness reference.
- Don't weaken `tests/balance.test.ts` to get a change through.
- Vitest has no Web Audio or DOM, so unit test audio logic through exported pure functions. Check
  UI and audio changes in a browser.
- On Windows, Vite and Vitest fail with `spawn EPERM` inside the `dsh --profile headless` sandbox.
  Run them outside it, and don't work around the error.
- Update the matching doc in the same change: `README.md` for controls, modes, or commands, the
  docs above for their topics, and this file for rules.
