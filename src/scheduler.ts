import { BPM, stepSeconds } from './config';

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
    this.nextStepTime = this.ctx.currentTime + 0.06;
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
      this.nextStepTime = this.ctx.currentTime + 0.06;
    }
    while (this.nextStepTime < this.ctx.currentTime + 0.06) {
      this.stepDuration = stepSeconds(this.bpm);
      this.lastStepTime = this.nextStepTime;
      this.onStep(this.nextStepTime, this.stepDuration);
      this.nextStepTime += this.stepDuration;
    }
  }
}
