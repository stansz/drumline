import type { Policy, Rng } from './bots';
import type { Summary } from './report';

export type Tier = 'casual' | 'competent' | 'strong' | 'expert';
export type PolicyTier = Exclude<Tier, 'expert'>;

export const EXPERT_NOISE = 0.05;

const TIER_SETTINGS: Record<
  PolicyTier,
  { maxTowersPerWave: number | null; topK: number; midWave: boolean }
> = {
  casual: { maxTowersPerWave: 1, topK: 6, midWave: false },
  competent: { maxTowersPerWave: 3, topK: 3, midWave: false },
  strong: { maxTowersPerWave: null, topK: 2, midWave: true },
};

export function tierPolicy(tier: PolicyTier, rng: Rng): Policy {
  const settings = TIER_SETTINGS[tier];
  const policy: Policy = {
    weights: { kick: 0.2 + rng(), hat: 0.2 + rng(), synth: 0.2 + rng() },
    classMask: 15,
    earlyBias: 0,
    ...settings,
    upgradeAt: null,
  };
  if (tier === 'strong') policy.upgradeAt = 36 + Math.floor(rng() * 25);
  return policy;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatTierTable(rows: Array<{ tier: Tier; summary: Summary }>): string {
  const lines = [
    '| Tier | Games | Win rate | Clean win rate | Wave p10 | Wave p50 | Wave p90 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const summary = row.summary;
    lines.push(
      `| ${row.tier} | ${summary.games} | ${percent(summary.winRate)} | ${percent(summary.cleanWinRate)} | ${summary.waveP10} | ${summary.waveP50} | ${summary.waveP90} |`,
    );
  }
  return lines.join('\n');
}
