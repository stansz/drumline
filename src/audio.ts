import { BPM, STEPS_PER_BAR, stepSeconds } from './config';
import type { TowerType } from './sim';

const PENTATONIC = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

function clampRow(row: number): number {
  return Math.max(0, Math.min(7, row));
}

function pentatonicFrequency(row: number): number {
  return PENTATONIC[7 - clampRow(row)] ?? 220;
}

export class Audio_ {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly masterLevel = 0.8;
  private muted = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterLevel;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.7;
    this.master.connect(this.filter);
    this.filter.connect(ctx.destination);

    const length = Math.max(1, Math.floor(ctx.sampleRate));
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  playNote(
    towerType: TowerType,
    row: number,
    time: number,
    hit: boolean,
    chordSize: number,
  ): void {
    const level = (hit ? 1 : 0.6) / Math.sqrt(Math.max(1, chordSize));
    if (towerType === 'kick') {
      this.playKick(row, time, level);
    } else if (towerType === 'hat') {
      this.playHat(row, time, level);
    } else {
      this.playSynth(row, time, level);
    }
  }

  private playKick(row: number, time: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const base = 52 + (7 - clampRow(row)) * 4;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 3.2, time);
    osc.frequency.exponentialRampToValueAtTime(base, time + 0.14);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.9 * level, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  private playHat(row: number, time: number, level: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 5600 + (7 - clampRow(row)) * 450;
    highpass.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28 * level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.master);
    source.start(time);
    source.stop(time + 0.06);
  }

  private playSynth(row: number, time: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pentatonicFrequency(row), time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100 + (7 - clampRow(row)) * 220, time);
    filter.Q.value = 4;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.32 * level, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  playMetronome(time: number, accent: boolean): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1700 : 1050, time);
    gain.gain.setValueAtTime(accent ? 0.05 : 0.025, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  playKill(time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const frequency = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] ?? 440;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency * 2, time);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.13);
  }

  playLeak(time: number): void {
    const bar = stepSeconds(BPM) * STEPS_PER_BAR;
    this.filter.frequency.cancelScheduledValues(time);
    this.filter.frequency.setValueAtTime(20000, time);
    this.filter.frequency.exponentialRampToValueAtTime(400, time + bar / 2);
    this.filter.frequency.exponentialRampToValueAtTime(20000, time + bar);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.master.gain.setTargetAtTime(
      this.muted ? 0 : this.masterLevel,
      this.ctx.currentTime,
      0.01,
    );
  }
}
