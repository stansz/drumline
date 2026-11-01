import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { parseCount, parseFlags } from './args.mjs';
import { runJob } from './pool.mjs';

const USAGE =
  'usage: node tools/playtest/run.mjs --job <path> --out <path> [--workers <n>] [--start <i>] [--end <j>]';

let flags;
let job;
let workers;
let start;
let end;
try {
  flags = parseFlags(process.argv.slice(2), ['job', 'out', 'workers', 'start', 'end']);
  if (!flags.job || !flags.out) throw new Error('--job and --out are required');
  job = JSON.parse(readFileSync(flags.job, 'utf8'));
  workers = parseCount(flags, 'workers', availableParallelism());
  if (workers < 1) throw new Error('--workers must be at least 1');
  start = parseCount(flags, 'start', 0);
  end = parseCount(flags, 'end', job.games);
  if (start > end) throw new Error('--start must be at most --end');
  if (end > job.games) throw new Error('--end must be at most the job game count');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exit(1);
}

let result;
try {
  result = await runJob({ job, out: flags.out, workers, start, end });
} catch (error) {
  console.error(error);
  process.exit(1);
}

const gamesPerSecond =
  result.seconds > 0 ? Math.round(result.games / result.seconds) : result.games;
console.log(
  `games=${result.games} workers=${result.workers} seconds=${result.seconds.toFixed(1)} gamesPerSecond=${gamesPerSecond}`,
);
