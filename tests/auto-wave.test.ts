import { describe, expect, it } from 'vitest';
import { AUTO_WAVE_STEPS } from '../src/config';
import { Sim } from '../src/sim';

function autoSim(): Sim {
  const sim = new Sim();
  sim.lives = 1000000;
  sim.setAutoWave(true);
  return sim;
}

function clearWave(sim: Sim): void {
  sim.startWave();
  while (sim.phase === 'wave') sim.step();
}

function runSteps(sim: Sim, count: number): void {
  for (let i = 0; i < count; i += 1) sim.step();
}

describe('automatic waves', () => {
  it('is off by default, so later waves wait for the player', () => {
    const sim = new Sim();
    sim.lives = 1000000;
    clearWave(sim);
    runSteps(sim, AUTO_WAVE_STEPS * 3);
    expect(sim.wave).toBe(1);
    expect(sim.phase).toBe('build');
    expect(sim.stepsUntilNextWave()).toBeNull();
  });

  it('leaves the first wave to the player', () => {
    const sim = autoSim();
    runSteps(sim, AUTO_WAVE_STEPS * 3);
    expect(sim.wave).toBe(0);
    expect(sim.stepsUntilNextWave()).toBeNull();
  });

  it('starts the next wave after the countdown', () => {
    const sim = autoSim();
    clearWave(sim);
    expect(sim.stepsUntilNextWave()).toBe(AUTO_WAVE_STEPS);
    runSteps(sim, AUTO_WAVE_STEPS);
    expect(sim.wave).toBe(1);
    expect(sim.stepsUntilNextWave()).toBe(0);
    const events = sim.step();
    expect(sim.wave).toBe(2);
    expect(sim.phase).toBe('wave');
    expect(sim.stepsUntilNextWave()).toBeNull();
    expect(events).toContainEqual({ kind: 'waveStart', wave: 2 });
  });

  it('lets the player send the next wave early', () => {
    const sim = autoSim();
    clearWave(sim);
    runSteps(sim, 3);
    expect(sim.startWave()).toBe(true);
    expect(sim.wave).toBe(2);
    expect(sim.stepsUntilNextWave()).toBeNull();
  });

  it('cancels the countdown when turned off', () => {
    const sim = autoSim();
    clearWave(sim);
    sim.setAutoWave(false);
    expect(sim.stepsUntilNextWave()).toBeNull();
    runSteps(sim, AUTO_WAVE_STEPS * 2);
    expect(sim.wave).toBe(1);
  });

  it('starts a countdown when turned on between waves', () => {
    const sim = new Sim();
    sim.lives = 1000000;
    clearWave(sim);
    sim.setAutoWave(true);
    expect(sim.stepsUntilNextWave()).toBe(AUTO_WAVE_STEPS);
  });

  it('stops after the last wave', () => {
    const sim = autoSim();
    sim.wave = sim.waves.length - 1;
    clearWave(sim);
    expect(sim.phase).toBe('won');
    expect(sim.stepsUntilNextWave()).toBeNull();
  });
});
