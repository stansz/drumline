import { MUSIC_CHORDS, STEPS_PER_BAR } from './config';

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
): number {
  const pad = chordForStep(musicStep, chords).pad;
  const index = Math.floor(musicStep / 2) % pad.length;
  return (pad[index] ?? pad[0] ?? 0) + 12;
}
