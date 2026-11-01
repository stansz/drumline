import type { DifficultyId } from '../../src/config';
import type { TowerType } from '../../src/sim';
import type { GameRecord } from './job';

export interface WaveStats {
  wave: number;
  reached: number;
  deaths: number;
  meanLivesLost: number;
}

export interface Summary {
  config: string;
  difficulty: DifficultyId;
  games: number;
  wins: number;
  winRate: number;
  cleanWinRate: number;
  waveP10: number;
  waveP50: number;
  waveP90: number;
  deathsByWave: Record<string, number>;
  damageShare: Record<TowerType, number>;
  meanChordAverage: number;
  meanIdleNoteShare: number;
  finalBossWave: number;
  bestFinalBossDamage: number;
  damagePerDollar: Record<TowerType, number>;
  byWave: WaveStats[];
}

const TOWER_TYPES: TowerType[] = ['kick', 'hat', 'synth'];

function percentile(sorted: number[], q: number): number {
  const index = Math.floor(q * (sorted.length - 1));
  return sorted[index] ?? 0;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function summarize(records: GameRecord[]): Summary {
  const first = records[0];
  if (!first) throw new Error('no records to summarize');
  const configs = new Set(records.map((record) => record.config));
  if (configs.size > 1) throw new Error('records mix more than one config');

  // Sorting by index keeps every float sum in a stable order, so a sharded run still matches a
  // single run.
  const ordered = [...records].sort((a, b) => a.index - b.index);
  const games = ordered.length;
  const wins = ordered.filter((record) => record.result === 'won').length;
  const finalBossWave = first.finalBossWave;
  const cleanWins = ordered.filter(
    (record) => record.result === 'won' && record.bossKills.includes(finalBossWave),
  ).length;

  const waves = ordered.map((record) => record.wave).sort((a, b) => a - b);

  const deathsByWave: Record<string, number> = {};
  for (const record of ordered) {
    if (record.result !== 'lost') continue;
    const key = String(record.wave);
    deathsByWave[key] = (deathsByWave[key] ?? 0) + 1;
  }

  const damageTotal: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  for (const record of ordered) {
    for (const type of TOWER_TYPES) {
      damageTotal[type] += record.damageByType[type];
    }
  }
  const allDamage = TOWER_TYPES.reduce((sum, type) => sum + damageTotal[type], 0);
  const damageShare = {} as Record<TowerType, number>;
  for (const type of TOWER_TYPES) {
    damageShare[type] = allDamage === 0 ? 0 : damageTotal[type] / allDamage;
  }

  let chordTotal = 0;
  let idleTotal = 0;
  let bestFinalBossDamage = 0;
  for (const record of ordered) {
    chordTotal += record.chordAverage;
    idleTotal += record.idleNoteShare;
    const damaged = record.bossDamageByWave[String(finalBossWave)] ?? 0;
    if (damaged > bestFinalBossDamage) bestFinalBossDamage = damaged;
  }

  const spentTotal: Record<TowerType, number> = { kick: 0, hat: 0, synth: 0 };
  for (const record of ordered) {
    for (const type of TOWER_TYPES) {
      spentTotal[type] += record.spentByType[type];
    }
  }
  const damagePerDollar = {} as Record<TowerType, number>;
  for (const type of TOWER_TYPES) {
    damagePerDollar[type] = spentTotal[type] === 0 ? 0 : damageTotal[type] / spentTotal[type];
  }

  const highestWave = ordered.reduce((highest, record) => Math.max(highest, record.wave), 0);
  const byWave: WaveStats[] = [];
  for (let wave = 1; wave <= highestWave; wave += 1) {
    const reachedRecords = ordered.filter((record) => record.wave >= wave);
    let livesLostTotal = 0;
    for (const record of reachedRecords) {
      if (wave === 1) {
        livesLostTotal += record.startLives - (record.livesByWave[0] ?? record.startLives);
      } else {
        livesLostTotal +=
          (record.livesByWave[wave - 2] ?? 0) - (record.livesByWave[wave - 1] ?? 0);
      }
    }
    byWave.push({
      wave,
      reached: reachedRecords.length,
      deaths: deathsByWave[String(wave)] ?? 0,
      meanLivesLost: reachedRecords.length === 0 ? 0 : livesLostTotal / reachedRecords.length,
    });
  }

  return {
    config: first.config,
    difficulty: first.difficulty,
    games,
    wins,
    winRate: wins / games,
    cleanWinRate: wins === 0 ? 0 : cleanWins / wins,
    waveP10: percentile(waves, 0.1),
    waveP50: percentile(waves, 0.5),
    waveP90: percentile(waves, 0.9),
    deathsByWave,
    damageShare,
    meanChordAverage: chordTotal / games,
    meanIdleNoteShare: idleTotal / games,
    finalBossWave,
    bestFinalBossDamage,
    damagePerDollar,
    byWave,
  };
}

function summaryRows(summary: Summary): Array<[string, string]> {
  return [
    ['Games', String(summary.games)],
    ['Win rate', percent(summary.winRate)],
    ['Clean win rate', percent(summary.cleanWinRate)],
    ['Wave p10', String(summary.waveP10)],
    ['Wave p50', String(summary.waveP50)],
    ['Wave p90', String(summary.waveP90)],
    ['Best final boss damage', String(Math.round(summary.bestFinalBossDamage))],
    ['Kick damage share', percent(summary.damageShare.kick)],
    ['Hat damage share', percent(summary.damageShare.hat)],
    ['Synth damage share', percent(summary.damageShare.synth)],
    ['Kick damage per dollar', summary.damagePerDollar.kick.toFixed(2)],
    ['Hat damage per dollar', summary.damagePerDollar.hat.toFixed(2)],
    ['Synth damage per dollar', summary.damagePerDollar.synth.toFixed(2)],
  ];
}

export function formatSummary(summary: Summary): string {
  const lines = ['| Measure | Value |', '| --- | --- |'];
  for (const [measure, value] of summaryRows(summary)) {
    lines.push(`| ${measure} | ${value} |`);
  }
  return lines.join('\n');
}

export function formatWaveTable(summary: Summary): string {
  const lines = ['| Wave | Reached | Deaths | Mean lives lost |', '| --- | --- | --- | --- |'];
  for (const stats of summary.byWave) {
    lines.push(
      `| ${stats.wave} | ${stats.reached} | ${stats.deaths} | ${stats.meanLivesLost.toFixed(2)} |`,
    );
  }
  return lines.join('\n');
}

export function formatComparison(before: Summary, after: Summary): string {
  const beforeRows = summaryRows(before);
  const afterRows = summaryRows(after);
  const lines = ['| Measure | Before | After |', '| --- | --- | --- |'];
  for (let index = 0; index < beforeRows.length; index += 1) {
    const beforeRow = beforeRows[index];
    const afterRow = afterRows[index];
    if (!beforeRow || !afterRow) continue;
    lines.push(`| ${beforeRow[0]} | ${beforeRow[1]} | ${afterRow[1]} |`);
  }
  return lines.join('\n');
}
