import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseCount, parseFlags } from './args.mjs';
import { runJob } from './pool.mjs';
import { formatWaveTable, summarize } from './report.ts';
import { EXPERT_NOISE, formatTierTable } from './tiers.ts';

const USAGE =
  'usage: node tools/playtest/tiers-cli.mjs --plan <path> --games <n> --seed <n> --out <dir> [--workers <n>]';
const TIERS = ['casual', 'competent', 'strong', 'expert'];

function readRecords(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

async function main() {
  let flags;
  let bestPlan;
  let games;
  let seed;
  let workers;
  try {
    flags = parseFlags(process.argv.slice(2), ['plan', 'games', 'seed', 'out', 'workers']);
    if (!flags.plan || !flags.games || !flags.seed || !flags.out) {
      throw new Error('--plan, --games, --seed, and --out are required');
    }
    bestPlan = JSON.parse(readFileSync(flags.plan, 'utf8'));
    games = parseCount(flags, 'games');
    seed = parseCount(flags, 'seed');
    workers = parseCount(flags, 'workers', availableParallelism());
    if (workers < 1) throw new Error('--workers must be at least 1');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exit(1);
  }

  const difficulty = bestPlan.difficulty;
  const plan = bestPlan.plan;
  const rows = [];

  for (const tier of TIERS) {
    const job = {
      id: `tiers-${difficulty}-${tier}`,
      difficulty,
      seed,
      games,
      bot: tier === 'expert' ? { kind: 'plan', plan, noise: EXPERT_NOISE } : { kind: 'tier', tier },
    };
    const out = join(flags.out, `${job.id}.jsonl`);
    await runJob({ job, out, workers, start: 0, end: games });
    rows.push({ tier, summary: summarize(readRecords(out)) });
  }

  const lines = [`# Tiers: ${difficulty}`, '', formatTierTable(rows)];
  for (const row of rows) {
    lines.push('');
    lines.push(`## ${row.tier}`);
    lines.push('');
    lines.push(formatWaveTable(row.summary));
  }
  const reportPath = join(flags.out, 'tiers.md');
  writeFileSync(reportPath, lines.join('\n') + '\n');
  console.log(`tiers: ${difficulty} ${reportPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
