import { describe, expect, it } from 'vitest';
import { playBot } from './bots';

describe('balance', () => {
  it('idle ends lost', () => {
    const result = playBot('idle');
    console.log(
      `idle result=${result.result} wave=${result.wave} lives=${result.lives} money=${result.money}`,
    );
    expect(result.result).toBe('lost');
  });

  it('spread ends won with lives between 5 and 19 inclusive', () => {
    const result = playBot('spread');
    console.log(
      `spread result=${result.result} wave=${result.wave} lives=${result.lives} money=${result.money}`,
    );
    expect(result.result).toBe('won');
    expect(result.lives).toBeGreaterThanOrEqual(5);
    expect(result.lives).toBeLessThanOrEqual(19);
  });

  it('chord reaches wave >= 4', () => {
    const result = playBot('chord');
    console.log(
      `chord result=${result.result} wave=${result.wave} lives=${result.lives} money=${result.money}`,
    );
    expect(result.wave).toBeGreaterThanOrEqual(4);
  });
});
