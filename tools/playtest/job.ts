import { type Difficulty, type DifficultyId, type Rules } from '../../src/config';
import {
  makeRng,
  playGame,
  policyBot,
  randomPolicy,
  type Bot,
  type GameResult,
  type Policy,
} from './bots';
import { noisyPlan, planBot, type BuildPlan } from './plans';
import {
  configHash,
  resolveDifficulty,
  resolveRules,
  type DifficultyPatch,
  type RulesPatch,
} from './rules';
import { tierPolicy, type PolicyTier } from './tiers';

export interface Job {
  id: string;
  difficulty: DifficultyId;
  seed: number;
  games: number;
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
  bot?:
    | { kind: 'tier'; tier: PolicyTier }
    | { kind: 'plan'; plan: BuildPlan; noise: number };
}

interface Resolved {
  rules: Rules;
  difficulty: Difficulty;
}

export type GameRecord = {
  job: string;
  difficulty: DifficultyId;
  index: number;
  config: string;
  seed: number;
  policy: Policy | null;
} & GameResult;

const resolvedJobs = new WeakMap<Job, Resolved>();

function resolveJob(job: Job): Resolved {
  const cached = resolvedJobs.get(job);
  if (cached) return cached;
  const rules = resolveRules(job.rules);
  const difficulty = resolveDifficulty(job.difficulty, job.difficultyPatch);
  const resolved: Resolved = { rules, difficulty };
  resolvedJobs.set(job, resolved);
  return resolved;
}

export function gameSeed(job: Job, index: number): number {
  return (job.seed + Math.imul(index, 0x9e3779b1)) | 0;
}

export function runGame(job: Job, index: number): string {
  const { rules, difficulty } = resolveJob(job);
  const seed = gameSeed(job, index);

  let policy: Policy | null;
  let bot: Bot;
  if (!job.bot) {
    policy = randomPolicy(makeRng(seed));
    bot = policyBot(policy, rules);
  } else if (job.bot.kind === 'tier') {
    const rng = makeRng(seed);
    policy = tierPolicy(job.bot.tier, rng);
    bot = policyBot(policy, rules);
  } else {
    policy = null;
    bot = planBot(noisyPlan(job.bot.plan, makeRng(seed), job.bot.noise));
  }

  const result = playGame(bot, difficulty, rules, seed ^ 0x5bd1e995);

  return JSON.stringify({
    job: job.id,
    difficulty: job.difficulty,
    index,
    config: configHash(rules, difficulty),
    seed,
    policy,
    ...result,
  });
}
