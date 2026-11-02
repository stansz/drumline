import { describe, expect, it } from 'vitest';
import {
  LEVEL_BADGES,
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

  it('keeps level badges rectangular, inside a cell, and using defined colors', () => {
    for (const rows of Object.values(LEVEL_BADGES)) {
      const width = rows[0]?.length ?? 0;
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThanOrEqual(16);
      expect(rows.length).toBeLessThanOrEqual(16);
      for (const row of rows) {
        expect(row).toHaveLength(width);
        for (const character of row) {
          if (character !== '.') expect(PIXEL_COLORS[character]).toBeDefined();
        }
      }
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
