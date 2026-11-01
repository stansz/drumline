import { parentPort, workerData } from 'node:worker_threads';
import { recordPlan } from './plans.ts';
import { evaluatePlan } from './search.ts';

const { difficulty, rules } = workerData;

parentPort.on('message', ({ id, kind, items }) => {
  const results = items.map((item) => {
    if (kind === 'record') {
      return recordPlan(item.policy, difficulty, rules, item.seed ^ 0x5bd1e995);
    }
    if (kind === 'evaluate') {
      return evaluatePlan(item, difficulty, rules);
    }
    throw new Error(`unknown search work kind: ${kind}`);
  });
  parentPort.postMessage({ id, results });
});
