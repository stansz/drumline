/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import docs from '../docs/balance.md?raw';
import { DEFAULT_RULES, DIFFICULTIES, type DifficultyId } from '../src/config';
import { configHash } from '../tools/playtest/rules';

const NAMES: Record<DifficultyId, string> = { easy: 'Easy', hard: 'Hard' };

function documentedHash(id: DifficultyId): string | undefined {
  return docs.match(new RegExp(`^\\| ${NAMES[id]} \\| \`([0-9a-f]{8})\` \\|$`, 'm'))?.[1];
}

// A balance change fails here until the results in docs/balance.md are measured again.
describe('docs/balance.md', () => {
  for (const id of ['easy', 'hard'] as const) {
    it(`was measured on the current ${id} config`, () => {
      expect(documentedHash(id)).toBe(configHash(DEFAULT_RULES, DIFFICULTIES[id]));
    });
  }
});
