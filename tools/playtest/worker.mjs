import { parentPort, workerData } from 'node:worker_threads';
import { runGame } from './job.ts';

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
