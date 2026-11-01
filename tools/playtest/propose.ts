import type {
  Difficulty,
  DifficultyId,
  EnemyStats,
  Rules,
  TowerStats,
  WaveCurve,
} from '../../src/config';
import type { EnemyType, TowerType } from '../../src/sim';
import { formatComparison, type Summary } from './report';
import type { DifficultyPatch, RulesPatch } from './rules';
import { checkTarget, metricsFor, TARGETS, type TargetCheck } from './targets';

export interface Sweep {
  id: string;
  setting: string;
  values: number[];
  games: number;
  seed: number;
}

export interface SettingPatch {
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
}

export interface Candidate {
  value: number | null;
  pass: boolean;
  worstMargin: number;
  checks: TargetCheck[];
  summaries: Record<DifficultyId, Summary>;
}

export interface Proposal {
  sweep: string;
  setting: string;
  currentValue: number;
  proposed: number | null;
  games: number;
  seed: number;
  candidates: Candidate[];
}

const DIRECT_SETTINGS = ['chordBonusPerTower', 'chordMaxTowers', 'sellRefund'] as const;
type DirectSetting = (typeof DIRECT_SETTINGS)[number];

export function patchForSetting(setting: string, value: number): SettingPatch {
  const parts = setting.split('.');
  const head = parts[0];
  const second = parts[1];
  const third = parts[2];

  if (parts.length === 2 && head === 'curve' && second) {
    const curve = { [second]: value } as unknown as Partial<WaveCurve>;
    return { difficultyPatch: { curve } };
  }
  if (parts.length === 3 && head === 'towers' && second && third) {
    const towers = { [second]: { [third]: value } } as unknown as RulesPatch['towers'];
    return { rules: { towers } };
  }
  if (parts.length === 3 && head === 'enemies' && second && third) {
    const enemies = { [second]: { [third]: value } } as unknown as RulesPatch['enemies'];
    return { rules: { enemies } };
  }
  if (parts.length === 1 && DIRECT_SETTINGS.includes(setting as DirectSetting)) {
    return { rules: { [setting]: value } as RulesPatch };
  }
  throw new Error(`unknown setting: ${setting}`);
}

export function currentSetting(setting: string, rules: Rules, difficulty: Difficulty): number {
  const parts = setting.split('.');
  const head = parts[0];
  const second = parts[1];
  const third = parts[2];

  if (parts.length === 2 && head === 'curve' && second) {
    return difficulty.curve[second as keyof WaveCurve];
  }
  if (parts.length === 3 && head === 'towers' && second && third) {
    return rules.towers[second as TowerType][third as keyof TowerStats];
  }
  if (parts.length === 3 && head === 'enemies' && second && third) {
    return rules.enemies[second as EnemyType][third as keyof EnemyStats];
  }
  if (parts.length === 1 && DIRECT_SETTINGS.includes(setting as DirectSetting)) {
    return rules[setting as DirectSetting];
  }
  throw new Error(`unknown setting: ${setting}`);
}

export function buildCandidate(
  value: number | null,
  summaries: Record<DifficultyId, Summary>,
  resolved: Record<DifficultyId, { difficulty: Difficulty; rules: Rules }>,
): Candidate {
  const checks = TARGETS.map((target) => {
    const entry = resolved[target.difficulty];
    const metrics = metricsFor(summaries[target.difficulty], entry.difficulty, entry.rules);
    return checkTarget(target, metrics[target.metric]);
  });
  const worstMargin =
    checks.length === 0 ? 0 : Math.min(...checks.map((check) => check.margin));
  return {
    value,
    pass: checks.every((check) => check.pass),
    worstMargin,
    checks,
    summaries,
  };
}

export function chooseValue(candidates: Candidate[]): number | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    const value = candidate.value;
    if (value === null || !candidate.pass) continue;
    if (
      best === null ||
      candidate.worstMargin > best.worstMargin ||
      (candidate.worstMargin === best.worstMargin && value < (best.value ?? Infinity))
    ) {
      best = candidate;
    }
  }
  return best === null ? null : best.value;
}

function formatCandidateValue(value: number | null): string {
  return value === null ? 'Current' : String(value);
}

export function formatProposal(proposal: Proposal): string {
  const lines: string[] = [];
  lines.push(`# Proposal: ${proposal.sweep}`);
  lines.push('');
  if (proposal.proposed === null) {
    lines.push('No tested value meets every target.');
  } else {
    lines.push(
      `Set \`${proposal.setting}\` to ${proposal.proposed} (now ${proposal.currentValue}).`,
    );
  }
  lines.push('');
  lines.push(
    "Nothing has been changed. This needs a person's approval before it goes into `src/config.ts`.",
  );
  lines.push('');
  lines.push('## Candidates');

  const current = proposal.candidates.find((candidate) => candidate.value === null);
  const ordered = current
    ? [current, ...proposal.candidates.filter((candidate) => candidate !== current)]
    : proposal.candidates;
  const targetIds = proposal.candidates[0]?.checks.map((check) => check.id) ?? [];

  lines.push(
    ['| Value', 'Passes', 'Worst margin', ...targetIds].join(' | ') + ' |',
  );
  lines.push(
    ['| ---', '---', '---', ...targetIds.map(() => '---')].join(' | ') + ' |',
  );
  for (const candidate of ordered) {
    const cells = [
      formatCandidateValue(candidate.value),
      candidate.pass ? 'yes' : 'no',
      candidate.worstMargin.toFixed(3),
      ...candidate.checks.map((check) => check.value.toFixed(3)),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }

  if (proposal.proposed !== null) {
    const after = proposal.candidates.find((candidate) => candidate.value === proposal.proposed);
    lines.push('');
    lines.push('## Before and after');
    if (current && after) {
      for (const id of ['hard', 'easy'] as DifficultyId[]) {
        const beforeSummary = current.summaries[id];
        const afterSummary = after.summaries[id];
        if (!beforeSummary || !afterSummary) continue;
        lines.push('');
        lines.push(`### ${id}`);
        lines.push(formatComparison(beforeSummary, afterSummary));
      }
    }
    lines.push('');
    lines.push('## To apply');
    lines.push(
      `Set \`${proposal.setting}\` to ${proposal.proposed} in \`src/config.ts\`, run \`npm test\`, then update the results in \`docs/balance.md\`.`,
    );
  }

  return lines.join('\n') + '\n';
}
