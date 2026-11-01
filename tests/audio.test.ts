import { describe, expect, it } from 'vitest';
import { crushCurve, parseVolume, softClipCurve, volumeGain } from '../src/audio';

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

describe('crushCurve', () => {
  it('quantizes every value to one of the crush steps', () => {
    for (const value of crushCurve()) {
      expect(value * 24).toBeCloseTo(Math.round(value * 24), 3);
    }
  });

  it('stays within full scale and silent at the center', () => {
    const curve = crushCurve();
    expect(Math.max(...curve)).toBe(1);
    expect(Math.min(...curve)).toBe(-1);
    expect(Math.abs(curve[(curve.length - 1) / 2] ?? 1)).toBe(0);
  });
});

describe('volumeGain', () => {
  it('passes full volume through unchanged and silences zero', () => {
    expect(volumeGain(100)).toBe(1);
    expect(volumeGain(0)).toBe(0);
  });

  it('follows a squared curve', () => {
    expect(volumeGain(50)).toBeCloseTo(0.25, 5);
  });
});

describe('parseVolume', () => {
  it('uses full volume when nothing usable is stored', () => {
    expect(parseVolume(null)).toBe(100);
    expect(parseVolume('')).toBe(100);
    expect(parseVolume('loud')).toBe(100);
  });

  it('keeps stored values within range', () => {
    expect(parseVolume('40')).toBe(40);
    expect(parseVolume('0')).toBe(0);
    expect(parseVolume('140')).toBe(100);
    expect(parseVolume('-5')).toBe(0);
  });
});
