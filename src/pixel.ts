// Pixel helpers with no DOM, so they can be unit tested.

import { MINI_GLYPHS } from './sprites';

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
