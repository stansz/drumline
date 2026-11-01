import { type Difficulty, type DifficultyId, type Rules } from '../../src/config';
import { makeRng, playGame, policyBot, randomPolicy } from './bots';
import {
  configHash,
  resolveDifficulty,
  resolveRules,
  type DifficultyPatch,
  type RulesPatch,
} from './rules';

export interface Job {
  id: string;
  difficulty: DifficultyId;
  seed: number;
  games: number;
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
}

interface Resolved {
  rules: Rules;
  difficulty: Difficulty;
}

const resolvedJobs = new Map<string, Resolved>();

function resolveJob(job: Job): Resolved {
  const cached = resolvedJobs.get(job.id);
  if (cached) return cached;
  const rules = resolveRules(job.rules);
  const difficulty = resolveDifficulty(job.difficulty, job.difficultyPatch);
  const resolved: Resolved = { rules, difficulty };
  resolvedJobs.set(job.id, resolved);
  return resolved;
}

export function gameSeed(job: Job, index: number): number {
  return (job.seed + Math.imul(index, 0x9e3779b1)) | 0;
}

export function runGame(job: Job, index: number): string {
  const { rules, difficulty } = resolveJob(job);
  const seed = gameSeed(job, index);
  const policy = randomPolicy(makeRng(seed));
  const result = playGame(
    policyBot(policy, rules),
    difficulty,
    rules,
    seed ^ 0x5bd1e995,
  );

  return JSON.stringify({
    job: job.id,
    index,
    config: configHash(rules, difficulty),
    seed,
    policy,
    ...result,
  });
}
