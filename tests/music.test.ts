import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR } from '../src/config';
import {
  arpNote,
  chordForStep,
  intensity,
  layerLevels,
  midiToHz,
} from '../src/music';

describe('midiToHz', () => {
  it('maps MIDI 69 to 440 Hz', () => {
    expect(midiToHz(69)).toBe(440);
  });
});

describe('chordForStep', () => {
  it('plays one chord per bar in Am7, Fmaj7, Cadd9, Gsus order', () => {
    expect(chordForStep(0).name).toBe('Am7');
    expect(chordForStep(STEPS_PER_BAR).name).toBe('Fmaj7');
    expect(chordForStep(STEPS_PER_BAR * 2).name).toBe('Cadd9');
    expect(chordForStep(STEPS_PER_BAR * 3).name).toBe('Gsus');
    expect(chordForStep(STEPS_PER_BAR * 4).name).toBe('Am7');
  });
});

describe('intensity', () => {
  it('clamps from 0 to 1', () => {
    expect(intensity(0, 0)).toBe(0);
    expect(intensity(12, 5)).toBe(1);
    expect(intensity(100, 100)).toBe(1);
  });
});

describe('layerLevels', () => {
  it('keeps bass and arp silent at zero intensity', () => {
    const levels = layerLevels(0);
    expect(levels.bass).toBe(0);
    expect(levels.arp).toBe(0);
  });

  it('opens every layer at full intensity', () => {
    const levels = layerLevels(1);
    expect(levels.pad).toBe(1);
    expect(levels.bass).toBe(1);
    expect(levels.arp).toBe(1);
  });
});

describe('arpNote', () => {
  it('returns only pad notes raised an octave', () => {
    for (let step = 0; step <= 62; step += 1) {
      const allowed = chordForStep(step).pad.map((note) => note + 12);
      expect(allowed).toContain(arpNote(step));
    }
  });
});
