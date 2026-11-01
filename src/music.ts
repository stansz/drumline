import { MUSIC_CHORDS, STEPS_PER_BAR, TOWER_VOICE_LIMITS } from './config';
import type { TowerType } from './sim';

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function chordForStep(
  musicStep: number,
  chords: ReadonlyArray<(typeof MUSIC_CHORDS)[number]> = MUSIC_CHORDS,
): (typeof MUSIC_CHORDS)[number] {
  const bar = Math.floor(musicStep / STEPS_PER_BAR);
  return chords[bar % chords.length] ?? MUSIC_CHORDS[0]!;
}

export function intensity(towerCount: number, wave: number): number {
  return Math.min(
    1,
    (Math.min(towerCount, 12) / 12) * 0.6 + (Math.min(wave, 5) / 5) * 0.4,
  );
}

export function layerLevels(i: number): { pad: number; bass: number; arp: number } {
  return {
    pad: 0.6 + 0.4 * i,
    bass: i < 0.1 ? 0 : 0.4 + 0.6 * i,
    arp: i < 0.5 ? 0 : (i - 0.5) * 2,
  };
}

export function arpNote(
  musicStep: number,
  chords: ReadonlyArray<(typeof MUSIC_CHORDS)[number]> = MUSIC_CHORDS,
  rate = 2,
): number {
  const pad = chordForStep(musicStep, chords).pad;
  const index = Math.floor(musicStep / rate) % pad.length;
  return (pad[index] ?? pad[0] ?? 0) + 12;
}

// Chooses which notes to sound on a step. Notes that hit come first, and the rest of each
// instrument's limit is spread across its notes, so a big chord keeps its range of pitches.
export function pickVoices<T extends { towerType: TowerType; hit: boolean }>(
  notes: readonly T[],
): T[] {
  const voices: T[] = [];
  for (const type of ['kick', 'hat', 'synth'] as const) {
    const group = notes.filter((note) => note.towerType === type);
    const hits = group.filter((note) => note.hit);
    const limit = TOWER_VOICE_LIMITS[type];
    const pool =
      hits.length >= limit ? hits : [...hits, ...group.filter((note) => !note.hit)];
    const count = Math.min(limit, pool.length);
    for (let i = 0; i < count; i += 1) {
      const note = pool[Math.floor((i * pool.length) / count)];
      if (note) voices.push(note);
    }
  }
  return voices;
}
