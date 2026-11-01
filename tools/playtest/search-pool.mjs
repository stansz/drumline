import { Worker } from 'node:worker_threads';

// Sends plan work to worker threads and keeps the results in the order they were given.
export function createPool({ difficulty, rules, workers }) {
  const threads = [];
  const assignments = new Map();
  const waiting = new Map();
  let nextId = 0;

  function fail(error) {
    const pending = [...waiting.values()];
    waiting.clear();
    for (const entry of pending) entry.reject(error);
  }

  for (let i = 0; i < workers; i += 1) {
    const worker = new Worker(new URL('./search-worker.mjs', import.meta.url), {
      workerData: { difficulty, rules },
    });
    assignments.set(worker, null);
    worker.on('message', (message) => {
      const assignment = assignments.get(worker);
      const entry = waiting.get(message.id);
      if (!assignment || !entry) return;
      assignments.set(worker, null);
      entry.results[assignment.index] = message.results;
      entry.remaining -= 1;
      if (entry.remaining === 0) {
        waiting.delete(message.id);
        entry.resolve(entry.results.flat());
      }
    });
    worker.on('error', fail);
    threads.push(worker);
  }

  function run(kind, items) {
    const total = items.length;
    if (total === 0) return Promise.resolve([]);

    const count = Math.min(workers, total);
    const chunks = [];
    let cursor = 0;
    for (let i = 0; i < count; i += 1) {
      const size = Math.floor(total / count) + (i < total % count ? 1 : 0);
      chunks.push(items.slice(cursor, cursor + size));
      cursor += size;
    }

    const id = nextId;
    nextId += 1;

    return new Promise((resolve, reject) => {
      waiting.set(id, {
        results: new Array(chunks.length),
        remaining: chunks.length,
        resolve,
        reject,
      });
      chunks.forEach((chunk, index) => {
        const worker = threads[index];
        if (!worker) return;
        assignments.set(worker, { id, index });
        worker.postMessage({ id, kind, items: chunk });
      });
    });
  }

  async function close() {
    await Promise.all(threads.map((worker) => worker.terminate()));
  }

  return { run, close };
}
