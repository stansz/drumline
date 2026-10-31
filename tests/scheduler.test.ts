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
});
