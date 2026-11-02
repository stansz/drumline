# Plan: tower upgrades, part 4 (balance doc corrections)

## Goal

Correct three statements in `docs/balance.md`. Change nothing else.

## Files to touch

Modify:

- `docs/balance.md`

## Steps

1. In **Skill tiers**, in the paragraph that starts `Hard now loses its games at the final boss`, delete the sentence `196 of the 200 Strong games ended at wave 30, and Strong bought a mean of 13.25 upgrades per game.` and put `Strong bought a mean of 13.25 upgrades per game.` in its place. Rewrap the paragraph to about 100 columns.

2. In **Strategy search**, replace the bullet that starts `**The best build with 30% or more of its spending on kicks spends 33% of it on kicks**` with:

```md
- **Kick-heavy builds win.** Expert build b spends 60.6% of its money on kicks and wins with all 20
  lives. The best no-synth build spends 37% on kicks and also wins.
```

   In the first bullet of that list, replace `and the second spends the most on kicks of any winning style in that search.` with `and build b comes from the winning style with the most kick spending.`

3. In **Open questions**, in the **Kicks no longer lag behind** bullet, replace `the best winning builds now spend 33% to 37% on kicks` with `expert build b spends 60.6% on kicks and wins`. Rewrap that bullet to about 100 columns.

4. In **History**, under `### Tower upgrades (2026-11-02)`, replace `and Competent and Strong each won about 1 game of 200 with nearly every loss at the final boss.` with `Competent won 1 game of 200 and Strong won 2, with 199 and 198 of their games ending at the final boss, and Expert won 91.5%.` Rewrap that paragraph to about 100 columns.

## Acceptance

Run these from the repository root.

- `npm run test:sandbox` exits 0 with no failed tests.
- `git diff --stat -- . ":(exclude).handoff"` lists only `docs/balance.md` as changed by this run, in addition to the files already changed before it started.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not run `git add`, `git mv`, `git stash`, or `git reset`.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.

## Out of scope

- Any other edit to `docs/balance.md` or any other file.
- Running the harness.

## If blocked

If a quoted sentence isn't found exactly, stop, write what happened to `.handoff/report.md`, and leave the file as it is.
