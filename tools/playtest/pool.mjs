import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { Worker } from 'node:worker_threads';

// Runs one job across worker threads and writes each result line to `out`.
export function runJob({ job, out, workers, start, end }) {
  return new Promise((resolve, reject) => {
    const total = Math.max(0, end - start);

    const ranges = [];
    const count = Math.min(workers, total);
    let cursor = start;
    for (let i = 0; i < count; i += 1) {
      const size = Math.floor(total / count) + (i < total % count ? 1 : 0);
      ranges.push({ start: cursor, end: cursor + size });
      cursor += size;
    }

    mkdirSync(dirname(out), { recursive: true });
    const fd = openSync(out, 'w');

    const startedAt = process.hrtime.bigint();
    let remaining = ranges.length;
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      closeSync(fd);
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      resolve({ games: total, workers: ranges.length, seconds });
    }

    if (ranges.length === 0) {
      finish();
      return;
    }

    for (const range of ranges) {
      const worker = new Worker(new URL('./worker.mjs', import.meta.url), {
        workerData: { job, start: range.start, end: range.end },
      });
      worker.on('message', (message) => {
        writeSync(fd, message);
      });
      worker.on('error', (error) => {
        if (settled) return;
        settled = true;
        closeSync(fd);
        reject(error);
      });
      worker.on('exit', () => {
        remaining -= 1;
        if (remaining === 0) finish();
      });
    }
  });
}
