import { BPM, stepSeconds } from './config';

// How far ahead steps are scheduled. Slow phones can stall for this long without a late note.
const LOOKAHEAD_SECONDS = 0.15;

export class Scheduler {
  bpm: number;
  lastStepTime: number;
  stepDuration: number;

  private readonly ctx: Pick<AudioContext, 'currentTime'>;
  private readonly onStep: (time: number, stepDuration: number) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;

  constructor(
    ctx: Pick<AudioContext, 'currentTime'>,
    onStep: (time: number, stepDuration: number) => void,
  ) {
    this.ctx = ctx;
    this.onStep = onStep;
    this.bpm = BPM;
    this.lastStepTime = 0;
    this.stepDuration = stepSeconds(this.bpm);
  }

  start(): void {
    if (this.timer !== null) return;
    this.nextStepTime = this.ctx.currentTime + LOOKAHEAD_SECONDS;
    this.lastStepTime = this.nextStepTime;
    this.stepDuration = stepSeconds(this.bpm);
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    if (this.nextStepTime < this.ctx.currentTime - 0.2) {
      this.nextStepTime = this.ctx.currentTime + LOOKAHEAD_SECONDS;
    }
    while (this.nextStepTime < this.ctx.currentTime + LOOKAHEAD_SECONDS) {
      this.stepDuration = stepSeconds(this.bpm);
      this.lastStepTime = this.nextStepTime;
      this.onStep(this.nextStepTime, this.stepDuration);
      this.nextStepTime += this.stepDuration;
    }
  }
}
