import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseCount, parseFlags } from './args.mjs';
import { createPool } from './search-pool.mjs';
import {
  bestElite,
  childPlans,
  formatSearchReport,
  headroomByWave,
  initialPolicy,
  insertElite,
  sortedElites,
} from './search.ts';
import { makeRng } from './bots.ts';
import { configHash, resolveDifficulty, resolveRules } from './rules.ts';

const USAGE =
  'usage: node tools/playtest/search-cli.mjs --search <path> --out <dir> [--workers <n>]';

async function main() {
  let flags;
  let config;
  let workers;
  try {
    flags = parseFlags(process.argv.slice(2), ['search', 'out', 'workers']);
    if (!flags.search || !flags.out) throw new Error('--search and --out are required');
    config = JSON.parse(readFileSync(flags.search, 'utf8'));
    workers = parseCount(flags, 'workers', availableParallelism());
    if (workers < 1) throw new Error('--workers must be at least 1');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exit(1);
  }

  const rules = resolveRules(config.rules);
  const difficulty = resolveDifficulty(config.difficulty, config.difficultyPatch);
  const pool = createPool({ difficulty, rules, workers });
  const archive = new Map();
  const rng = makeRng(config.seed ^ 0x2545f491);
  let games = 0;

  const initialItems = Array.from({ length: config.initial }, (_, index) =>
    initialPolicy(config, index),
  );
  const initialPlans = await pool.run('record', initialItems);
  games += config.initial;
  const initialEvaluations = await pool.run('evaluate', initialPlans);
  games += initialPlans.length;
  for (let index = 0; index < initialPlans.length; index += 1) {
    insertElite(archive, initialPlans[index], initialEvaluations[index]);
  }

  for (let generation = 0; generation < config.generations; generation += 1) {
    const plans = childPlans(archive, rng, config);
    const evaluations = await pool.run('evaluate', plans);
    games += plans.length;
    for (let index = 0; index < plans.length; index += 1) {
      insertElite(archive, plans[index], evaluations[index]);
    }
  }

  await pool.close();

  const elites = sortedElites(archive);
  const best = bestElite(elites);
  const headroom = headroomByWave(best.plan, difficulty, rules);
  const output = {
    id: config.id,
    difficulty: config.difficulty,
    config: configHash(rules, difficulty),
    games,
    elites,
    headroom,
  };

  mkdirSync(flags.out, { recursive: true });
  writeFileSync(join(flags.out, 'archive.json'), JSON.stringify(output, null, 2) + '\n');
  writeFileSync(
    join(flags.out, 'best-plan.json'),
    JSON.stringify(
      { difficulty: config.difficulty, score: best.score, plan: best.plan },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(join(flags.out, 'report.md'), formatSearchReport(output));

  console.log(
    `search: ${output.id} games=${games} cells=${elites.length} best=${best.score.toFixed(2)} won=${best.won ? 'yes' : 'no'}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
