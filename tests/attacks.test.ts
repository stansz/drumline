import { describe, expect, it } from 'vitest';
import { pathPoint, Sim, type EnemyType, type SimEvent } from '../src/sim';

type ShotEvent = Extract<SimEvent, { kind: 'shot' }>;
type ChainEvent = Extract<SimEvent, { kind: 'chain' }>;
type HitEvent = Extract<SimEvent, { kind: 'hit' }>;

function shotEvents(events: SimEvent[]): ShotEvent[] {
  return events.filter((event): event is ShotEvent => event.kind === 'shot');
}

function chainEvents(events: SimEvent[]): ChainEvent[] {
  return events.filter((event): event is ChainEvent => event.kind === 'chain');
}

function hitEvents(events: SimEvent[]): HitEvent[] {
  return events.filter((event): event is HitEvent => event.kind === 'hit');
}

function addEnemy(sim: Sim, id: number, type: EnemyType, progress: number): void {
  sim.enemies.push({ id, type, hp: 120, maxHp: 120, progress });
}

describe('attack events', () => {
  it('a kick in range emits exactly one shot before its hit events', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    addEnemy(sim, 7, 'brute', 5);
    sim.stepIndex = 5;

    const events = sim.step();
    const shots = shotEvents(events);
    expect(shots).toHaveLength(1);
    const shot = shots[0];
    if (!shot) throw new Error('missing shot');
    const target = pathPoint(5);
    expect(shot.x).toBe(target.x);
    expect(shot.y).toBe(target.y);

    const shotIndex = events.findIndex((event) => event.kind === 'shot');
    const hitIndices = events.flatMap((event, index) => (event.kind === 'hit' ? [index] : []));
    expect(hitIndices.length).toBeGreaterThan(0);
    for (const index of hitIndices) {
      expect(shotIndex).toBeLessThan(index);
    }
  });

  it('a tower with no target in range emits a miss note and no shot', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    sim.stepIndex = 5;

    const events = sim.step();
    const notes = events.filter((event) => event.kind === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.hit).toBe(false);
    expect(shotEvents(events)).toHaveLength(0);
  });

  it('a synth with three enemies in chain range emits one shot and two chains', () => {
    const sim = new Sim();
    expect(sim.placeTower('synth', 5, 0)).toBe(true);
    addEnemy(sim, 101, 'brute', 5);
    addEnemy(sim, 102, 'brute', 6);
    addEnemy(sim, 103, 'brute', 7);
    sim.stepIndex = 5;

    const events = sim.step();
    const shots = shotEvents(events);
    const chains = chainEvents(events);
    const hits = hitEvents(events);
    expect(shots).toHaveLength(1);
    expect(chains).toHaveLength(2);
    expect(hits).toHaveLength(3);

    const primary = pathPoint(7);
    expect(shots[0]?.x).toBe(primary.x);
    expect(shots[0]?.y).toBe(primary.y);

    const knownIds = new Set([101, 102, 103]);
    for (const hit of hits) {
      expect(knownIds.has(hit.enemyId)).toBe(true);
    }
    expect(new Set(hits.map((hit) => hit.enemyId)).size).toBe(3);

    for (const chain of chains) {
      const chainIndex = events.indexOf(chain);
      expect(events[chainIndex + 1]?.kind).toBe('hit');
    }
  });

  it("a chain event's start point matches the previous target's position", () => {
    const sim = new Sim();
    expect(sim.placeTower('synth', 5, 0)).toBe(true);
    addEnemy(sim, 101, 'brute', 5);
    addEnemy(sim, 102, 'brute', 6);
    addEnemy(sim, 103, 'brute', 7);
    sim.stepIndex = 5;

    const events = sim.step();
    const ordered = events.filter(
      (event): event is ChainEvent | HitEvent =>
        event.kind === 'chain' || event.kind === 'hit',
    );
    for (let i = 0; i < ordered.length; i += 1) {
      const event = ordered[i];
      if (event?.kind !== 'chain') continue;
      const previous = ordered[i - 1];
      expect(previous?.kind).toBe('hit');
      if (previous?.kind !== 'hit') throw new Error('chain has no preceding hit');
      expect(event.fromX).toBe(previous.x);
      expect(event.fromY).toBe(previous.y);
    }
  });

  it('two towers firing on the same step both emit a chorded shot', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.placeTower('kick', 5, 2)).toBe(true);
    addEnemy(sim, 42, 'brute', 5);
    sim.stepIndex = 5;

    const events = sim.step();
    const shots = shotEvents(events);
    expect(shots).toHaveLength(2);
    expect(shots.every((shot) => shot.chordSize === 2)).toBe(true);
  });
});
