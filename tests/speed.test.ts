import { describe, expect, it } from 'vitest';
import { BPM, SPEED_BPMS } from '../src/config';

describe('speeds', () => {
  it('offers 120, 180, and 240 BPM, starting from the base tempo', () => {
    expect(SPEED_BPMS).toEqual([120, 180, 240]);
    expect(SPEED_BPMS[0]).toBe(BPM);
  });
});
