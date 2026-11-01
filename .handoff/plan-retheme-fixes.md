# Plan: DrumlineTD retheme fixes (issue #4)

## Goal

Fix three bugs found while verifying the retheme described in `.handoff/plan-retheme.md`. The retheme is in the working tree, uncommitted. Keep it.

1. Chord labels are unreadable, because `drawText` paints each pixel's outline over letters it already drew.
2. The logo has lost its red "TD" block.
3. On a 320×568 phone, the page is 28px taller than the screen.

## Files to touch

- `src/pixel.ts`
- `src/render.ts`
- `src/style.css`
- `tests/pixel.test.ts`

## Steps

### 1. Move `drawText` into `src/pixel.ts`

Add this import at the top of `src/pixel.ts`, after the file's first comment line:

```ts
import { MINI_GLYPHS } from './sprites';
```

Add this at the end of `src/pixel.ts`:

```ts
// The part of a canvas context that text needs, so tests can pass a fake one.
export interface PixelTarget {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, width: number, height: number): void;
}

// Draws 3×5 text. Outlines go down first, because a letter's outline covers its neighbors.
export function drawText(
  target: PixelTarget,
  text: string,
  x: number,
  y: number,
  color: string,
  outline?: string,
): void {
  const pixels: Array<[number, number]> = [];
  for (let n = 0; n < text.length; n += 1) {
    const glyph = MINI_GLYPHS[text[n] ?? ''];
    if (!glyph) continue;
    for (let j = 0; j < 5; j += 1) {
      for (let i = 0; i < 3; i += 1) {
        if (glyph[j * 3 + i] === '1') pixels.push([x + n * 4 + i, y + j]);
      }
    }
  }
  if (outline) {
    target.fillStyle = outline;
    for (const [pixelX, pixelY] of pixels) {
      target.fillRect(pixelX - 1, pixelY, 3, 1);
      target.fillRect(pixelX, pixelY - 1, 1, 3);
    }
  }
  target.fillStyle = color;
  for (const [pixelX, pixelY] of pixels) {
    target.fillRect(pixelX, pixelY, 1, 1);
  }
}
```

In `src/render.ts`:

- Delete the module function `drawText`.
- Change the `./pixel` import to `import { bayer, circlePoints, drawText, linePoints } from './pixel';`.
- Remove `MINI_GLYPHS` from the `./sprites` import.

Keep every existing call to `drawText`, including the one inside `textP`.

### 2. Restore the logo

In `src/render.ts`, replace the whole `drawLogo` function with this:

```ts
export function drawLogo(canvas: HTMLCanvasElement): void {
  const word = 'DRUMLINE';
  const letters = [...word].map((character) => LOGO_GLYPHS[character] ?? []);
  let width = 0;
  for (const rows of letters) width += (rows[0]?.length ?? 0) + 1;
  canvas.width = width + 20;
  canvas.height = 11;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const plot = (rows: readonly string[], left: number, top: number, color: string): void => {
    ctx.fillStyle = color;
    rows.forEach((row, y) => {
      [...row].forEach((filled, i) => {
        if (filled === '#') ctx.fillRect(left + i, top + y, 1, 1);
      });
    });
  };

  let x = 1;
  letters.forEach((rows, index) => {
    const color =
      STEP_GROUP_COLORS[Math.floor(index / 2) % STEP_GROUP_COLORS.length] ??
      STEP_GROUP_COLORS[0];
    // The two lower layers give the letters a chunky drop shadow.
    plot(rows, x, 3, '#000');
    plot(rows, x, 2, shade(color, 0.55));
    plot(rows, x, 1, color);
    x += (rows[0]?.length ?? 0) + 1;
  });

  // "TD" sits on a red pad, so the name reads as two parts.
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 1, 1, 16, 10);
  ctx.fillStyle = PIXEL_COLORS['7'];
  ctx.fillRect(x + 1, 0, 16, 10);
  ctx.fillStyle = PIXEL_COLORS['8'];
  ctx.fillRect(x + 1, 9, 16, 1);
  plot(LOGO_GLYPHS.T ?? [], x + 3, 1, PIXEL_COLORS['5']);
  plot(LOGO_GLYPHS.D ?? [], x + 9, 1, PIXEL_COLORS['5']);
}
```

### 3. Fit small phones

In `src/style.css`, add this block between the `@media (max-width: 760px)` block and the `@media (max-height: 520px)` block:

```css
/* ---- Small phones ---- */
@media (max-width: 760px) and (max-height: 600px) {
  #info {
    font-size: 1.1rem;
  }

  .pad canvas {
    width: 24px;
    height: 24px;
  }
}
```

### 4. Add a regression test

In `tests/pixel.test.ts`:

- Change the import to `import { bayer, circlePoints, drawText, linePoints } from '../src/pixel';`.
- Add `import { MINI_GLYPHS } from '../src/sprites';` below it.
- Add this at the end of the file:

```ts
describe('drawText', () => {
  function paint(text: string, outline?: string): Map<string, string> {
    const pixels = new Map<string, string>();
    const target = {
      fillStyle: '' as string,
      fillRect(x: number, y: number, width: number, height: number): void {
        for (let j = 0; j < height; j += 1) {
          for (let i = 0; i < width; i += 1) {
            pixels.set(`${x + i},${y + j}`, this.fillStyle);
          }
        }
      },
    };
    drawText(target, text, 10, 20, 'cream', outline);
    return pixels;
  }

  it('keeps every letter pixel on top of the outline', () => {
    const text = 'x1.25';
    const pixels = paint(text, 'ink');
    for (let n = 0; n < text.length; n += 1) {
      const glyph = MINI_GLYPHS[text[n] ?? ''] ?? '';
      for (let j = 0; j < 5; j += 1) {
        for (let i = 0; i < 3; i += 1) {
          if (glyph[j * 3 + i] === '1') {
            expect(pixels.get(`${10 + n * 4 + i},${20 + j}`)).toBe('cream');
          }
        }
      }
    }
  });

  it('draws an outline around the letters', () => {
    const pixels = paint('1', 'ink');
    expect([...pixels.values()]).toContain('ink');
  });

  it('draws only letter pixels without an outline', () => {
    const pixels = paint('1');
    expect(new Set(pixels.values())).toEqual(new Set(['cream']));
  });
});
```

## Acceptance

Run these from the repository root.

- `git grep -n "function drawText" -- src/render.ts` prints nothing.
- `git grep -n "MINI_GLYPHS" -- src/render.ts` prints nothing.
- `git grep -n "'DRUMLINETD'" -- src/render.ts` prints nothing.
- `git grep -n "ctx.fillRect(x + 1, 0, 16, 10)" -- src/render.ts` prints 1 line.
- `git grep -c "max-height: 600px" -- src/style.css` prints `src/style.css:1`.
- `git grep -n -E "\.arc\(|shadowBlur|globalAlpha|setLineDash|fillText|ctx\.scale" -- src/render.ts` prints nothing.

Verifier only:

- `npm test` exits 0.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not revert or reformat any other part of the retheme.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it.
- Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies or change `package.json` or `package-lock.json`.
- Do not edit `src/sprites.ts`.
- Keep `src/pixel.ts` free of the DOM at runtime. The `CanvasGradient` and `CanvasPattern` types in `PixelTarget` are type-only.

## Out of scope

- Any other visual change, including the playhead's strength, sprite art, or colors.
- Layout changes at any size other than the new block in Step 3.
- Changes to `index.html`, `src/main.ts`, or the docs.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
