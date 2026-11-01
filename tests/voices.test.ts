import { describe, expect, it } from 'vitest';
import { TOWER_VOICE_LIMITS } from '../src/config';
import { pickVoices } from '../src/music';
import type { TowerType } from '../src/sim';

function notes(type: TowerType, count: number, hit = true) {
  return Array.from({ length: count }, (_, row) => ({ towerType: type, row, hit }));
}

describe('pickVoices', () => {
  it('keeps every note under the limits', () => {
    const chord = [...notes('kick', 2), ...notes('hat', 1), ...notes('synth', 3)];
    expect(pickVoices(chord)).toHaveLength(6);
  });

  it('limits each instrument on its own', () => {
    const chord = [...notes('kick', 8), ...notes('hat', 8), ...notes('synth', 8)];
    const voices = pickVoices(chord);
    for (const type of ['kick', 'hat', 'synth'] as const) {
      expect(voices.filter((voice) => voice.towerType === type)).toHaveLength(
        TOWER_VOICE_LIMITS[type],
      );
    }
  });

  it('never returns a note twice', () => {
    const voices = pickVoices(notes('synth', 8));
    expect(new Set(voices).size).toBe(voices.length);
  });

  it('spreads a big chord across its pitches', () => {
    const rows = pickVoices(notes('synth', 9)).map((voice) => voice.row);
    expect(rows).toEqual([0, 3, 6]);
  });

  it('prefers notes that hit', () => {
    const voices = pickVoices([...notes('hat', 4, false), ...notes('hat', 2, true)]);
    expect(voices.every((voice) => voice.hit)).toBe(true);
  });

  it('handles an empty step', () => {
    expect(pickVoices([])).toEqual([]);
  });
});
