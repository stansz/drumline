import { readFileSync } from 'node:fs';
import { parseFlags } from './args.mjs';
import { formatComparison, formatSummary, formatWaveTable, summarize } from './report.ts';

const USAGE = 'usage: node tools/playtest/report-cli.mjs --in <path> [--compare <path>]';

function readRecords(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

try {
  const flags = parseFlags(process.argv.slice(2), ['in', 'compare']);
  if (!flags.in) throw new Error('--in is required');
  const after = summarize(readRecords(flags.in));
  if (flags.compare === undefined) {
    console.log(formatSummary(after));
    console.log();
    console.log(formatWaveTable(after));
  } else {
    const before = summarize(readRecords(flags.compare));
    console.log(formatComparison(before, after));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
