// Neon's average level in dB, by board and BPM. tests/loudness.ts compares every theme with these
// numbers. Refresh them from the page's `baseline` output if Neon or the shared audio chain changes.
export const NEON_BASELINE: Record<string, Record<number, number>> = {
  'spread 12': { 120: -19.3, 240: -17.8 },
  'kick line': { 120: -13.8, 240: -11.9 },
  'full board': { 120: -17.8, 240: -16 },
};
