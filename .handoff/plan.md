## Goal

Let players inspect a placed tower while a tower tool is selected, including on touch screens.

## Files to touch

- `src/main.ts`
- `.handoff/report.md`

The working tree already holds uncommitted attack-visuals changes. Keep them all.

## Steps

In the `canvas` click handler in `src/main.ts`, replace the `else if (selected)` branch with this logic:

```ts
} else if (selected) {
  if (towerAt(cell)) {
    inspect = { ...cell };
  } else {
    if (sim.placeTower(selected, cell.col, cell.row)) inspect = null;
  }
}
```

Leave the `sell` branch and the no-tool branch unchanged.

## Acceptance

Run each from `/Users/sz/Documents/code/drumline`:

- `npm test` exits 0.
- `npm run typecheck` exits 0.
- `npm run build` exits 0.
- `grep -q 'if (sim.placeTower(selected, cell.col, cell.row)) inspect = null' src/main.ts` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch**.
- Do not run any `gh` command.
- If npm cannot write to `~/.npm`, set `npm_config_cache="$TMPDIR/drumline-npm-cache"`.

## Out of scope

Everything else.

## If blocked

If a step is wrong or impossible, stop and write the blocker to `.handoff/report.md`.
