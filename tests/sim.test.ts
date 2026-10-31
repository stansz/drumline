import { describe, expect, it } from 'vitest';
import { SELL_REFUND, TOWERS } from '../src/config';
import { Sim, pathCells, pathLength, type SimEvent } from '../src/sim';

function noteEvents(events: SimEvent[]): Extract<SimEvent, { kind: 'note' }>[] {
  return events.filter((event): event is Extract<SimEvent, { kind: 'note' }> => {
    return event.kind === 'note';
  });
}

describe('path', () => {
  it('pathCells has no duplicates', () => {
    const cells = pathCells();
    const keys = new Set(cells.map(([col, row]) => `${col},${row}`));
    expect(keys.size).toBe(cells.length);
  });
});

describe('economy', () => {
  it('placeTower rejects path cells, occupied cells, and placements with too little money', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 0, 1)).toBe(false);
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.placeTower('hat', 5, 0)).toBe(false);
    sim.money = 10;
    expect(sim.placeTower('hat', 6, 0)).toBe(false);
    expect(sim.money).toBe(10);
  });

  it('sellTower refunds Math.floor(cost * SELL_REFUND)', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    const before = sim.money;
    expect(sim.sellTower(5, 0)).toBe(true);
    expect(sim.money).toBe(before + Math.floor(TOWERS.kick.cost * SELL_REFUND));
    expect(sim.sellTower(5, 0)).toBe(false);
  });
});

describe('sequencer', () => {
  it('a kick in column 5 emits exactly one note per 16 steps, at step 5', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    const steps: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const stepIndex = sim.stepIndex;
      const notes = noteEvents(sim.step());
      if (notes.length > 0) steps.push(stepIndex);
    }
    expect(steps).toEqual([5]);
  });

  it('a hat in column 5 emits four notes per 16 steps, at steps 1, 5, 9, 13', () => {
    const sim = new Sim();
    expect(sim.placeTower('hat', 5, 0)).toBe(true);
    const steps: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const stepIndex = sim.stepIndex;
      const notes = noteEvents(sim.step());
      if (notes.length > 0) steps.push(stepIndex);
    }
    expect(steps).toEqual([1, 5, 9, 13]);
  });

  it('towers play notes in the build phase with hit === false', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    for (let i = 0; i < 5; i += 1) sim.step();
    expect(sim.phase).toBe('build');
    const notes = noteEvents(sim.step());
    expect(notes).toHaveLength(1);
    expect(notes[0]?.hit).toBe(false);
  });

  it('two kicks in the same column report chordSize 2 and both deal boosted damage', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.placeTower('kick', 5, 2)).toBe(true);
    sim.enemies.push({
      id: 999,
      type: 'brute',
      hp: 120,
      maxHp: 120,
      progress: 5,
    });
    sim.stepIndex = 5;
    const events = sim.step();
    const notes = noteEvents(events);
    expect(notes).toHaveLength(2);
    expect(notes.every((note) => note.chordSize === 2)).toBe(true);
    expect(notes.every((note) => note.hit)).toBe(true);
    expect(sim.enemies.find((enemy) => enemy.id === 999)?.hp).toBe(120 - 12 * 1.25 * 2);
  });
});

describe('determinism', () => {
  it('two sims given identical actions end deep-equal', () => {
    function run(): Sim {
      const sim = new Sim();
      expect(sim.placeTower('kick', 5, 0)).toBe(true);
      expect(sim.placeTower('hat', 6, 0)).toBe(true);
      expect(sim.startWave()).toBe(true);
      for (let i = 0; i < 400; i += 1) sim.step();
      return sim;
    }

    const a = run();
    const b = run();
    expect(a.money).toBe(b.money);
    expect(a.lives).toBe(b.lives);
    expect(a.totalSteps).toBe(b.totalSteps);
    expect(a.enemies).toEqual(b.enemies);
  });
});

describe('losing', () => {
  it('sets the phase to lost when lives reach 0', () => {
    const sim = new Sim();
    sim.lives = 1;
    sim.enemies.push({
      id: 999,
      type: 'brute',
      hp: 120,
      maxHp: 120,
      progress: pathLength() - 0.01,
    });
    const events = sim.step();
    expect(sim.lives).toBe(0);
    expect(sim.phase).toBe('lost');
    expect(events.some((event) => event.kind === 'lost')).toBe(true);
  });
});
