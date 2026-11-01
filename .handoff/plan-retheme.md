# Plan: DrumlineTD 8-bit drum machine retheme (issue #4)

## Goal

Replace Drumline's neon vector look with an 8-bit drum machine look, and rename the game DrumlineTD. The board keeps its flat 16×8 grid. Gameplay, balance, audio, keyboard shortcuts, and saved settings do not change.

The approved design is a working prototype at `.handoff/assets/drumlinetd-prototype.html`. Read its `<style>` and `<script>`. When this plan and the prototype disagree, this plan wins. Do not copy the prototype's page copy, comparison styles (`drawCurrent`, `drawPolish`, `drawVoxel`, `drawLine`), or fake simulation (`stepSim`, `spawn`).

## Files to touch

Copy unchanged:

- `.handoff/assets/sprites.ts` to `src/sprites.ts`
- `.handoff/assets/favicon.svg` to `public/favicon.svg`
- `.handoff/assets/fonts/silkscreen-latin-400-normal.woff2` to `src/fonts/silkscreen-latin-400-normal.woff2`
- `.handoff/assets/fonts/vt323-latin-400-normal.woff2` to `src/fonts/vt323-latin-400-normal.woff2`
- `.handoff/assets/fonts/OFL-Silkscreen.txt` to `src/fonts/OFL-Silkscreen.txt`
- `.handoff/assets/fonts/OFL-VT323.txt` to `src/fonts/OFL-VT323.txt`

Create:

- `src/pixel.ts`
- `tests/pixel.test.ts`
- `tests/sprites.test.ts`

Modify:

- `index.html`
- `src/style.css`
- `src/render.ts`
- `src/main.ts`
- `src/config.ts`
- `src/sim.ts`
- `README.md`
- `AGENTS.md`
- `docs/references.md`

## Steps

### 1. Copy the assets

Make the six copies listed above. Do not edit them.

### 2. Export the firing rule

In `src/sim.ts`, add `export` to `function firesThisStep`. Change nothing else in that file.

### 3. Remove the old palette

In `src/config.ts`, delete the `PALETTE` constant. Change nothing else in that file.

### 4. Create `src/pixel.ts`

Use exactly this content:

```ts
// Pixel helpers with no DOM, so they can be unit tested.

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Ordered dither threshold for a pixel, from 0 up to but not including 1.
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) / 16;
}

// Every pixel on a straight line, both ends included.
export function linePoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Array<[number, number]> {
  let x = Math.round(fromX);
  let y = Math.round(fromY);
  const endX = Math.round(toX);
  const endY = Math.round(toY);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx + dy;
  const points: Array<[number, number]> = [];
  for (;;) {
    points.push([x, y]);
    if (x === endX && y === endY) return points;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

// Every pixel on a circle's outline.
export function circlePoints(
  centerX: number,
  centerY: number,
  radius: number,
): Array<[number, number]> {
  const cx = Math.round(centerX);
  const cy = Math.round(centerY);
  let x = Math.round(radius);
  let y = 0;
  let error = 1 - x;
  const points: Array<[number, number]> = [];
  while (x >= y) {
    for (const [i, j] of [
      [x, y],
      [y, x],
      [-y, x],
      [-x, y],
      [-x, -y],
      [-y, -x],
      [y, -x],
      [x, -y],
    ] as const) {
      points.push([cx + i, cy + j]);
    }
    y += 1;
    if (error < 0) {
      error += 2 * y + 1;
    } else {
      x -= 1;
      error += 2 * (y - x) + 1;
    }
  }
  return points;
}
```

### 5. Rewrite `src/render.ts`

Write it in the repository's readable style, not the prototype's compressed style. Use multi-line functions, descriptive names, and `const`/`let`.

Keep the exported `RenderState` interface exactly as it is. Keep `Renderer` with `constructor(canvas)`, `spawnEffect(event)`, and `draw(state)`. Delete `drawTowerShape`, `TOWER_COLORS`, `TOWER_SIZES`, and `CELL`.

Add these exports:

```ts
export const ART_CELL = 16;
export const ART_WIDTH = GRID_COLS * ART_CELL; // 256
export const ART_HEIGHT = GRID_ROWS * ART_CELL; // 128
export function drawLogo(canvas: HTMLCanvasElement): void;
export function drawIcon(canvas: HTMLCanvasElement, name: SpriteName): void;
```

Port these from the prototype:

| Prototype | Port as |
| --- | --- |
| `boardCv` | `private bakeBoard()`, using `pathCells()`, `pathLength()`, `pathPoint()` from `./sim` and `bayer` from `./pixel` |
| `headCv` | `private bakePlayhead()`, with the stipple threshold `.07` |
| `bake` | a module function that turns a frame into a canvas, reading colors from `PIXEL_COLORS` |
| `WHITE` | a per-sprite hit variant: `'0'` stays ink, and every other color becomes `PIXEL_COLORS['6']` |
| `pl`, `lineP`, `circP` | private methods that use `linePoints` and `circlePoints` from `./pixel` |
| `textP` | a private method that reads `MINI_GLYPHS` and draws 3×5 glyphs |
| `drawPixel` | `draw(state)` and private draw methods, one per layer |
| `blitPixel` | `private present()` |
| `drawLogo` | exported `drawLogo`, reading `LOGO_GLYPHS` and `STEP_GROUP_COLORS`, plus a local `shade()` |

Rendering rules:

- Draw everything into one 256×128 offscreen canvas, then scale it onto `#game`.
- In `src/render.ts`, do not use `arc`, `shadowBlur`, `globalAlpha`, `setLineDash`, `fillText`, or `ctx.scale`. Fade effects by skipping pixels with `bayer(x, y) >= alpha`.
- In `present()`, read `canvas.clientWidth`. If it is 0, return. Otherwise set `scale = Math.max(1, Math.ceil(clientWidth * devicePixelRatio / ART_WIDTH))`. Resize `canvas.width` and `canvas.height` to `ART_WIDTH * scale` and `ART_HEIGHT * scale` only when they change. Set `imageSmoothingEnabled = false` on every present, then `drawImage` the buffer. CSS does the final scaling, so do not set `image-rendering` on `#game`.
- Read `matchMedia('(prefers-reduced-motion: reduce)').matches` once in the constructor and store it as `calm`.

Draw in this order:

1. The baked board.
2. The playhead at `state.playhead`: the baked stipple column, a 1px line on each side of the column in `STEP_GROUP_COLORS[Math.floor(playhead / 4)]`, and a 10px line in the same color at the top of each non-path tile in that column, at `(col * 16 + 3, row * 16 + 3)`.
3. Ranges. For `state.inspect` on a tower, draw a circle of radius `TOWERS[type].range * ART_CELL` in `PIXEL_COLORS['6']`, dithered at `.55`.
4. The placement preview. Use the existing conditions from `drawPreview`. Draw frame 0 of the selected tower with pixels kept only where `bayer(x, y) < .5`, plus the same range circle.
5. A 1px outline in `PIXEL_COLORS.r` around the hovered tile when `state.selected === 'sell'` and a tower is there.
6. Towers, sorted by ascending row. Use frame 1 for 0.1 seconds after a `note` event, otherwise frame 0. While on frame 1, draw a 1px outline at tile inset 1 in the tower's color: kick `'7'`, hat `'a'`, synth `'c'`. Sprites draw at the tile's top-left corner.
7. Enemies, sorted by ascending y. Keep the position interpolation from the current `drawEnemies`. Then use `frame = calm ? 0 : Math.floor(state.playhead / 2) % 2` and subtract 1 from y when `frame` is 1. Center the sprite on the position. Draw a shadow bar first, in `#2b2733`, as in the prototype. Use the hit variant for 0.06 seconds after a `hit` event, or 0.03 seconds for a boss.
8. Health bars when `enemy.hp < enemy.maxHp`: width `Math.max(8, spriteWidth)`, 1px high, 3px above the sprite, ink background and `PIXEL_COLORS.r` fill.
9. Effects, then particles, then the chord label.
10. A 1px `PIXEL_COLORS.r` outline around tile (15, 6) for 0.25 seconds after a `leak` event.

Effects, using the event data and the current coordinates converted to art pixels:

| Event | Effect |
| --- | --- |
| `shot`, kick | Life 0.3s. Circle at the target, radius `t * TOWERS.kick.splash * ART_CELL + 1`, color `r`, dither alpha `1 - t + .2`. For the first 40% of its life, also draw a solid line from tower to target in color `'7'`. |
| `shot`, hat | Life 0.12s. Line from tower to target in color `'a'`, dither alpha `1 - t + .2`, plus a 3×3 plus sign at the target in color `'6'`. |
| `shot`, synth | Life 0.2s. Keep `boltPoints` with 6 segments and a jitter of ±3 art pixels. Color `'e'`, dither alpha `1 - t + .25`. |
| `chain` | Same bolt in color `'c'`. |
| `kill` | 12 particles from the current `spawnEffect` motion, scaled by `ART_CELL / 56`, 2×2 pixels, in colors `'7'`, `'a'`, `'g'`. Life 0.5 to 0.85s. Fade by dither. When `calm` is true, skip the particles. |
| `shot` with `chordSize >= 2` | Replace the single current label. Text `x` plus the multiplier with 2 decimals. Life 0.5s, hidden after 75% of it. Position: `y = 4 - Math.round(3 * t)`, centered on the column and clamped so the text stays on the board. Color `'6'` with an ink outline. |

Use the existing multiplier formula from `spawnEffect`. Delete `chordLabelAt`.

### 6. Replace `index.html`

Use exactly this content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="DrumlineTD is a tower defense game where your defense plays the music." />
    <meta name="theme-color" content="#14131a" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <title>DrumlineTD</title>
  </head>
  <body>
    <div id="app">
      <header id="hud" class="faceplate">
        <canvas class="logo" role="img" aria-label="DrumlineTD"></canvas>
        <div class="lcds">
          <div class="lcd"><small>Cash</small><span id="money">$100</span></div>
          <div class="lcd lives"><small>Lives</small><span id="lives">20</span></div>
          <div class="lcd wave"><small>Wave</small><span id="wave">00/30</span></div>
        </div>
        <div class="sys">
          <button id="theme" class="hw" type="button" aria-label="Change music theme">♪ Neon</button>
          <input id="volume" type="range" min="0" max="100" step="1" value="100" aria-label="Volume" title="Volume" />
        </div>
      </header>
      <main id="stage">
        <div id="steps" class="steps" aria-hidden="true"></div>
        <canvas id="game" width="256" height="128" aria-label="DrumlineTD game board"></canvas>
      </main>
      <p id="info" class="readout"></p>
      <div id="controls" class="deck">
        <div class="bank">
          <div class="cap">Instruments</div>
          <div class="pads">
            <button id="tool-kick" class="pad" type="button"><span class="led"></span><canvas data-sprite="kick" width="16" height="16"></canvas><b>Kick</b><small class="cost"></small><kbd>1</kbd></button>
            <button id="tool-hat" class="pad" type="button"><span class="led"></span><canvas data-sprite="hat" width="16" height="16"></canvas><b>Hat</b><small class="cost"></small><kbd>2</kbd></button>
            <button id="tool-synth" class="pad" type="button"><span class="led"></span><canvas data-sprite="synth" width="16" height="16"></canvas><b>Synth</b><small class="cost"></small><kbd>3</kbd></button>
            <button id="tool-sell" class="pad" type="button"><span class="led"></span><canvas data-sprite="sell" width="16" height="16"></canvas><b>Sell</b><small class="cost"></small><kbd>4</kbd></button>
          </div>
        </div>
        <div class="bank">
          <div class="cap">Transport</div>
          <div class="keys">
            <button id="start-wave" class="hw go" type="button">Start wave</button>
            <button id="auto-wave" class="hw" type="button">Auto</button>
            <button id="speed" class="hw" type="button">120 BPM</button>
            <button id="mute" class="hw" type="button">Mute</button>
            <button id="restart" class="hw" type="button">Reset</button>
          </div>
        </div>
      </div>
    </div>
    <div id="overlay">
      <canvas class="logo" role="img" aria-label="DrumlineTD"></canvas>
      <div id="overlay-text">Your defense plays the music.</div>
      <div id="overlay-detail"></div>
      <div id="mode-buttons">
        <button id="mode-easy" class="hw mode" type="button"><span>Easy</span><small></small></button>
        <button id="mode-hard" class="hw mode" type="button"><span>Hard</span><small></small></button>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 7. Rewrite `src/style.css`

Start with these two `@font-face` rules, each with `font-weight: 400` and `font-display: swap`:

- `"Silkscreen"` from `./fonts/silkscreen-latin-400-normal.woff2`
- `"VT323"` from `./fonts/vt323-latin-400-normal.woff2`

Use these tokens on `:root`, with `color-scheme: dark`:

```css
--ink: #14131a;
--panel-hi: #2d2a35;
--line: #3f3b48;
--mute: #a39eab;
--cream: #efe6d0;
--red: #e5432f;
--orange: #f28a1e;
--amber: #f7c331;
--teal: #2fc4b2;
--label: "Silkscreen", ui-monospace, Consolas, monospace;
--lcd: "VT323", ui-monospace, Consolas, monospace;
```

Port these prototype rules, with the listed changes. Keep their values.

| Prototype selector | Selector here | Change |
| --- | --- | --- |
| `.device` | `#app` | `width: 100%`, `max-width: 1072px`, `margin: auto`. Remove `container-type`. |
| `.faceplate`, `.logo`, `.lcds`, `.lcd`, `.lcd.lives`, `.lcd.wave`, `.sys` | same | `.sys input` becomes `#volume`, and `min-width: 0`. |
| `.steps` and its children | same | The number element is `em`, built in Step 8. |
| `.board` | `#game` | Keep `display: block`, `width: 100%`, `aspect-ratio: 2 / 1`, `background: #000`. |
| `.readout` | same | `margin: 0`. |
| `.deck`, `.bank`, `.pads`, `.keys`, `.hw`, `.pad` and children | same | `.pad.sel` becomes `.pad.selected`. `.hw.lit` becomes `.hw.selected`. Add `.hw:disabled { opacity: 0.45; cursor: default; }`. |
| `.mode` and children | same | Under `#mode-buttons`. Replace `.mode.easy span` and `.mode.hard span` with `#mode-easy span` and `#mode-hard span`. |

Also add:

- `html, body`: margin 0, padding 0, `background: var(--ink)`, `color: var(--cream)`, `font-family: var(--lcd)`, `overflow-x: hidden`.
- `body`: `min-height: 100vh`, `display: flex`, `align-items: center`, `justify-content: center`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`.
- `.cap`: same as the prototype's `.bank > .cap`.
- `#tool-kick { --c: var(--red); }`, `#tool-hat { --c: var(--amber); }`, `#tool-synth { --c: var(--teal); }`, `#tool-sell { --c: var(--cream); }`.
- `.pad canvas`, `.logo`: `image-rendering: pixelated`.
- `#stage`: `width: min(100%, 1024px, calc((100dvh - 276px) * 2))`, `margin: 0 auto`, and `display: flex; flex-direction: column; gap: 6px`.
- `#overlay`: keep the current fixed layout and `.hidden` and `.passive` behavior. Use `rgba(20, 19, 26, 0.86)` and, for passive, `rgba(20, 19, 26, 0.55)`.
- `#overlay .logo`: `height: clamp(40px, 10vw, 84px)`.
- `#overlay-text`: `font: 400 clamp(1.2rem, 3vw, 1.6rem)/1.1 var(--lcd)`.
- `#overlay.passive .logo { display: none; }`.
- `#overlay.passive #overlay-text`: `font: 400 clamp(1.6rem, 6vw, 3rem)/1.1 var(--label)`.
- `#overlay-detail`: `font: 400 clamp(1.1rem, 3vw, 1.5rem)/1.1 var(--lcd)`, `color: var(--mute)`. Add `#overlay-detail:empty { display: none; }`.
- `#mode-buttons`: `display: flex`, `gap: 10px`, and `#overlay.passive #mode-buttons { display: none; }`.
- Do not use `#game { border-radius }` or `text-shadow`.

Breakpoints, in this order, at the end of the file:

`@media (max-width: 760px)`: port the prototype's `@container (max-width: 640px)` block, and add:

- `.sys { width: 100%; }`, with `.sys button { min-height: 44px; }` and `#volume { flex: 1; }`.
- `#stage { width: 100%; }`.
- `#info { min-height: 3.3em; }`.

`@media (max-height: 520px)`:

- `#app { padding: 4px; gap: 4px; }`.
- `.faceplate { flex-wrap: nowrap; }`, `.logo { height: 20px; }`, `.lcds { width: auto; margin-left: auto; flex-wrap: nowrap; }`, `.lcd { flex: none; font-size: 1.1rem; padding-inline: 6px; }`, `.lcd small { display: none; }`.
- `.sys { width: auto; flex: none; }`, `#volume { width: 56px; flex: none; }`.
- `#info`, `.cap`, and `.steps em`: `display: none`.
- `.deck { grid-template-columns: 1.15fr 1fr; gap: 6px; }`.
- `.pad`: `grid-template-columns: auto 1fr`, `justify-items: start`, `text-align: left`, `padding: 2px 4px 5px`. `.pad b`, `.pad kbd`: `display: none`. `.pad canvas`: `grid-row: auto`, 24px square. `.pad .led`: `height: 2px`, `margin-bottom: 2px`.
- `#stage { width: min(100%, calc((100dvh - 118px) * 2)); gap: 2px; }`.

Keep every `.pad` and `.hw` control at `min-height: 44px` at every size. The exception is `#theme` above 760px wide, which stays at 32px as it is today.

### 8. Update `src/main.ts`

Update imports: add `drawIcon`, `drawLogo` from `./render`, add `firesThisStep` from `./sim`, and add `SpriteName` as a type from `./sprites`.

Add elements with the existing `byId` helper: `overlayDetail` (`overlay-detail`) and `stepsEl` (`steps`).

After the existing `costButtons` loop, add this setup:

- Call `drawLogo` for every `canvas.logo`.
- Call `drawIcon(canvas, canvas.dataset.sprite as SpriteName)` for every `canvas[data-sprite]`.
- Set the `.cost` text inside `sellButton` to `${Math.round(SELL_REFUND * 100)}%`.
- Set each `small` inside `easyButton` and `hardButton` to `${d.startLives} lives · $${d.startMoney}` from `DIFFICULTIES`.
- Build 16 step elements in `stepsEl`, and push each one into `stepLeds`. Each is a `span` with class `g${Math.floor(i / 4)}`. Its content is an `i` element followed by an `em` element. The `em` text is `String(i + 1)` when `i % 4 === 0`, otherwise empty.

Next to the other `let` state at the top of the file, declare `const stepLeds: HTMLSpanElement[] = [];` and `let litStep = -1;`. In `frame()`, after the `stepMarks` loop, when `playhead !== litStep`, remove class `on` from `stepLeds[litStep]`, add it to `stepLeds[playhead]`, and set `litStep = playhead`.

Add this function, and call it as the first line of `updateInfo()`:

```ts
function updateStepHints(): void {
  const tower = towerAt(hover) ?? towerAt(inspect);
  const previewing =
    !tower && hover && selected && selected !== 'sell' && sim.canPlace(hover.col, hover.row);
  const type = tower ? tower.type : previewing ? selected : null;
  const col = tower ? tower.col : (hover?.col ?? 0);
  stepLeds.forEach((led, step) => {
    led.classList.toggle(
      'fires',
      type !== null && type !== 'sell' && firesThisStep(type, col, step),
    );
  });
}
```

Change these functions:

- `updateHud`: set `livesEl.textContent` to `String(sim.lives)`, and `waveEl.textContent` to `${String(sim.wave).padStart(2, '0')}/${sim.waves.length}`. Change the countdown text to `Next ${seconds}s`, with the same calculation.
- `updateAutoWaveButton`: keep the `selected` toggle, remove the `textContent` line, and add `autoWaveButton.setAttribute('aria-pressed', String(autoWave))`.
- `showStartOverlay`: set the text to `Your defense plays the music.` and clear `overlayDetail`.
- `showEndOverlay`: change the signature to `showEndOverlay(message: string, detail: string)`, and set `overlayDetail.textContent = detail`.
- `frame()`: call `showEndOverlay('You won', `All ${sim.waves.length} waves cleared`)` and `showEndOverlay('Game over', `Reached wave ${sim.wave}/${sim.waves.length}`)`.

Keep `window.__drumline`, every `localStorage` key, every keyboard shortcut, and the `updateInfo` strings as they are.

### 9. Add the tests

Create `tests/pixel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bayer, circlePoints, linePoints } from '../src/pixel';

describe('bayer', () => {
  it('stays between 0 and 1 and repeats every 4 pixels', () => {
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(bayer(x, y)).toBeGreaterThanOrEqual(0);
        expect(bayer(x, y)).toBeLessThan(1);
        expect(bayer(x + 4, y + 4)).toBe(bayer(x, y));
      }
    }
  });
});

describe('linePoints', () => {
  it('includes both ends', () => {
    const points = linePoints(1, 2, 7, 5);
    expect(points[0]).toEqual([1, 2]);
    expect(points[points.length - 1]).toEqual([7, 5]);
  });

  it('moves one pixel at a time', () => {
    const points = linePoints(9, 1, 0, 6);
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1]!;
      const [x1, y1] = points[i]!;
      expect(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))).toBe(1);
    }
  });

  it('rounds to whole pixels', () => {
    expect(linePoints(0.4, 0.4, 2.2, 0.2)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });
});

describe('circlePoints', () => {
  it('keeps every point near the radius', () => {
    for (const [x, y] of circlePoints(20, 30, 8)) {
      expect(Math.abs(Math.hypot(x - 20, y - 30) - 8)).toBeLessThan(1);
    }
  });
});
```

Create `tests/sprites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LOGO_GLYPHS,
  MINI_GLYPHS,
  PIXEL_COLORS,
  SPRITES,
  STEP_GROUP_COLORS,
} from '../src/sprites';

describe('sprites', () => {
  it('keeps both frames of each sprite the same rectangle', () => {
    for (const [first, second] of Object.values(SPRITES)) {
      const width = first[0]?.length;
      expect(second).toHaveLength(first.length);
      for (const row of [...first, ...second]) {
        expect(row).toHaveLength(width ?? 0);
      }
    }
  });

  it('only uses defined colors', () => {
    for (const frames of Object.values(SPRITES)) {
      for (const row of [...frames[0], ...frames[1]]) {
        for (const character of row) {
          if (character !== '.') expect(PIXEL_COLORS[character]).toBeDefined();
        }
      }
    }
  });

  it('keeps towers inside one board cell', () => {
    for (const name of ['kick', 'hat', 'synth'] as const) {
      expect(SPRITES[name][0]).toHaveLength(16);
      expect(SPRITES[name][0][0]).toHaveLength(16);
    }
  });
});

describe('text', () => {
  it('covers every character in a chord label', () => {
    for (const character of '0123456789.x') {
      expect(MINI_GLYPHS[character]).toHaveLength(15);
    }
  });

  it('covers the logo', () => {
    for (const character of 'DRUMLINETD') {
      expect(LOGO_GLYPHS[character]).toHaveLength(7);
    }
  });

  it('has a color for each beat group', () => {
    expect(STEP_GROUP_COLORS).toHaveLength(4);
  });
});
```

### 10. Update the docs

`README.md`:

- Change the title to `# DrumlineTD`.
- Add this section after **Commands**:

```md
## Credits

The Silkscreen and VT323 fonts are used under the SIL Open Font License. Their licenses are in `src/fonts/`.
```

`AGENTS.md`:

- Change the first sentence to start `DrumlineTD is a browser tower defense game`.
- Add these rules to the **Rules** list:
  - `Draw the board in whole art pixels. In src/render.ts, don't use arc, shadowBlur, globalAlpha, setLineDash, fillText, or ctx.scale.`
  - `Keep sprites as data in src/sprites.ts, and keep src/pixel.ts free of the DOM.`
  - `Keep the drumline-* localStorage keys and window.__drumline names when the game's name changes, so saved settings survive.`

`docs/references.md`:

- Change the `src/render.ts` line to: `` `src/render.ts`: draws the board into a 256×128 buffer, then scales it onto the canvas. ``
- Add after it:
  - `` `src/sprites.ts`: colors, sprites, and bitmap letters, stored as data. ``
  - `` `src/pixel.ts`: pixel line, circle, and dither helpers with no DOM. ``
  - `` `src/fonts/`: self-hosted fonts and their licenses. ``
- Add a `## Visuals` section before `## Saved settings`:

```md
## Visuals

`Renderer` draws into a 256×128 buffer, one 16px tile per board cell. `present()` scales that up by a
whole number to at least the canvas's displayed size, then CSS scales it to fit. This keeps every art
pixel the same size at any width, which `image-rendering: pixelated` can't promise at fractional
scales.

The step strip above the board is DOM. `main.ts` lights the playhead's step, and outlines the steps
that the hovered or inspected tower plays on.
```

## Acceptance

Run these from the repository root.

- `git diff --no-index --quiet .handoff/assets/sprites.ts src/sprites.ts` exits 0.
- `git diff --no-index --quiet .handoff/assets/favicon.svg public/favicon.svg` exits 0.
- `git diff --no-index --quiet .handoff/assets/fonts/silkscreen-latin-400-normal.woff2 src/fonts/silkscreen-latin-400-normal.woff2` exits 0.
- `git diff --no-index --quiet .handoff/assets/fonts/vt323-latin-400-normal.woff2 src/fonts/vt323-latin-400-normal.woff2` exits 0.
- `git grep -n -E "\.arc\(|shadowBlur|globalAlpha|setLineDash|fillText|ctx\.scale" -- src/render.ts` prints nothing.
- `git grep -n PALETTE -- src tests` prints nothing.
- `git grep -n "drawTowerShape" -- src tests` prints nothing.
- `git grep -c "DrumlineTD" -- index.html` prints a count of at least 5.
- `git grep -n "DrumlineTD" -- README.md AGENTS.md` prints at least 2 lines.
- `git diff --numstat -- src/sim.ts` prints `1	1	src/sim.ts`.
- `git diff --quiet -- src/audio.ts src/music.ts src/scheduler.ts src/themes.ts src/waves.ts tests/balance.test.ts package.json package-lock.json` exits 0.
- `git diff --numstat -- src/config.ts` shows 0 insertions.

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
- Do not add dependencies or change `package.json` or `package-lock.json`.
- Do not change game rules, balance, audio, themes, tower stats, enemy stats, or wave data.
- Keep the `id` of every element that `src/main.ts` looks up.
- Keep the `localStorage` keys `drumline-theme`, `drumline-auto-wave`, and `drumline-volume`, and keep `window.__drumline`.
- Keep `src/sim.ts` free of the DOM, audio, and randomness.
- Do not load anything from a CDN. Fonts come from `src/fonts/`.
- Do not edit `src/sprites.ts` to change the art.

## Out of scope

- Renaming the repository, the npm package, the GitHub Pages URL, the `localStorage` keys, or `window.__drumline`.
- Music theme color palettes.
- New towers, upgrades, enemy types, or tutorial screens.
- Screen shake.
- Sprite redesigns.
- Changes to the `updateInfo` wording.
- `.github/workflows`.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and leave the working tree as it is. Do not improvise a different design.
