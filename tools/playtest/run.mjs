import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { runGame } from './job.ts';

const USAGE =
  'usage: node tools/playtest/run.mjs --job <path> --out <path> [--workers <n>] [--start <i>] [--end <j>]';

function parseArgs(argv) {
  const options = { job: null, out: null, workers: availableParallelism(), start: 0, end: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--job':
        options.job = value;
        i += 1;
        break;
      case '--out':
        options.out = value;
        i += 1;
        break;
      case '--workers':
        options.workers = Number.parseInt(value, 10);
        i += 1;
        break;
      case '--start':
        options.start = Number.parseInt(value, 10);
        i += 1;
        break;
      case '--end':
        options.end = Number.parseInt(value, 10);
        i += 1;
        break;
      default:
        break;
    }
  }
  return options;
}

function workerMain() {
  const { job, start, end } = workerData;
  let lines = [];
  for (let index = start; index < end; index += 1) {
    lines.push(runGame(job, index));
    if ((index - start + 1) % 100 === 0) {
      parentPort.postMessage(lines.join('\n') + '\n');
      lines = [];
    }
  }
  if (lines.length > 0) parentPort.postMessage(lines.join('\n') + '\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.job || !options.out) {
    console.error(USAGE);
    process.exit(1);
  }
  if (
    !Number.isInteger(options.workers) ||
    !Number.isInteger(options.start) ||
    (options.end !== null && !Number.isInteger(options.end))
  ) {
    console.error(USAGE);
    process.exit(1);
  }

  const job = JSON.parse(readFileSync(options.job, 'utf8'));
  const start = options.start;
  const end = options.end ?? job.games;
  const total = Math.max(0, end - start);

  const ranges = [];
  const count = Math.min(options.workers, total);
  let cursor = start;
  for (let i = 0; i < count; i += 1) {
    const size = Math.floor(total / count) + (i < total % count ? 1 : 0);
    ranges.push({ start: cursor, end: cursor + size });
    cursor += size;
  }

  mkdirSync(dirname(options.out), { recursive: true });
  const fd = openSync(options.out, 'w');

  const startedAt = process.hrtime.bigint();
  let remaining = ranges.length;

  function finish() {
    closeSync(fd);
    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const gamesPerSecond = seconds > 0 ? Math.round(total / seconds) : total;
    console.log(
      `games=${total} workers=${ranges.length} seconds=${seconds.toFixed(1)} gamesPerSecond=${gamesPerSecond}`,
    );
  }

  if (ranges.length === 0) {
    finish();
    return;
  }

  for (const range of ranges) {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { job, start: range.start, end: range.end },
    });
    worker.on('message', (message) => {
      writeSync(fd, message);
    });
    worker.on('error', (error) => {
      console.error(error);
      process.exit(1);
    });
    worker.on('exit', () => {
      remaining -= 1;
      if (remaining === 0) finish();
    });
  }
}

if (isMainThread) {
  main();
} else {
  workerMain();
}
