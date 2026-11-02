import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DIFFICULTIES, ENEMIES, TOWERS } from '../src/config';
import { Sim, type SimEvent } from '../src/sim';
import { buildWaves } from '../src/waves';
import { resolveRules } from '../tools/playtest/rules';

function hitDamages(events: SimEvent[]): number[] {
  return events.flatMap((event) => (event.kind === 'hit' ? [event.damage] : []));
}

describe('rules', () => {
  it('DEFAULT_RULES points at the config tables', () => {
    expect(DEFAULT_RULES.towers).toBe(TOWERS);
    expect(DEFAULT_RULES.enemies).toBe(ENEMIES);
  });

  it('a new Sim uses DEFAULT_RULES', () => {
    expect(new Sim().rules).toBe(DEFAULT_RULES);
  });

  it('buildWaves defaults to the ENEMIES table', () => {
    expect(buildWaves(DIFFICULTIES.hard)).toEqual(buildWaves(DIFFICULTIES.hard, ENEMIES));
  });
});

describe('patched rules', () => {
  it('charges the tower cost from the rules', () => {
    const rules = resolveRules({ towers: { kick: { cost: 10 } } });
    const sim = new Sim(DIFFICULTIES.hard, rules);
    const before = sim.money;
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.money).toBe(before - 10);
  });

  it('refunds the sell fraction from the rules', () => {
    const rules = resolveRules({ sellRefund: 0.5 });
    const sim = new Sim(DIFFICULTIES.hard, rules);
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    const before = sim.money;
    expect(sim.sellTower(5, 0)).toBe(true);
    expect(sim.money).toBe(before + Math.floor(TOWERS.kick.cost * 0.5));
  });

  it('builds waves from patched enemy health', () => {
    const rules = resolveRules({ enemies: { blip: { hp: 60 } } });
    const patched = new Sim(DIFFICULTIES.hard, rules).waves;
    const normal = new Sim(DIFFICULTIES.hard).waves;
    const blipHp = (waves: typeof normal, index: number): number | undefined =>
      waves[index]?.find((group) => group.type === 'blip')?.hp;
    expect(blipHp(patched, 1)).not.toBe(blipHp(normal, 1));
  });

  it('leaves the config tables untouched', () => {
    resolveRules({ towers: { kick: { damage: 99 } } });
    expect(TOWERS.kick.damage).toBe(12);
  });
});

describe('hit damage', () => {
  it('reports chain falloff', () => {
    const sim = new Sim();
    expect(sim.placeTower('synth', 5, 0)).toBe(true);
    sim.enemies.push({ id: 101, type: 'brute', hp: 120, maxHp: 120, progress: 5 });
    sim.enemies.push({ id: 102, type: 'brute', hp: 120, maxHp: 120, progress: 6 });
    sim.enemies.push({ id: 103, type: 'brute', hp: 120, maxHp: 120, progress: 7 });
    sim.stepIndex = 5;

    expect(hitDamages(sim.step())).toEqual([18, 9, 9]);
  });

  it('boosts every hit in a chord', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.placeTower('kick', 5, 2)).toBe(true);
    sim.enemies.push({ id: 999, type: 'brute', hp: 120, maxHp: 120, progress: 5 });
    sim.stepIndex = 5;

    const damages = hitDamages(sim.step());
    expect(damages).toHaveLength(2);
    for (const damage of damages) {
      expect(damage).toBeCloseTo(TOWERS.kick.damage * 1.25);
    }
  });
});
