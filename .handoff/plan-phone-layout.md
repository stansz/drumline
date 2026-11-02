# Plan: phone layout fixes and tests inside the sandbox

## Goal

Fix two phone layout bugs, and add a way to run the test suite inside the `dsh --profile headless` sandbox on Windows.

- In landscape, tower prices are cut off because each pad is too narrow.
- In portrait on small phones, selecting a tower moves the board, because the info text grows and the page re-centers.

## Files to touch

Create:

- `vitest.sandbox.config.mjs`

Modify:

- `src/style.css`
- `package.json`
- `AGENTS.md`
- `docs/references.md`

## Steps

### 1. Fix the landscape pads

In `src/style.css`, inside the `@media (max-height: 520px) and (orientation: landscape)` block, add these rules at the end of the block:

```css
  .pad {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .pad canvas {
    width: 20px;
    height: 20px;
  }
```

### 2. Stop the board moving in portrait

In `src/style.css`, inside the `@media (max-width: 760px) and (orientation: portrait)` block, add this rule at the end of the block:

```css
  #info {
    min-height: 4.4em;
  }
```

Do not change any other CSS rule.

### 3. Add the sandbox test config

Create `vitest.sandbox.config.mjs` at the repository root:

```js
// Runs the tests inside the Windows dsh sandbox, which blocks piped child processes.
// preserveSymlinks skips Vite's `net use` call, and threads replace forked workers.
export default {
  resolve: { preserveSymlinks: true },
  test: { pool: 'threads' },
};
```

In `package.json`, add this script directly after `"test"`:

```json
"test:sandbox": "node node_modules/vitest/vitest.mjs run --config vitest.sandbox.config.mjs",
```

### 4. Update the docs

In `AGENTS.md`, add `npm run test:sandbox` to the commands sentence, directly after `npm test`.

In `AGENTS.md`, replace the whole rule that starts `On Windows, Vite and Vitest fail with` with:

```md
- On Windows, `npm test` and `npm run build` fail with `spawn EPERM` inside the
  `dsh --profile headless` sandbox. Use `npm run test:sandbox` there, and still run `npm test`
  outside the sandbox before committing. Don't widen the sandbox, set `NODE_OPTIONS`, or stub
  modules.
```

In `docs/references.md`, in **Files**, add this directly after the `tests/fixtures/` entry:

```md
- `vitest.sandbox.config.mjs`: runs the tests inside the Windows `dsh` sandbox, through
  `npm run test:sandbox`.
```

## Acceptance

Run these from the repository root.

- `npm run typecheck` exits 0.
- `npm run test:sandbox` exits 0 and reports 183 passed tests.
- `git diff --quiet -- src/main.ts src/render.ts src/sim.ts src/config.ts src/waves.ts index.html tests tools package-lock.json` exits 0.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not run `git add`, `git mv`, `git stash`, or `git reset`.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies, and do not change `package-lock.json`.

## Out of scope

- Any change to game rules or balance.
- Any change to `npm test` or `vite.config.ts`.
- Other layout changes.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
