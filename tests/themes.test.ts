import { describe, expect, it } from 'vitest';
import { ARP_STEPS, BASS_STEPS, MIX, MUSIC_CHORDS, STEPS_PER_BAR } from '../src/config';
import {
  BACKING_DRUMS,
  DEFAULT_THEME,
  DRUM_PARTS,
  THEMES,
  nextTheme,
  themeById,
} from '../src/themes';

describe('themes', () => {
  it('keeps the default theme identical to the original music', () => {
    expect(DEFAULT_THEME.chords).toEqual(MUSIC_CHORDS);
    expect(DEFAULT_THEME.bassSteps).toEqual(BASS_STEPS);
    expect(DEFAULT_THEME.arpSteps).toEqual(ARP_STEPS);
    expect(DEFAULT_THEME.levels).toEqual({ pad: 1, bass: 1, arp: 1 });
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
        ...theme.bassSteps,
        ...theme.arpSteps,
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
    expect(BACKING_DRUMS.kick).toBeLessThan(MIX.kick / 2);
    expect(BACKING_DRUMS.hat).toBeLessThan(MIX.hat / 2);
    expect(BACKING_DRUMS.snare).toBeLessThan(MIX.synth);
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
