import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, TOWERS, towerStats, towerSpent, upgradeCost } from '../src/config';
import { Sim, firesThisStep, type SimEvent } from '../src/sim';
import { resolveRules } from '../tools/playtest/rules';

type NoteEvent = Extract<SimEvent, { kind: 'note' }>;
type ShotEvent = Extract<SimEvent, { kind: 'shot' }>;
type HitEvent = Extract<SimEvent, { kind: 'hit' }>;
type ChainEvent = Extract<SimEvent, { kind: 'chain' }>;

function noteEvents(events: SimEvent[]): NoteEvent[] {
  return events.filter((event): event is NoteEvent => event.kind === 'note');
}

function shotEvents(events: SimEvent[]): ShotEvent[] {
  return events.filter((event): event is ShotEvent => event.kind === 'shot');
}

function hitEvents(events: SimEvent[]): HitEvent[] {
  return events.filter((event): event is HitEvent => event.kind === 'hit');
}

function chainEvents(events: SimEvent[]): ChainEvent[] {
  return events.filter((event): event is ChainEvent => event.kind === 'chain');
}

function upgradedSim(type: 'kick' | 'hat' | 'synth', level: number): Sim {
  const sim = new Sim();
  expect(sim.placeTower(type, 5, 0)).toBe(true);
  sim.money = 1000;
  for (let current = 1; current < level; current += 1) {
    expect(sim.upgradeTower(5, 0)).toBe(true);
  }
  expect(sim.towers[0]?.level).toBe(level);
  return sim;
}

function addBrute(sim: Sim, id: number, progress: number): void {
  sim.enemies.push({ id, type: 'brute', hp: 500, maxHp: 500, progress });
}

describe('tower levels', () => {
  it('starts new towers at level 1', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.towers[0]?.level).toBe(1);
  });

  it('charges a kick 50, then 75, and then stops at max level', () => {
    const rules = resolveRules();
    expect(upgradeCost(rules, 'kick', 1)).toBe(50);
    expect(upgradeCost(rules, 'kick', 2)).toBe(75);
    expect(upgradeCost(rules, 'kick', 3)).toBeNull();
  });
});

describe('upgradeTower', () => {
  it('returns false with no tower, too little money, at max level, and after the game ends', () => {
    const sim = new Sim();
    expect(sim.upgradeTower(5, 0)).toBe(false);

    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    sim.money = 0;
    expect(sim.upgradeTower(5, 0)).toBe(false);

    sim.money = 150;
    expect(sim.upgradeTower(5, 0)).toBe(true);
    expect(sim.upgradeTower(5, 0)).toBe(true);
    expect(sim.towers[0]?.level).toBe(3);
    sim.money = 1000;
    expect(sim.upgradeTower(5, 0)).toBe(false);

    const ended = new Sim();
    expect(ended.placeTower('kick', 5, 0)).toBe(true);
    ended.money = 1000;
    ended.phase = 'lost';
    expect(ended.upgradeTower(5, 0)).toBe(false);
  });

  it('works during a wave', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    sim.money = 500;
    expect(sim.startWave()).toBe(true);
    expect(sim.phase).toBe('wave');
    expect(sim.upgradeTower(5, 0)).toBe(true);
    expect(sim.towers[0]?.level).toBe(2);
  });

  it('refunds 70% of everything spent on a level 3 kick', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    sim.money = 1000;
    expect(sim.upgradeTower(5, 0)).toBe(true);
    expect(sim.upgradeTower(5, 0)).toBe(true);
    expect(towerSpent(sim.rules, 'kick', 3)).toBe(175);
    sim.money = 0;
    expect(sim.sellTower(5, 0)).toBe(true);
    expect(sim.money).toBe(Math.floor(175 * sim.rules.sellRefund));
    expect(sim.money).toBe(122);
  });
});

describe('firing', () => {
  it('does not change fire steps or chord size at any level', () => {
    const sim = new Sim();
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    expect(sim.placeTower('kick', 5, 2)).toBe(true);
    for (const level of [1, 2, 3]) {
      for (const tower of sim.towers) tower.level = level;
      for (let step = 0; step < 16; step += 1) {
        expect(firesThisStep('kick', 5, step)).toBe(step === 5);
      }
      sim.stepIndex = 5;
      const notes = noteEvents(sim.step());
      expect(notes).toHaveLength(2);
      expect(notes.every((note) => note.chordSize === 2)).toBe(true);
    }
  });

  it('a level 2 kick deals its towerStats damage', () => {
    const sim = upgradedSim('kick', 2);
    addBrute(sim, 1, 5);
    sim.stepIndex = 5;
    const hits = hitEvents(sim.step());
    expect(hits).toHaveLength(1);
    expect(hits[0]?.damage).toBe(towerStats(sim.rules, 'kick', 2).damage);
  });

  it('a level 3 kick splash reaches an enemy a level 2 kick misses', () => {
    function splashHits(level: number): number {
      const sim = upgradedSim('kick', level);
      addBrute(sim, 1, 5);
      addBrute(sim, 2, 6.25);
      sim.stepIndex = 5;
      return hitEvents(sim.step()).length;
    }
    expect(splashHits(2)).toBe(1);
    expect(splashHits(3)).toBe(2);
  });

  it('a level 2 hat reaches an enemy a level 1 hat cannot', () => {
    function shotsAt(level: number): number {
      const sim = upgradedSim('hat', level);
      addBrute(sim, 1, 9);
      sim.stepIndex = 5;
      return shotEvents(sim.step()).length;
    }
    expect(shotsAt(1)).toBe(0);
    expect(shotsAt(2)).toBe(1);
  });

  it('a level 3 synth chains one link further than a level 2 synth', () => {
    function chains(level: number): number {
      const sim = upgradedSim('synth', level);
      for (let index = 0; index < 4; index += 1) addBrute(sim, 100 + index, 5 + index);
      sim.stepIndex = 5;
      return chainEvents(sim.step()).length;
    }
    expect(chains(2)).toBe(2);
    expect(chains(3)).toBe(3);
  });

  it('reads upgrades from the rules', () => {
    const rules = resolveRules({ upgrades: { kick: [{ costShare: 3, damage: 1 }] } });
    const sim = new Sim(DIFFICULTIES.hard, rules);
    expect(sim.placeTower('kick', 5, 0)).toBe(true);
    sim.money = 1000;
    const before = sim.money;
    expect(upgradeCost(rules, 'kick', 1)).toBe(150);
    expect(sim.upgradeTower(5, 0)).toBe(true);
    expect(sim.money).toBe(before - 150);
    addBrute(sim, 1, 5);
    sim.stepIndex = 5;
    const hits = hitEvents(sim.step());
    expect(hits[0]?.damage).toBe(towerStats(rules, 'kick', 2).damage);
    expect(towerStats(rules, 'kick', 2).damage).toBe(TOWERS.kick.damage + 1);
  });
});
