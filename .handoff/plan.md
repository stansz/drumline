## Goal

Make the Chiptune, Lo-fi, Techno, and Funk themes sound clearly different from each other by giving each its own arrangement, space, master tone, and tower sound recipes. Neon stays exactly as it sounds today. Replace the 2× button with three speeds set by BPM: 120, 180, and 240.

## Files to touch

- `src/themes.ts`
- `src/audio.ts`
- `src/music.ts`
- `src/config.ts`
- `src/main.ts`
- `src/style.css`
- `index.html`
- `README.md`
- `docs/balance.md`
- `tests/themes.test.ts`
- `tests/audio.test.ts`
- `tests/music.test.ts`
- `tests/speed.test.ts` (new)
- `tests/loudness.ts`
- `.handoff/report.md`

## Steps

### 1. Replace `src/themes.ts`

Write this file exactly:

```ts
import { ARP_STEPS, BASS_STEPS, MIX, MUSIC_CHORDS } from './config';

export type DrumPart = 'kick' | 'snare' | 'hat';
export type Wave = OscillatorType | 'pulse';
export type NoiseKind = 'white' | 'chip' | 'metal';

export const DRUM_PARTS: DrumPart[] = ['kick', 'snare', 'hat'];

export interface Theme {
  id: string;
  name: string;
  chords: ReadonlyArray<{ name: string; pad: number[]; bass: number }>;
  swing: number;
  crackle: number;
  space: {
    reverbSend: number;
    reverbSeconds: number;
    delaySend: number;
    delayFeedback: number;
    toneHz: number;
    crush: number;
  };
  chord: {
    style: 'hold' | 'stab' | 'none';
    steps: number[];
    wave: Wave;
    cutoffHz: number;
    decay: number;
    level: number;
    wobbleCents: number;
  };
  bass: {
    steps: number[];
    wave: Wave;
    decay: number;
    level: number;
    filter: { startHz: number; endHz: number; q: number } | null;
    octaveSteps: number[];
    ghostSteps: number[];
    sweepBars: number;
  };
  arp: {
    steps: number[];
    rate: number;
    wave: Wave;
    decay: number;
    level: number;
    minLevel: number;
  };
  drums: Record<DrumPart, number[]>;
  drumLevels: Record<DrumPart, number>;
  drumKit: { snareHz: number; snareDecay: number; hatDecay: number };
  kick: {
    wave: Wave;
    baseHz: number;
    sweep: number;
    sweepTime: number;
    attack: number;
    decay: number;
    click: number;
  };
  hat: {
    noise: NoiseKind;
    filter: BiquadFilterType;
    filterHz: number;
    q: number;
    decay: number;
    level: number;
  };
  synth: {
    waves: [Wave, Wave];
    secondRatio: number;
    filter: BiquadFilterType;
    filterHz: number;
    filterEndHz: number | null;
    q: number;
    attack: number;
    decay: number;
    scale: number[];
  };
}

const NEON: Theme = {
  id: 'neon',
  name: 'Neon',
  chords: MUSIC_CHORDS,
  swing: 0,
  crackle: 0,
  space: {
    reverbSend: MIX.reverbSend,
    reverbSeconds: 2.2,
    delaySend: MIX.delaySend,
    delayFeedback: MIX.delayFeedback,
    toneHz: 20000,
    crush: 0,
  },
  chord: {
    style: 'hold',
    steps: [0],
    wave: 'sawtooth',
    cutoffHz: 900,
    decay: 0,
    level: 1,
    wobbleCents: 0,
  },
  bass: {
    steps: BASS_STEPS,
    wave: 'triangle',
    decay: 0.3,
    level: 1,
    filter: null,
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 0,
  },
  arp: { steps: ARP_STEPS, rate: 2, wave: 'triangle', decay: 0.18, level: 1, minLevel: 0 },
  drums: { kick: [], snare: [], hat: [] },
  drumLevels: { kick: 0, snare: 0, hat: 0 },
  drumKit: { snareHz: 1800, snareDecay: 0.12, hatDecay: 0.03 },
  kick: { wave: 'sine', baseHz: 52, sweep: 3.2, sweepTime: 0.14, attack: 0.005, decay: 0.3, click: 0 },
  hat: { noise: 'white', filter: 'highpass', filterHz: 5600, q: 0.8, decay: 0.05, level: 1 },
  synth: {
    waves: ['sawtooth', 'triangle'],
    secondRatio: 0.5,
    filter: 'lowpass',
    filterHz: 900,
    filterEndHz: null,
    q: 1.5,
    attack: 0.01,
    decay: 0.24,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
};

const CHIPTUNE: Theme = {
  id: 'chiptune',
  name: 'Chiptune',
  chords: [
    { name: 'C', pad: [60, 64, 67, 72], bass: 48 },
    { name: 'G', pad: [59, 62, 67, 71], bass: 43 },
    { name: 'Am', pad: [57, 60, 64, 69], bass: 45 },
    { name: 'F', pad: [57, 60, 65, 69], bass: 41 },
  ],
  swing: 0,
  crackle: 0,
  space: {
    reverbSend: 0,
    reverbSeconds: 0.4,
    delaySend: 0,
    delayFeedback: 0.2,
    toneHz: 12000,
    crush: 0.6,
  },
  chord: {
    style: 'none',
    steps: [],
    wave: 'square',
    cutoffHz: 2200,
    decay: 0,
    level: 0,
    wobbleCents: 0,
  },
  bass: {
    steps: [0, 2, 4, 6, 8, 10, 12, 14],
    wave: 'triangle',
    decay: 0.12,
    level: 1.2,
    filter: null,
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 0,
  },
  arp: {
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    rate: 1,
    wave: 'pulse',
    decay: 0.08,
    level: 1.1,
    minLevel: 0.7,
  },
  drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 6, 10, 14] },
  drumLevels: { kick: 0.3, snare: 0.16, hat: 0.07 },
  drumKit: { snareHz: 2600, snareDecay: 0.07, hatDecay: 0.02 },
  kick: { wave: 'square', baseHz: 90, sweep: 5, sweepTime: 0.05, attack: 0.002, decay: 0.09, click: 0 },
  hat: { noise: 'chip', filter: 'highpass', filterHz: 3000, q: 0.8, decay: 0.035, level: 1 },
  synth: {
    waves: ['pulse', 'pulse'],
    secondRatio: 1,
    filter: 'lowpass',
    filterHz: 6000,
    filterEndHz: null,
    q: 0.7,
    attack: 0.002,
    decay: 0.12,
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
  },
};

const LOFI: Theme = {
  id: 'lofi',
  name: 'Lo-fi',
  chords: [
    { name: 'Dm9', pad: [53, 57, 60, 64], bass: 38 },
    { name: 'G13', pad: [53, 59, 64, 69], bass: 43 },
    { name: 'Cmaj9', pad: [52, 59, 62, 67], bass: 48 },
    { name: 'Am9', pad: [55, 60, 64, 71], bass: 45 },
  ],
  swing: 0.22,
  crackle: 0.12,
  space: {
    reverbSend: 0.12,
    reverbSeconds: 0.9,
    delaySend: 0.1,
    delayFeedback: 0.25,
    toneHz: 3600,
    crush: 0,
  },
  chord: {
    style: 'stab',
    steps: [0, 10],
    wave: 'sine',
    cutoffHz: 1500,
    decay: 1.1,
    level: 1.7,
    wobbleCents: 9,
  },
  bass: {
    steps: [0, 7, 10],
    wave: 'sine',
    decay: 0.45,
    level: 1.1,
    filter: null,
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 0,
  },
  arp: { steps: [6, 14], rate: 2, wave: 'sine', decay: 0.3, level: 0.8, minLevel: 0 },
  drums: { kick: [0, 10], snare: [8], hat: [0, 3, 6, 8, 11, 14] },
  drumLevels: { kick: 0.34, snare: 0.2, hat: 0.06 },
  drumKit: { snareHz: 1300, snareDecay: 0.16, hatDecay: 0.04 },
  kick: { wave: 'sine', baseHz: 44, sweep: 2, sweepTime: 0.08, attack: 0.012, decay: 0.24, click: 0 },
  hat: { noise: 'white', filter: 'bandpass', filterHz: 3400, q: 0.7, decay: 0.05, level: 0.7 },
  synth: {
    waves: ['sine', 'triangle'],
    secondRatio: 2,
    filter: 'lowpass',
    filterHz: 1400,
    filterEndHz: null,
    q: 0.7,
    attack: 0.02,
    decay: 0.45,
    scale: [55, 57, 60, 62, 64, 67, 69, 72],
  },
};

const TECHNO: Theme = {
  id: 'techno',
  name: 'Techno',
  chords: [
    { name: 'Am', pad: [57, 60, 64], bass: 45 },
    { name: 'Am', pad: [57, 60, 64], bass: 45 },
    { name: 'F', pad: [57, 60, 65], bass: 41 },
    { name: 'Em', pad: [55, 59, 64], bass: 40 },
  ],
  swing: 0,
  crackle: 0,
  space: {
    reverbSend: 0.45,
    reverbSeconds: 3.2,
    delaySend: 0.32,
    delayFeedback: 0.5,
    toneHz: 9000,
    crush: 0,
  },
  chord: {
    style: 'stab',
    steps: [3, 6, 11],
    wave: 'sawtooth',
    cutoffHz: 1800,
    decay: 0.16,
    level: 1.5,
    wobbleCents: 0,
  },
  bass: {
    steps: [2, 6, 10, 14],
    wave: 'sawtooth',
    decay: 0.18,
    level: 0.8,
    filter: { startHz: 2400, endHz: 180, q: 12 },
    octaveSteps: [],
    ghostSteps: [],
    sweepBars: 8,
  },
  arp: { steps: [], rate: 2, wave: 'square', decay: 0.1, level: 0, minLevel: 0 },
  drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  drumLevels: { kick: 0.42, snare: 0.12, hat: 0.1 },
  drumKit: { snareHz: 3200, snareDecay: 0.1, hatDecay: 0.09 },
  kick: { wave: 'sine', baseHz: 42, sweep: 6, sweepTime: 0.06, attack: 0.002, decay: 0.32, click: 0.25 },
  hat: { noise: 'metal', filter: 'highpass', filterHz: 7000, q: 1, decay: 0.05, level: 1 },
  synth: {
    waves: ['sawtooth', 'sawtooth'],
    secondRatio: 1.005,
    filter: 'lowpass',
    filterHz: 2400,
    filterEndHz: 500,
    q: 8,
    attack: 0.002,
    decay: 0.16,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
  },
};

const FUNK: Theme = {
  id: 'funk',
  name: 'Funk',
  chords: [
    { name: 'E9', pad: [56, 62, 66, 71], bass: 40 },
    { name: 'A13', pad: [55, 61, 66, 71], bass: 45 },
    { name: 'E9', pad: [56, 62, 66, 71], bass: 40 },
    { name: 'B9', pad: [57, 61, 63, 66], bass: 47 },
  ],
  swing: 0.14,
  crackle: 0,
  space: {
    reverbSend: 0.08,
    reverbSeconds: 0.35,
    delaySend: 0,
    delayFeedback: 0.1,
    toneHz: 12000,
    crush: 0,
  },
  chord: {
    style: 'stab',
    steps: [2, 5, 10, 13],
    wave: 'sawtooth',
    cutoffHz: 1700,
    decay: 0.09,
    level: 1.7,
    wobbleCents: 0,
  },
  bass: {
    steps: [0, 3, 6, 8, 10, 13],
    wave: 'sawtooth',
    decay: 0.16,
    level: 0.85,
    filter: { startHz: 1800, endHz: 350, q: 3 },
    octaveSteps: [6, 13],
    ghostSteps: [3, 8],
    sweepBars: 0,
  },
  arp: { steps: [], rate: 2, wave: 'sawtooth', decay: 0.1, level: 0, minLevel: 0 },
  drums: { kick: [0, 3, 10], snare: [4, 7, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  drumLevels: { kick: 0.36, snare: 0.18, hat: 0.06 },
  drumKit: { snareHz: 1900, snareDecay: 0.1, hatDecay: 0.02 },
  kick: { wave: 'sine', baseHz: 62, sweep: 3, sweepTime: 0.05, attack: 0.002, decay: 0.13, click: 0.15 },
  hat: { noise: 'white', filter: 'highpass', filterHz: 9000, q: 2, decay: 0.018, level: 1 },
  synth: {
    waves: ['sawtooth', 'square'],
    secondRatio: 0.5,
    filter: 'bandpass',
    filterHz: 500,
    filterEndHz: 2400,
    q: 6,
    attack: 0.005,
    decay: 0.2,
    scale: [55, 57, 59, 62, 64, 67, 69, 71],
  },
};

export const DEFAULT_THEME = NEON;

export const THEMES: Theme[] = [NEON, CHIPTUNE, LOFI, TECHNO, FUNK];

export function themeById(id: string | null): Theme {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

export function nextTheme(current: Theme): Theme {
  const index = THEMES.indexOf(current);
  return THEMES[(index + 1) % THEMES.length] ?? DEFAULT_THEME;
}
```

### 2. Update `src/music.ts`

Change `arpNote` to this:

```ts
export function arpNote(
  musicStep: number,
  chords: ReadonlyArray<(typeof MUSIC_CHORDS)[number]> = MUSIC_CHORDS,
  rate = 2,
): number {
  const pad = chordForStep(musicStep, chords).pad;
  const index = Math.floor(musicStep / rate) % pad.length;
  return (pad[index] ?? pad[0] ?? 0) + 12;
}
```

### 3. Update `src/config.ts`

Replace `export const FAST_BPM = 240;` with:

```ts
export const SPEED_BPMS = [BPM, 180, 240];
```

Leave every other line unchanged.

### 4. Update `src/audio.ts`

Make these changes. Do not change `softClipCurve`, `clampRow`, `playNote`, `playMetronome`, `setTempo`, `readPeak`, or `setMuted`.

**Imports and constants.** Replace the first four import lines and the `REVERB_SECONDS` line with:

```ts
import { BPM, MIX, STEPS_PER_BAR, stepSeconds } from './config';
import { arpNote, chordForStep, midiToHz, type layerLevels } from './music';
import type { TowerType } from './sim';
import {
  DEFAULT_THEME,
  DRUM_PARTS,
  type DrumPart,
  type NoiseKind,
  type Theme,
  type Wave,
} from './themes';

const CRUSH_STEPS = 24;
const CRUSH_POINTS = 4097;
const CHIP_NOISE_HOLD = 14;
const CRACKLE_SECONDS = 3;
const METAL_HZ = [80, 120, 166.4, 217.2, 271.6, 328.4];
const PULSE_DUTY = 0.125;
const PULSE_HARMONICS = 32;
```

**New helpers.** Add these directly after `softClipCurve`:

```ts
export function crushCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(CRUSH_POINTS);
  for (let i = 0; i < curve.length; i += 1) {
    const input = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.round(input * CRUSH_STEPS) / CRUSH_STEPS;
  }
  return curve;
}

// Fixed seed, so the generated buffers never consume Math.random.
function seededNoise(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
```

**Fields.** In the class, replace `private readonly noiseBuffer: AudioBuffer;` with:

```ts
  private readonly noiseBuffers: Record<NoiseKind, AudioBuffer>;
  private readonly reverb: ConvolverNode;
  private readonly reverbImpulses = new Map<number, AudioBuffer>();
  private readonly musicReverbSend: GainNode;
  private readonly towerReverbSend: GainNode;
  private readonly delayFeedback: GainNode;
  private readonly crushDry: GainNode;
  private readonly crushWet: GainNode;
  private readonly crackleGain: GainNode;
  private readonly pulseWave: PeriodicWave;
```

**Constructor.**

Replace `this.master.connect(this.filter);` with:

```ts
    // A WaveShaper curve can only be set once, so themes crossfade this path in and out.
    const crusher = ctx.createWaveShaper();
    crusher.curve = crushCurve();
    this.crushDry = ctx.createGain();
    this.crushWet = ctx.createGain();
    this.crushDry.gain.value = 1;
    this.crushWet.gain.value = 0;
    this.master.connect(this.crushDry);
    this.master.connect(crusher);
    crusher.connect(this.crushWet);
    this.crushDry.connect(this.filter);
    this.crushWet.connect(this.filter);
```

Replace the block from `const reverb = ctx.createConvolver();` through `towerReverbSend.connect(reverb);` with:

```ts
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.reverbImpulse(DEFAULT_THEME.space.reverbSeconds);
    this.reverb.connect(this.fxBus);
    this.musicReverbSend = ctx.createGain();
    this.towerReverbSend = ctx.createGain();
    this.musicReverbSend.gain.value = MIX.reverbSend;
    this.towerReverbSend.gain.value = MIX.reverbSend;
    this.musicBus.connect(this.musicReverbSend);
    this.musicReverbSend.connect(this.reverb);
    this.towerBus.connect(this.towerReverbSend);
    this.towerReverbSend.connect(this.reverb);
```

Replace `const delayFeedback = ctx.createGain();` through `delayFeedback.connect(this.delay);` with:

```ts
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = MIX.delayFeedback;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
```

Replace the block from `const length = Math.max(1, Math.floor(ctx.sampleRate));` through the end of the constructor with:

```ts
    const length = Math.max(1, Math.floor(ctx.sampleRate));
    const white = ctx.createBuffer(1, length, ctx.sampleRate);
    const whiteData = white.getChannelData(0);
    for (let i = 0; i < whiteData.length; i += 1) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    const chipRandom = seededNoise(7);
    const chip = ctx.createBuffer(1, length, ctx.sampleRate);
    const chipData = chip.getChannelData(0);
    let held = 0;
    for (let i = 0; i < chipData.length; i += 1) {
      if (i % CHIP_NOISE_HOLD === 0) held = chipRandom() * 2 - 1;
      chipData[i] = held;
    }

    const metal = ctx.createBuffer(1, length, ctx.sampleRate);
    const metalData = metal.getChannelData(0);
    for (let i = 0; i < metalData.length; i += 1) {
      let sum = 0;
      for (const hz of METAL_HZ) {
        sum += Math.sign(Math.sin((2 * Math.PI * hz * 16 * i) / ctx.sampleRate));
      }
      metalData[i] = sum / METAL_HZ.length;
    }
    this.noiseBuffers = { white, chip, metal };

    const real = new Float32Array(PULSE_HARMONICS + 1);
    const imag = new Float32Array(PULSE_HARMONICS + 1);
    for (let n = 1; n <= PULSE_HARMONICS; n += 1) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * PULSE_DUTY);
    }
    this.pulseWave = ctx.createPeriodicWave(real, imag);

    const crackleRandom = seededNoise(11);
    const crackle = ctx.createBuffer(
      1,
      Math.max(1, Math.floor(ctx.sampleRate * CRACKLE_SECONDS)),
      ctx.sampleRate,
    );
    const crackleData = crackle.getChannelData(0);
    for (let i = 0; i < crackleData.length; i += 1) {
      const hiss = (crackleRandom() * 2 - 1) * 0.02;
      const pop = crackleRandom() < 0.0004 ? (crackleRandom() * 2 - 1) * 0.7 : 0;
      crackleData[i] = hiss + pop;
    }
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = crackle;
    crackleSource.loop = true;
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0;
    crackleSource.connect(this.crackleGain);
    this.crackleGain.connect(this.master);
    crackleSource.start();
  }
```

**Reverb impulses.** Add this method directly after `createReverbImpulse`:

```ts
  private reverbImpulse(seconds: number): AudioBuffer {
    const cached = this.reverbImpulses.get(seconds);
    if (cached) return cached;
    const impulse = this.createReverbImpulse(seconds);
    this.reverbImpulses.set(seconds, impulse);
    return impulse;
  }

  private setWave(osc: OscillatorNode, wave: Wave): void {
    if (wave === 'pulse') {
      osc.setPeriodicWave(this.pulseWave);
    } else {
      osc.type = wave;
    }
  }

  private wobble(target: AudioParam, time: number, end: number): void {
    const cents = this.theme.chord.wobbleCents;
    if (cents <= 0) return;
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = 3.2;
    depth.gain.value = cents;
    lfo.connect(depth);
    depth.connect(target);
    lfo.start(time);
    lfo.stop(end);
  }
```

**Tower voices.** Replace `playKick`, `playHat`, and `playSynth` with:

```ts
  private playKick(row: number, time: number, level: number): void {
    const kick = this.theme.kick;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const base = kick.baseHz + (7 - clampRow(row)) * 4;
    this.setWave(osc, kick.wave);
    osc.frequency.setValueAtTime(base * kick.sweep, time);
    osc.frequency.exponentialRampToValueAtTime(base, time + kick.sweepTime);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(MIX.kick * level, 0.0001), time + kick.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + kick.decay);
    osc.connect(gain);
    gain.connect(this.towerBus);
    osc.start(time);
    osc.stop(time + kick.decay + 0.02);
    if (kick.click > 0) this.playClick(time, kick.click * level);
  }

  private playClick(time: number, level: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffers.white;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 2000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(level, 0.0001), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.towerBus);
    source.start(time);
    source.stop(time + 0.02);
  }

  private playHat(row: number, time: number, level: number): void {
    const hat = this.theme.hat;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffers[hat.noise];
    const filter = this.ctx.createBiquadFilter();
    filter.type = hat.filter;
    filter.frequency.value = hat.filterHz + (7 - clampRow(row)) * 450;
    filter.Q.value = hat.q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(MIX.hat * hat.level * level, 0.0001), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + hat.decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.towerBus);
    source.start(time);
    source.stop(time + hat.decay + 0.01);
  }

  private playSynth(row: number, time: number, level: number): void {
    const synth = this.theme.synth;
    const first = this.ctx.createOscillator();
    const second = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const frequency = midiToHz(synth.scale[7 - clampRow(row)] ?? 57);
    this.setWave(first, synth.waves[0]);
    first.frequency.setValueAtTime(frequency, time);
    this.setWave(second, synth.waves[1]);
    second.frequency.setValueAtTime(frequency * synth.secondRatio, time);
    filter.type = synth.filter;
    filter.frequency.setValueAtTime(synth.filterHz + (7 - clampRow(row)) * 160, time);
    if (synth.filterEndHz !== null) {
      filter.frequency.exponentialRampToValueAtTime(synth.filterEndHz, time + synth.decay);
    }
    filter.Q.value = synth.q;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(MIX.synth * level, 0.0001), time + synth.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + synth.decay);
    first.connect(filter);
    second.connect(filter);
    filter.connect(gain);
    gain.connect(this.towerBus);
    gain.connect(this.delaySend);
    first.start(time);
    second.start(time);
    first.stop(time + synth.decay + 0.02);
    second.stop(time + synth.decay + 0.02);
  }
```

**Leak.** In `playLeak`, add `const tone = this.theme.space.toneHz;` as the first line. Replace both `20000` values in `playLeak` with `tone`.

**Music.** Replace `playPad`, `playBass`, `playArp`, and `playBackingDrum` with the following, and keep them in this order:

```ts
  playMusicStep(
    musicStep: number,
    time: number,
    duration: number,
    levels: ReturnType<typeof layerLevels>,
  ): void {
    const theme = this.theme;
    const local = musicStep % STEPS_PER_BAR;
    const swung = time + (local % 2 === 1 ? duration * theme.swing : 0);
    const chord = chordForStep(musicStep, theme.chords);

    if (theme.chord.steps.includes(local)) {
      if (theme.chord.style === 'hold') {
        this.playPad(chord.pad, time, duration * STEPS_PER_BAR, levels.pad);
      } else if (theme.chord.style === 'stab') {
        this.playStab(chord.pad, swung, levels.pad);
      }
    }

    if (levels.bass > 0 && theme.bass.steps.includes(local)) {
      const note = chord.bass + (theme.bass.octaveSteps.includes(local) ? 12 : 0);
      const ghost = theme.bass.ghostSteps.includes(local) ? 0.45 : 1;
      const sweepSteps = theme.bass.sweepBars * STEPS_PER_BAR;
      const sweep = sweepSteps > 0 ? (musicStep % sweepSteps) / sweepSteps : 0;
      this.playBass(note, swung, levels.bass * ghost, sweep);
    }

    const arpLevel = Math.max(levels.arp, theme.arp.minLevel);
    if (arpLevel > 0 && theme.arp.steps.includes(local)) {
      this.playArp(arpNote(musicStep, theme.chords, theme.arp.rate), swung, arpLevel);
    }

    for (const part of DRUM_PARTS) {
      if (theme.drums[part].includes(local)) this.playBackingDrum(part, swung, levels.pad);
    }
  }

  private playPad(notes: number[], time: number, duration: number, level: number): void {
    if (notes.length === 0) return;
    const chord = this.theme.chord;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = chord.cutoffHz;
    filter.connect(this.musicBus);

    const perNote = (MIX.pad * chord.level * level) / notes.length;
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
        this.setWave(osc, chord.wave);
        osc.frequency.setValueAtTime(midiToHz(note), time);
        osc.detune.setValueAtTime(detune, time);
        osc.connect(gain);
        osc.start(time);
        osc.stop(releaseEnd + 0.02);
      }
    }
  }

  private playStab(notes: number[], time: number, level: number): void {
    if (notes.length === 0) return;
    const chord = this.theme.chord;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = chord.cutoffHz;
    filter.connect(this.musicBus);
    filter.connect(this.delaySend);

    const peak = Math.max((MIX.pad * chord.level * level) / Math.sqrt(notes.length), 0.0001);
    const end = time + chord.decay;
    for (const note of notes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      this.setWave(osc, chord.wave);
      osc.frequency.setValueAtTime(midiToHz(note), time);
      this.wobble(osc.detune, time, end + 0.02);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(time);
      osc.stop(end + 0.02);
    }
  }

  private playBass(note: number, time: number, level: number, sweep: number): void {
    const bass = this.theme.bass;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    this.setWave(osc, bass.wave);
    osc.frequency.setValueAtTime(midiToHz(note), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIX.bass * bass.level * level, 0.0001),
      time + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, time + bass.decay);
    if (bass.filter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = bass.filter.q;
      filter.frequency.setValueAtTime(bass.filter.startHz * (1 + 2 * sweep), time);
      filter.frequency.exponentialRampToValueAtTime(bass.filter.endHz, time + bass.decay);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + bass.decay + 0.02);
  }

  private playArp(note: number, time: number, level: number): void {
    const arp = this.theme.arp;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    this.setWave(osc, arp.wave);
    osc.frequency.setValueAtTime(midiToHz(note), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIX.arp * arp.level * level, 0.0001),
      time + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, time + arp.decay);
    osc.connect(gain);
    gain.connect(this.musicBus);
    gain.connect(this.delaySend);
    osc.start(time);
    osc.stop(time + arp.decay + 0.02);
  }

  private playBackingDrum(part: DrumPart, time: number, level: number): void {
    const theme = this.theme;
    const peak = Math.max(theme.drumLevels[part] * level, 0.0001);
    const gain = this.ctx.createGain();
    gain.connect(this.musicBus);
    if (part === 'kick') {
      const osc = this.ctx.createOscillator();
      const base = theme.kick.baseHz;
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
    const filter = this.ctx.createBiquadFilter();
    const decay = part === 'snare' ? theme.drumKit.snareDecay : theme.drumKit.hatDecay;
    if (part === 'snare') {
      source.buffer = this.noiseBuffers.white;
      filter.type = 'bandpass';
      filter.frequency.value = theme.drumKit.snareHz;
    } else {
      source.buffer = this.noiseBuffers[theme.hat.noise];
      filter.type = theme.hat.filter;
      filter.frequency.value = theme.hat.filterHz;
    }
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter);
    filter.connect(gain);
    source.start(time);
    source.stop(time + decay + 0.01);
  }
```

**Theme switching.** Replace `setTheme` with:

```ts
  setTheme(theme: Theme): void {
    this.theme = theme;
    const now = this.ctx.currentTime;
    const space = theme.space;
    this.musicReverbSend.gain.setTargetAtTime(space.reverbSend, now, 0.02);
    this.towerReverbSend.gain.setTargetAtTime(space.reverbSend, now, 0.02);
    this.delaySend.gain.setTargetAtTime(space.delaySend, now, 0.02);
    this.delayFeedback.gain.setTargetAtTime(space.delayFeedback, now, 0.02);
    this.filter.frequency.setTargetAtTime(space.toneHz, now, 0.02);
    this.crushDry.gain.setTargetAtTime(1 - space.crush, now, 0.02);
    this.crushWet.gain.setTargetAtTime(space.crush, now, 0.02);
    this.crackleGain.gain.setTargetAtTime(theme.crackle, now, 0.02);
    this.reverb.buffer = this.reverbImpulse(space.reverbSeconds);
  }
```

### 5. Update `src/main.ts`

- In the `./config` import, replace `FAST_BPM` with `SPEED_BPMS`.
- Change the music import to `import { intensity, layerLevels } from './music';`.
- Change the themes import to `import { DEFAULT_THEME, nextTheme, themeById, type Theme } from './themes';`.
- Replace `const fastButton = byId<HTMLButtonElement>('fast');` with `const speedButton = byId<HTMLButtonElement>('speed');`.
- Replace `let fast = false;` with `let speedIndex = 0;`.
- In `onStep`, delete `const local = musicStep % STEPS_PER_BAR;`. Replace the pad `if`, the bass `if`, the arp `if`, and the drum `for` loop with `audio.playMusicStep(musicStep, time, duration, levels);`.
- Remove `STEPS_PER_BAR` from the `./config` import if nothing else in the file uses it.
- In `startGame`, replace `scheduler.bpm = fast ? FAST_BPM : BPM;` with `scheduler.bpm = currentBpm();`.
- Replace `toggleFast` with:

```ts
function currentBpm(): number {
  return SPEED_BPMS[speedIndex] ?? BPM;
}

function updateSpeedButton(): void {
  speedButton.textContent = `${currentBpm()} BPM`;
  speedButton.classList.toggle('selected', speedIndex > 0);
}

function cycleSpeed(): void {
  speedIndex = (speedIndex + 1) % SPEED_BPMS.length;
  if (scheduler) scheduler.bpm = currentBpm();
  updateSpeedButton();
}
```

- In `resetRun`, replace `fast = false;` with `speedIndex = 0;`, and replace `fastButton.classList.remove('selected');` with `updateSpeedButton();`.
- Replace `fastButton.addEventListener('click', toggleFast);` with `speedButton.addEventListener('click', cycleSpeed);`.
- In the keydown `switch`, replace `toggleFast();` with `cycleSpeed();`.
- Add `updateSpeedButton();` directly after `updateThemeButton();` at the bottom of the file.

### 6. Update `index.html`

Replace `<button id="fast" type="button">2×</button>` with `<button id="speed" type="button">120 BPM</button>`.

### 7. Update `src/style.css`

Rename the `#fast` selector to `#speed`. Leave its rules unchanged.

### 8. Update `README.md`

Replace the line `- **F** toggle 2× speed` with `- **F** change speed: 120, 180, or 240 BPM`.

### 9. Update `docs/balance.md`

- Replace the table heading `Time at 1×` with `Time at 120 BPM`.
- Replace `Times count wave play only, not time spent building. Runs take half as long at 2× speed.` with `Times count wave play only, not time spent building. Runs take half as long at 240 BPM.`

### 10. Replace `tests/themes.test.ts`

Write this file exactly:

```ts
import { describe, expect, it } from 'vitest';
import { ARP_STEPS, BASS_STEPS, MIX, MUSIC_CHORDS, STEPS_PER_BAR } from '../src/config';
import { DEFAULT_THEME, DRUM_PARTS, THEMES, nextTheme, themeById } from '../src/themes';

describe('themes', () => {
  it('keeps the default theme identical to the original music', () => {
    expect(DEFAULT_THEME.chords).toEqual(MUSIC_CHORDS);
    expect(DEFAULT_THEME.chord.style).toBe('hold');
    expect(DEFAULT_THEME.bass.steps).toEqual(BASS_STEPS);
    expect(DEFAULT_THEME.arp.steps).toEqual(ARP_STEPS);
    expect(DEFAULT_THEME.space.reverbSend).toBe(MIX.reverbSend);
    expect(DEFAULT_THEME.space.delaySend).toBe(MIX.delaySend);
    expect(DEFAULT_THEME.space.delayFeedback).toBe(MIX.delayFeedback);
    expect(DEFAULT_THEME.space.crush).toBe(0);
    expect(DEFAULT_THEME.swing).toBe(0);
    expect(DEFAULT_THEME.crackle).toBe(0);
    for (const part of DRUM_PARTS) {
      expect(DEFAULT_THEME.drums[part]).toHaveLength(0);
    }
  });

  it('gives every theme a unique id and four chords with bass notes', () => {
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
    for (const theme of THEMES) {
      expect(theme.chords).toHaveLength(4);
      for (const chord of theme.chords) {
        expect(chord.pad.length).toBeGreaterThanOrEqual(3);
        expect(chord.bass).toBeLessThan(Math.min(...chord.pad));
      }
    }
  });

  it('places every pattern inside one bar', () => {
    for (const theme of THEMES) {
      const steps = [
        ...theme.chord.steps,
        ...theme.bass.steps,
        ...theme.bass.octaveSteps,
        ...theme.bass.ghostSteps,
        ...theme.arp.steps,
        ...theme.drums.kick,
        ...theme.drums.snare,
        ...theme.drums.hat,
      ];
      for (const step of steps) {
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThan(STEPS_PER_BAR);
      }
    }
  });

  it('gives every row a rising synth note', () => {
    for (const theme of THEMES) {
      expect(theme.synth.scale).toHaveLength(8);
      for (let i = 1; i < theme.synth.scale.length; i += 1) {
        expect(theme.synth.scale[i] ?? 0).toBeGreaterThan(theme.synth.scale[i - 1] ?? 0);
      }
    }
  });

  it('keeps backing drums quieter than the matching towers', () => {
    for (const theme of THEMES) {
      expect(theme.drumLevels.kick).toBeLessThan(MIX.kick * 0.6);
      expect(theme.drumLevels.hat).toBeLessThan(MIX.hat * 0.6);
      expect(theme.drumLevels.snare).toBeLessThan(MIX.synth);
    }
  });

  it('gives every theme its own sound recipes', () => {
    for (const part of ['space', 'chord', 'bass', 'arp', 'kick', 'hat', 'synth'] as const) {
      const recipes = THEMES.map((theme) => JSON.stringify(theme[part]));
      expect(new Set(recipes).size).toBe(THEMES.length);
    }
  });

  it('swings only Lo-fi and Funk', () => {
    const swung = THEMES.filter((theme) => theme.swing > 0).map((theme) => theme.id);
    expect(swung).toEqual(['lofi', 'funk']);
    for (const theme of THEMES) {
      expect(theme.swing).toBeLessThanOrEqual(0.3);
    }
  });

  it('cycles through every theme and wraps to the first', () => {
    let theme = DEFAULT_THEME;
    const seen = [theme.id];
    for (let i = 1; i < THEMES.length; i += 1) {
      theme = nextTheme(theme);
      seen.push(theme.id);
    }
    expect(seen).toEqual(THEMES.map((item) => item.id));
    expect(nextTheme(theme)).toBe(DEFAULT_THEME);
  });

  it('finds a saved theme and falls back on an unknown one', () => {
    expect(themeById('techno').name).toBe('Techno');
    expect(themeById('missing')).toBe(DEFAULT_THEME);
    expect(themeById(null)).toBe(DEFAULT_THEME);
  });
});
```

### 11. Update `tests/audio.test.ts`

Change the import to `import { crushCurve, softClipCurve } from '../src/audio';`. Add this at the end of the file:

```ts
describe('crushCurve', () => {
  it('quantizes every value to one of the crush steps', () => {
    for (const value of crushCurve()) {
      expect(value * 24).toBeCloseTo(Math.round(value * 24), 3);
    }
  });

  it('stays within full scale and silent at the center', () => {
    const curve = crushCurve();
    expect(Math.max(...curve)).toBe(1);
    expect(Math.min(...curve)).toBe(-1);
    expect(Math.abs(curve[(curve.length - 1) / 2] ?? 1)).toBe(0);
  });
});
```

### 12. Update `tests/music.test.ts`

- Add `import { MUSIC_CHORDS } from '../src/config';` by adding `MUSIC_CHORDS` to the existing `../src/config` import.
- Add this test inside `describe('arpNote', ...)`, after the existing test:

```ts
  it('moves through the chord at the given rate', () => {
    const pad = MUSIC_CHORDS[0]?.pad ?? [];
    expect(arpNote(1, MUSIC_CHORDS, 1)).toBe((pad[1] ?? 0) + 12);
    expect(arpNote(1, MUSIC_CHORDS, 2)).toBe((pad[0] ?? 0) + 12);
  });
```

### 13. Create `tests/speed.test.ts`

Write this file exactly:

```ts
import { describe, expect, it } from 'vitest';
import { BPM, SPEED_BPMS } from '../src/config';

describe('speeds', () => {
  it('offers 120, 180, and 240 BPM, starting from the base tempo', () => {
    expect(SPEED_BPMS).toEqual([120, 180, 240]);
    expect(SPEED_BPMS[0]).toBe(BPM);
  });
});
```

### 14. Update `tests/loudness.ts`

- Remove `BPM` and `FAST_BPM` from the `../src/config` import.
- Remove the line importing from `../src/music` and replace it with `import { intensity, layerLevels } from '../src/music';`.
- Change the themes import to `import { DEFAULT_THEME, THEMES, type Theme } from '../src/themes';`.
- Add `const LOUDNESS_BPMS = [120, 240];` after `const THEME_BOARDS`.
- In `renderBoard`, delete `const local = musicStep % STEPS_PER_BAR;`. Replace the pad `if`, the bass `if`, the arp `if`, and the drum `for` loop with `audio.playMusicStep(musicStep, time, duration, levels);`.
- In `runLoudness`, replace both `[BPM, FAST_BPM]` with `LOUDNESS_BPMS`.

## Acceptance

Run each from the repository root:

- `npx tsc --noEmit` exits 0.
- `git grep -c FAST_BPM -- src tests` prints nothing and exits 1.
- `git grep -c BACKING_DRUMS -- src tests` prints nothing and exits 1.
- `git grep -c playMusicStep -- src/main.ts` prints `src/main.ts:1`.
- `git grep -c setPeriodicWave -- src/audio.ts` prints `src/audio.ts:1`.
- `git grep -c SPEED_BPMS -- src/config.ts` prints `src/config.ts:1`.
- `git diff --name-only -- src/sim.ts src/waves.ts src/render.ts src/scheduler.ts tests/balance.test.ts tests/bots.ts tests/waves.test.ts` prints nothing.

Verifier only:

- `npm test` exits 0 and reports 9 test files and 57 tests passed.
- `npm run build` exits 0.

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- Do not touch files outside **Files to touch** except `.handoff/report.md`.
- Do not run the `Verifier only:` commands.
- If any command fails with `spawn EPERM`, stop and report it. Do not request wider sandbox access, set `NODE_OPTIONS`, or stub modules to get past it.
- Do not add dependencies.
- Match the surrounding code style.
- Do not add a tempo or BPM setting to themes.

## Out of scope

- Wave, tower, enemy, and difficulty values.
- Tower firing, chord bonuses, and game balance.
- Any UI change other than the speed button and its text.
- Changing `MIX` values.

## If blocked

Stop, write what failed and why to `.handoff/report.md`, and do not improvise a different approach.
