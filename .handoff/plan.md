# Plan: fit DrumlineTD on 320×568 phones (issue #4)

## Goal

The page is 574px tall on a 568px screen. Remove the overflow by tightening the gaps between sections on small phones. The retheme and its earlier fixes are in the working tree, uncommitted. Keep them.

## Files to touch

- `src/style.css`

## Steps

In `src/style.css`, find the block that starts with `@media (max-width: 760px) and (max-height: 600px) {`. Add this rule as the first rule inside that block:

```css
  #app {
    gap: 6px;
  }

```

Change nothing else.

## Acceptance

Run these from the repository root.

- `git grep -n -A1 "max-height: 600px" -- src/style.css` prints `#app {` on the line after the media query.
- `git grep -c "max-height: 600px" -- src/style.css` prints `src/style.css:1`.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.

## Out of scope

- Every other style rule and breakpoint.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
