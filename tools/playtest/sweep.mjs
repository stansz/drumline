import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseCount, parseFlags } from './args.mjs';
import { runJob } from './pool.mjs';
import { summarize } from './report.ts';
import {
  buildCandidate,
  chooseValue,
  currentSetting,
  formatProposal,
  patchForSetting,
} from './propose.ts';
import { resolveDifficulty, resolveRules } from './rules.ts';

const USAGE =
  'usage: node tools/playtest/sweep.mjs --sweep <path> --out <dir> [--workers <n>]';
const DIFFICULTIES = ['hard', 'easy'];

function readRecords(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

async function main() {
  let flags;
  let sweep;
  let workers;
  try {
    flags = parseFlags(process.argv.slice(2), ['sweep', 'out', 'workers']);
    if (!flags.sweep || !flags.out) throw new Error('--sweep and --out are required');
    sweep = JSON.parse(readFileSync(flags.sweep, 'utf8'));
    workers = parseCount(flags, 'workers', availableParallelism());
    if (workers < 1) throw new Error('--workers must be at least 1');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exit(1);
  }

  const candidates = [];
  for (const value of [null, ...sweep.values]) {
    const label = value === null ? 'current' : String(value);
    const summaries = {};
    const resolved = {};
    for (const difficulty of DIFFICULTIES) {
      const patch = value === null ? {} : patchForSetting(sweep.setting, value);
      const job = {
        id: `${sweep.id}-${difficulty}-${label}`,
        difficulty,
        seed: sweep.seed,
        games: sweep.games,
        ...patch,
      };
      const out = join(flags.out, `${job.id}.jsonl`);
      await runJob({ job, out, workers, start: 0, end: job.games });
      summaries[difficulty] = summarize(readRecords(out));
      resolved[difficulty] = {
        difficulty: resolveDifficulty(difficulty, job.difficultyPatch),
        rules: resolveRules(job.rules),
      };
    }
    candidates.push(buildCandidate(value, summaries, resolved));
  }

  const currentValue = currentSetting(sweep.setting, resolveRules(), resolveDifficulty('hard'));
  const proposal = {
    sweep: sweep.id,
    setting: sweep.setting,
    currentValue,
    proposed: chooseValue(candidates),
    games: sweep.games,
    seed: sweep.seed,
    candidates,
  };

  writeFileSync(join(flags.out, 'proposal.json'), JSON.stringify(proposal, null, 2) + '\n');
  writeFileSync(join(flags.out, 'proposal.md'), formatProposal(proposal));
  console.log(
    `proposal: ${sweep.setting} = ${proposal.proposed ?? 'none'} (${join(flags.out, 'proposal.md')})`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
