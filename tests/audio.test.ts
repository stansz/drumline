import { describe, expect, it } from 'vitest';
import { softClipCurve } from '../src/audio';

describe('softClipCurve', () => {
  const curve = softClipCurve();
  const at = (input: number): number =>
    curve[Math.round(((input + 1) / 2) * (curve.length - 1))] ?? Number.NaN;

  it('leaves levels below the knee unchanged', () => {
    for (const input of [-0.7, -0.25, 0, 0.25, 0.7]) {
      expect(at(input)).toBeCloseTo(input, 3);
    }
  });

  it('never reaches full scale', () => {
    expect(Math.max(...curve)).toBeLessThan(0.95);
    expect(Math.min(...curve)).toBeGreaterThan(-0.95);
  });

  it('rises at every step above the knee', () => {
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i] ?? 0).toBeGreaterThan(curve[i - 1] ?? 0);
    }
  });
});
