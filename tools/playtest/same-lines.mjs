import { readFileSync } from 'node:fs';

const [first, ...rest] = process.argv.slice(2);
if (!first || rest.length === 0) {
  console.error('usage: node tools/playtest/same-lines.mjs <first> <rest...>');
  process.exit(1);
}

function lines(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0);
}

const expected = lines(first).sort();
const actual = rest.flatMap((path) => lines(path)).sort();

const same =
  expected.length === actual.length &&
  expected.every((line, index) => line === actual[index]);

if (same) {
  console.log(`same ${expected.length}`);
  process.exit(0);
}

console.log('different');
process.exit(1);
