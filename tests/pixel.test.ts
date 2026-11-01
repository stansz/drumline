import { describe, expect, it } from 'vitest';
import { bayer, circlePoints, drawText, linePoints } from '../src/pixel';
import { MINI_GLYPHS } from '../src/sprites';

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
