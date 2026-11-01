import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BPM, stepSeconds } from '../src/config';
import { Scheduler } from '../src/scheduler';

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules steady steps stepSeconds(BPM) apart', () => {
    const ctx = { currentTime: 0 };
    const times: number[] = [];
    const scheduler = new Scheduler(ctx, (time) => times.push(time));
    scheduler.start();

    ctx.currentTime += scheduler.stepDuration;
    vi.advanceTimersByTime(25);
    ctx.currentTime += scheduler.stepDuration;
    vi.advanceTimersByTime(25);

    scheduler.stop();

    expect(times).toHaveLength(2);
    expect((times[1] ?? 0) - (times[0] ?? 0)).toBeCloseTo(stepSeconds(BPM), 6);
  });

  it('does not fire a burst of past-due steps after the clock jumps', () => {
    const ctx = { currentTime: 0 };
    const times: number[] = [];
    const scheduler = new Scheduler(ctx, (time) => times.push(time));
    scheduler.start();

    ctx.currentTime += scheduler.stepDuration;
    vi.advanceTimersByTime(25);
    const beforeJump = times.length;

    ctx.currentTime += 5;
    vi.advanceTimersByTime(25);
    const afterJump = times.slice(beforeJump);

    scheduler.stop();

    expect(afterJump.length).toBeLessThanOrEqual(3);
    for (const time of afterJump) {
      expect(time).toBeGreaterThanOrEqual(ctx.currentTime);
    }
  });

  it('stays ahead of the audio clock through 120 ms stalls', () => {
    const ctx = { currentTime: 0 };
    let late = 0;
    let steps = 0;
    const scheduler = new Scheduler(ctx, (time) => {
      steps += 1;
      if (time < ctx.currentTime) late += 1;
    });
    scheduler.start();

    for (let i = 0; i < 40; i += 1) {
      ctx.currentTime += 0.12;
      vi.advanceTimersByTime(25);
    }

    scheduler.stop();

    expect(steps).toBeGreaterThan(30);
    expect(late).toBe(0);
  });
});
