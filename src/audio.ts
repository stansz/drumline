import { BPM, MIX, STEPS_PER_BAR, stepSeconds } from './config';
import { midiToHz } from './music';
import type { TowerType } from './sim';
import { BACKING_DRUMS, DEFAULT_THEME, type DrumPart, type Theme } from './themes';

const REVERB_SECONDS = 2.2;
const SOFT_CLIP_KNEE = 0.7;
const SOFT_CLIP_CEILING = 0.95;
const SOFT_CLIP_POINTS = 4097;

// Linear below the knee, then eases toward the ceiling. A WaveShaper holds the last curve value
// for any louder input, so this caps the output however much the limiter lets through.
export function softClipCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(SOFT_CLIP_POINTS);
  const headroom = SOFT_CLIP_CEILING - SOFT_CLIP_KNEE;
  for (let i = 0; i < curve.length; i += 1) {
    const input = (i / (curve.length - 1)) * 2 - 1;
    const level = Math.abs(input);
    const shaped =
      level <= SOFT_CLIP_KNEE
        ? level
        : SOFT_CLIP_KNEE + headroom * Math.tanh((level - SOFT_CLIP_KNEE) / headroom);
    curve[i] = Math.sign(input) * shaped;
  }
  return curve;
}

function clampRow(row: number): number {
  return Math.max(0, Math.min(7, row));
}

export class Audio_ {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly towerBus: GainNode;
  private readonly musicBus: GainNode;
  private readonly fxBus: GainNode;
  private readonly delay: DelayNode;
  private readonly delaySend: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly analyserData: Float32Array<ArrayBuffer>;
  private readonly noiseBuffer: AudioBuffer;
  private readonly masterLevel = 0.8;
  private theme: Theme = DEFAULT_THEME;
  private muted = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterLevel;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.7;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;

    const softClip = ctx.createWaveShaper();
    softClip.curve = softClipCurve();
    softClip.oversample = '4x';

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyserData = new Float32Array(this.analyser.fftSize);

    this.master.connect(this.filter);
    this.filter.connect(limiter);
    limiter.connect(softClip);
    softClip.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.towerBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.fxBus = ctx.createGain();
    this.towerBus.gain.value = 1;
    this.musicBus.gain.value = 1;
    this.fxBus.gain.value = 1;
    this.towerBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.fxBus.connect(this.master);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.createReverbImpulse(REVERB_SECONDS);
    reverb.connect(this.fxBus);
    const musicReverbSend = ctx.createGain();
    const towerReverbSend = ctx.createGain();
    musicReverbSend.gain.value = MIX.reverbSend;
    towerReverbSend.gain.value = MIX.reverbSend;
    this.musicBus.connect(musicReverbSend);
    musicReverbSend.connect(reverb);
    this.towerBus.connect(towerReverbSend);
    towerReverbSend.connect(reverb);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = stepSeconds(BPM) * 3;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = MIX.delayFeedback;
    this.delay.connect(delayFeedback);
    delayFeedback.connect(this.delay);
    this.delay.connect(this.fxBus);
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = MIX.delaySend;
    this.delaySend.connect(this.delay);

    const length = Math.max(1, Math.floor(ctx.sampleRate));
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  private createReverbImpulse(seconds: number): AudioBuffer {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) {
        const decay = Math.exp((-4 * i) / data.length);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    return impulse;
  }

  playNote(
    towerType: TowerType,
    row: number,
    time: number,
    hit: boolean,
    chordSize: number,
  ): void {
    const baseLevel = (hit ? 1 : 0.6) / Math.sqrt(Math.max(1, chordSize));
    const level = baseLevel * (0.9 + Math.random() * 0.2);
    if (towerType === 'kick') {
      this.musicBus.gain.setValueAtTime(1 - MIX.duckAmount, time);
      this.musicBus.gain.linearRampToValueAtTime(1, time + MIX.duckRelease);
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
    const base = this.theme.kick.baseHz + (7 - clampRow(row)) * 4;
    osc.type = this.theme.kick.wave;
    osc.frequency.setValueAtTime(base * this.theme.kick.sweep, time);
    osc.frequency.exponentialRampToValueAtTime(base, time + 0.14);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(MIX.kick * level, 0.0001), time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + this.theme.kick.decay);
    osc.connect(gain);
    gain.connect(this.towerBus);
    osc.start(time);
    osc.stop(time + this.theme.kick.decay + 0.02);
  }

  private playHat(row: number, time: number, level: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = this.theme.hat.highpassHz + (7 - clampRow(row)) * 450;
    highpass.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(MIX.hat * level, 0.0001), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + this.theme.hat.decay);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.towerBus);
    source.start(time);
    source.stop(time + this.theme.hat.decay + 0.01);
  }

  private playSynth(row: number, time: number, level: number): void {
    const saw = this.ctx.createOscillator();
    const triangle = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const frequency = midiToHz(this.theme.synth.scale[7 - clampRow(row)] ?? 57);
    saw.type = this.theme.synth.waves[0];
    saw.frequency.setValueAtTime(frequency, time);
    triangle.type = this.theme.synth.waves[1];
    triangle.frequency.setValueAtTime(frequency / 2, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.theme.synth.cutoffHz + (7 - clampRow(row)) * 160, time);
    filter.Q.value = 1.5;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(MIX.synth * level, 0.0001), time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + this.theme.synth.decay);
    saw.connect(filter);
    triangle.connect(filter);
    filter.connect(gain);
    gain.connect(this.towerBus);
    gain.connect(this.delaySend);
    saw.start(time);
    triangle.start(time);
    saw.stop(time + this.theme.synth.decay + 0.02);
    triangle.stop(time + this.theme.synth.decay + 0.02);
  }

  playMetronome(time: number, accent: boolean): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1700 : 1050, time);
    gain.gain.setValueAtTime(accent ? MIX.metronome : MIX.metronome / 2, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  playKill(time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const scale = this.theme.synth.scale;
    const frequency = midiToHz(scale[Math.floor(Math.random() * scale.length)] ?? 69);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency * 2, time);
    gain.gain.setValueAtTime(MIX.kill, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    osc.connect(gain);
    gain.connect(this.fxBus);
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

  playPad(notes: number[], time: number, duration: number, level: number): void {
    if (notes.length === 0) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.theme.pad.cutoffHz;
    filter.connect(this.musicBus);

    const perNote = (MIX.pad * this.theme.levels.pad * level) / notes.length;
    const peak = Math.max(perNote, 0.0001);
    const attackEnd = time + 0.4;
    const sustainStart = Math.max(attackEnd, time + duration);
    const releaseEnd = time + duration + 0.5;

    for (const note of notes) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, attackEnd);
      gain.gain.setValueAtTime(peak, sustainStart);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
      gain.connect(filter);
      for (const detune of [-6, 6]) {
        const osc = this.ctx.createOscillator();
        osc.type = this.theme.pad.wave;
        osc.frequency.setValueAtTime(midiToHz(note), time);
        osc.detune.setValueAtTime(detune, time);
        osc.connect(gain);
        osc.start(time);
        osc.stop(releaseEnd + 0.02);
      }
    }
  }

  playBass(note: number, time: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = this.theme.bassWave;
    osc.frequency.setValueAtTime(midiToHz(note), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIX.bass * this.theme.levels.bass * level, 0.0001),
      time + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  playArp(note: number, time: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = this.theme.arpWave;
    osc.frequency.setValueAtTime(midiToHz(note), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIX.arp * this.theme.levels.arp * level, 0.0001),
      time + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.musicBus);
    gain.connect(this.delaySend);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  playBackingDrum(part: DrumPart, time: number, level: number): void {
    const peak = Math.max(BACKING_DRUMS[part] * level, 0.0001);
    const gain = this.ctx.createGain();
    gain.connect(this.musicBus);
    if (part === 'kick') {
      const osc = this.ctx.createOscillator();
      const base = this.theme.kick.baseHz;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * 2, time);
      osc.frequency.exponentialRampToValueAtTime(base, time + 0.08);
      gain.gain.setValueAtTime(peak, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + 0.18);
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = part === 'snare' ? 'bandpass' : 'highpass';
    filter.frequency.value = part === 'snare' ? 1800 : this.theme.hat.highpassHz;
    const decay = part === 'snare' ? 0.12 : 0.03;
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter);
    filter.connect(gain);
    source.start(time);
    source.stop(time + decay + 0.01);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  setTempo(stepDuration: number): void {
    this.delay.delayTime.setTargetAtTime(stepDuration * 3, this.ctx.currentTime, 0.05);
  }

  readPeak(): number {
    this.analyser.getFloatTimeDomainData(this.analyserData);
    let peak = 0;
    for (let i = 0; i < this.analyserData.length; i += 1) {
      const sample = Math.abs(this.analyserData[i] ?? 0);
      if (sample > peak) peak = sample;
    }
    return peak;
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
