## Goal

Make three visual fixes in the Drumline game: tower buttons stay on one line at every screen width, chord multiplier labels appear in the playhead's column, and the enemy lane is clearly lighter than the board.

## Files to touch

- `src/config.ts`
- `src/render.ts`
- `src/sim.ts`
- `src/style.css`
- `tests/attacks.test.ts`
- `.handoff/report.md`

## Steps

### 1. Lighter lane

In `src/config.ts`, in `PALETTE`, change `path: '#241f33'` to `path: '#5a4d85'`.

Do not change `--path` in `src/style.css`. The buttons use it and must keep their current color.

### 2. Buttons stay on one line

In `src/style.css`:

- In the `#controls` rule, change `grid-template-columns` to `repeat(auto-fit, minmax(92px, 1fr))`.
- In the `#controls button` rule, change `padding` to `8px 4px` and add `white-space: nowrap;`.

### 3. Chord labels at the playhead

In `src/sim.ts`:

- In the `SimEvent` union, add `step: number;` to the `kind: 'shot'` member, after `chordSize: number;`.
- In `fireTowers`, in the `events.push` for `kind: 'shot'`, add `step: this.stepIndex,` after `chordSize,`.

In `src/render.ts`, in the `chordSize >= 2` block that creates the label:

- Replace `this.chordLabelAt.get(event.col)` with `this.chordLabelAt.get(event.step)`.
- Replace `this.chordLabelAt.set(event.col, this.lastNow)` with `this.chordLabelAt.set(event.step, this.lastNow)`.
- Replace the label's `x: (event.col + 0.5) * CELL` with `x: (event.step + 0.5) * CELL`.

Do not change any other use of `event.col`.

### 4. Test

In `tests/attacks.test.ts`, add this test as the last test inside `describe('attack events', ...)`:

```ts
  it('a hat firing off its own column reports the step it fired on', () => {
    const sim = new Sim();
    expect(sim.placeTower('hat', 5, 0)).toBe(true);
    addEnemy(sim, 9, 'brute', 5);
    sim.stepIndex = 9;

    const shots = shotEvents(sim.step());
    expect(shots).toHaveLength(1);
    expect(shots[0]?.col).toBe(5);
    expect(shots[0]?.step).toBe(9);
  });
```

## Acceptance

Run each from the repository root:

- `npm test` exits 0 and reports 29 tests passed.
- `npm run build` exits 0.
- `git grep -c "path: '#5a4d85'" -- src/config.ts` prints `src/config.ts:1`.
- `git grep -c "minmax(92px, 1fr)" -- src/style.css` prints `src/style.css:1`.
- `git grep -c "white-space: nowrap" -- src/style.css` prints `src/style.css:1`.
- `git grep -c "event.step" -- src/render.ts` prints `src/render.ts:3`.
- `git diff --name-only -- src tests` prints exactly `src/config.ts`, `src/render.ts`, `src/sim.ts`, `src/style.css`, and `tests/attacks.test.ts`.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not add dependencies.
- Match the surrounding code style.

## Out of scope

- Game balance and any value in `TOWERS`, `ENEMIES`, `WAVES`, or `MIX`.
- Audio.
- Any other palette color, CSS variable, or button style.
- Changing how chords are calculated.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and do not improvise a different approach.
