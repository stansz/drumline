import { MAX_TOWER_LEVEL, type Difficulty, type DifficultyId, type Rules } from '../../src/config';
import type { TowerType } from '../../src/sim';
import {
  makeRng,
  playGame,
  randomPolicy,
  type GameResult,
  type Policy,
  type Rng,
} from './bots';
import { buildableCells, placeSteps, planBot, type BuildPlan, type PlanStep } from './plans';
import { configHash, type DifficultyPatch, type RulesPatch } from './rules';

export interface SearchConfig {
  id: string;
  difficulty: DifficultyId;
  seed: number;
  initial: number;
  generations: number;
  batch: number;
  bannedTowers?: TowerType[];
  rules?: RulesPatch;
  difficultyPatch?: DifficultyPatch;
}

export interface Behaviour {
  kickBin: number;
  synthBin: number;
  focusBin: number;
}

export interface Evaluation {
  score: number;
  won: boolean;
  wave: number;
  lives: number;
  towers: number;
  mix: Record<TowerType, number>;
  damageByType: Record<TowerType, number>;
  upgrades: number;
  behaviour: Behaviour;
}

export interface Elite extends Evaluation {
  key: string;
  plan: BuildPlan;
}

export type Archive = Map<string, Elite>;

export interface WaveHeadroom {
  wave: number;
  multiplier: number | null;
}

export interface SearchOutput {
  id: string;
  difficulty: DifficultyId;
  config: string;
  games: number;
  elites: Elite[];
  headroom: WaveHeadroom[];
}

export const HEADROOM_MULTIPLIERS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5];

const TOWER_TYPES: TowerType[] = ['kick', 'hat', 'synth'];

const SYNTH_BIN_LABELS = ['0–19%', '20–39%', '40–59%', '60–79%', '80–100%'];
const FOCUS_HEADINGS = [
  '### Chord focus: spread',
  '### Chord focus: mixed',
  '### Chord focus: focused',
];

function allowedTypes(config: SearchConfig): TowerType[] {
  const banned = config.bannedTowers ?? [];
  return TOWER_TYPES.filter((type) => !banned.includes(type));
}

function freeCells(plan: BuildPlan): Array<[number, number]> {
  const used = new Set(placeSteps(plan).map((step) => `${step.col},${step.row}`));
  return buildableCells().filter(([col, row]) => !used.has(`${col},${row}`));
}

export function planScore(result: GameResult, difficulty: Difficulty): number {
  if (result.result === 'won') return result.wave + result.lives / difficulty.startLives;
  return result.wave - 1 + result.finalWaveProgress;
}

export function behaviourOf(plan: BuildPlan, result: GameResult): Behaviour {
  const spentTotal =
    result.spentByType.kick + result.spentByType.hat + result.spentByType.synth;
  const kickBin =
    spentTotal === 0 ? 0 : Math.min(4, Math.floor((result.spentByType.kick / spentTotal) * 5));
  const synthBin =
    spentTotal === 0 ? 0 : Math.min(4, Math.floor((result.spentByType.synth / spentTotal) * 5));

  const towers = placeSteps(plan).slice(0, result.towers);
  let focusBin = 0;
  if (towers.length > 0) {
    const counts = [0, 0, 0, 0];
    for (const tower of towers) {
      const bucket = tower.col % 4;
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    const focus = Math.max(...counts) / towers.length;
    focusBin = focus < 0.4 ? 0 : focus < 0.6 ? 1 : 2;
  }

  return { kickBin, synthBin, focusBin };
}

export function evaluatePlan(plan: BuildPlan, difficulty: Difficulty, rules: Rules): Evaluation {
  const result = playGame(planBot(plan), difficulty, rules, 0);
  return {
    score: planScore(result, difficulty),
    won: result.result === 'won',
    wave: result.wave,
    lives: result.lives,
    towers: result.towers,
    mix: result.mix,
    damageByType: result.damageByType,
    upgrades: result.upgrades,
    behaviour: behaviourOf(plan, result),
  };
}

export function insertElite(
  archive: Archive,
  plan: BuildPlan,
  evaluation: Evaluation,
): boolean {
  const behaviour = evaluation.behaviour;
  const key = `${behaviour.kickBin}-${behaviour.synthBin}-${behaviour.focusBin}`;
  const existing = archive.get(key);
  if (existing && evaluation.score <= existing.score) return false;
  archive.set(key, { ...evaluation, key, plan });
  return true;
}

export function initialPolicy(
  config: SearchConfig,
  index: number,
): { policy: Policy; seed: number } {
  const seed = (config.seed + Math.imul(index, 0x9e3779b1)) | 0;
  const policy = randomPolicy(makeRng(seed));
  for (const type of config.bannedTowers ?? []) policy.weights[type] = 0;
  if (policy.weights.kick === 0 && policy.weights.hat === 0 && policy.weights.synth === 0) {
    const first = allowedTypes(config)[0];
    if (first) policy.weights[first] = 1;
  }
  return { policy, seed };
}

type Operation =
  | 'changeType'
  | 'moveCell'
  | 'swapOrder'
  | 'insertStep'
  | 'deleteStep'
  | 'appendSteps'
  | 'insertUpgrade'
  | 'deleteUpgrade'
  | 'appendUpgrades';

const OPERATIONS: Operation[] = [
  'changeType',
  'moveCell',
  'swapOrder',
  'insertStep',
  'deleteStep',
  'appendSteps',
  'insertUpgrade',
  'deleteUpgrade',
  'appendUpgrades',
];

function randomIndex(rng: Rng, length: number): number {
  return Math.floor(rng() * length);
}

function upgradeCount(plan: BuildPlan, cell: { col: number; row: number }): number {
  let count = 0;
  for (const step of plan) {
    if (step.type !== 'upgrade') continue;
    if (step.col === cell.col && step.row === cell.row) count += 1;
  }
  return count;
}

function upgradableCells(plan: BuildPlan): Array<PlanStep & { type: TowerType }> {
  return placeSteps(plan).filter((step) => upgradeCount(plan, step) < MAX_TOWER_LEVEL - 1);
}

function indexOfStep(plan: BuildPlan, step: PlanStep): number {
  for (let index = 0; index < plan.length; index += 1) {
    if (plan[index] === step) return index;
  }
  return -1;
}

function applyOperation(
  plan: BuildPlan,
  rng: Rng,
  config: SearchConfig,
  operation: Operation,
): void {
  const types = allowedTypes(config);

  switch (operation) {
    case 'changeType': {
      if (types.length === 0) return;
      const places = placeSteps(plan);
      if (places.length === 0) return;
      const place = places[randomIndex(rng, places.length)];
      if (!place) return;
      const type = types[randomIndex(rng, types.length)];
      if (!type) return;
      const index = indexOfStep(plan, place);
      if (index < 0) return;
      plan[index] = { ...place, type };
      return;
    }
    case 'moveCell': {
      const places = placeSteps(plan);
      if (places.length === 0) return;
      const place = places[randomIndex(rng, places.length)];
      if (!place) return;
      const free = freeCells(plan);
      if (free.length === 0) return;
      const cell = free[randomIndex(rng, free.length)];
      if (!cell) return;
      const index = indexOfStep(plan, place);
      if (index < 0) return;
      const oldCol = place.col;
      const oldRow = place.row;
      plan[index] = { ...place, col: cell[0], row: cell[1] };
      for (const step of plan) {
        if (step.type !== 'upgrade') continue;
        if (step.col !== oldCol || step.row !== oldRow) continue;
        step.col = cell[0];
        step.row = cell[1];
      }
      return;
    }
    case 'swapOrder': {
      if (plan.length === 0) return;
      const index = randomIndex(rng, plan.length);
      const target = Math.min(plan.length - 1, index + 1 + randomIndex(rng, 5));
      const current = plan[index];
      const other = plan[target];
      if (current && other) {
        plan[index] = other;
        plan[target] = current;
      }
      return;
    }
    case 'insertStep': {
      if (types.length === 0) return;
      const free = freeCells(plan);
      if (free.length === 0) return;
      const type = types[randomIndex(rng, types.length)];
      const cell = free[randomIndex(rng, free.length)];
      if (!type || !cell) return;
      const index = randomIndex(rng, plan.length + 1);
      plan.splice(index, 0, { type, col: cell[0], row: cell[1] });
      return;
    }
    case 'deleteStep': {
      if (plan.length === 0) return;
      const deletedIndex = randomIndex(rng, plan.length);
      const step = plan[deletedIndex];
      if (!step) return;
      plan.splice(deletedIndex, 1);
      if (step.type === 'upgrade') return;
      for (let index = plan.length - 1; index >= 0; index -= 1) {
        const other = plan[index];
        if (!other) continue;
        if (other.type !== 'upgrade') continue;
        if (other.col !== step.col || other.row !== step.row) continue;
        plan.splice(index, 1);
      }
      return;
    }
    case 'appendSteps': {
      if (types.length === 0) return;
      const count = 1 + Math.floor(rng() * 4);
      for (let i = 0; i < count; i += 1) {
        const free = freeCells(plan);
        if (free.length === 0) return;
        const type = types[randomIndex(rng, types.length)];
        const cell = free[randomIndex(rng, free.length)];
        if (!type || !cell) return;
        plan.push({ type, col: cell[0], row: cell[1] });
      }
      return;
    }
    case 'insertUpgrade': {
      const candidates = upgradableCells(plan);
      if (candidates.length === 0) return;
      const place = candidates[randomIndex(rng, candidates.length)];
      if (!place) return;
      const placeIndex = indexOfStep(plan, place);
      if (placeIndex < 0) return;
      const index = placeIndex + 1 + randomIndex(rng, plan.length - placeIndex);
      plan.splice(index, 0, { type: 'upgrade', col: place.col, row: place.row });
      return;
    }
    case 'deleteUpgrade': {
      const indices: number[] = [];
      plan.forEach((step, index) => {
        if (step.type === 'upgrade') indices.push(index);
      });
      if (indices.length === 0) return;
      const at = indices[randomIndex(rng, indices.length)];
      if (at === undefined) return;
      plan.splice(at, 1);
      return;
    }
    case 'appendUpgrades': {
      const count = 1 + Math.floor(rng() * 4);
      for (let i = 0; i < count; i += 1) {
        const candidates = upgradableCells(plan);
        if (candidates.length === 0) return;
        const place = candidates[randomIndex(rng, candidates.length)];
        if (!place) return;
        plan.push({ type: 'upgrade', col: place.col, row: place.row });
      }
      return;
    }
  }
}

export function mutatePlan(plan: BuildPlan, rng: Rng, config: SearchConfig): BuildPlan {
  const copy: BuildPlan = plan.map((step) => ({ ...step }));
  const operations = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < operations; i += 1) {
    const operation = OPERATIONS[randomIndex(rng, OPERATIONS.length)];
    if (operation) applyOperation(copy, rng, config, operation);
  }
  return copy;
}

export function sortedElites(archive: Archive): Elite[] {
  return [...archive.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function childPlans(archive: Archive, rng: Rng, config: SearchConfig): BuildPlan[] {
  const elites = sortedElites(archive);
  const plans: BuildPlan[] = [];
  for (let i = 0; i < config.batch; i += 1) {
    const elite = elites.length === 0 ? undefined : elites[randomIndex(rng, elites.length)];
    plans.push(mutatePlan(elite ? elite.plan : [], rng, config));
  }
  return plans;
}

export function bestElite(elites: Elite[]): Elite {
  const first = elites[0];
  if (!first) throw new Error('no elites to choose from');
  let best = first;
  for (const elite of elites) {
    if (
      elite.score > best.score ||
      (elite.score === best.score && elite.key < best.key)
    ) {
      best = elite;
    }
  }
  return best;
}

export function headroomByWave(
  plan: BuildPlan,
  difficulty: Difficulty,
  rules: Rules,
): WaveHeadroom[] {
  const results = HEADROOM_MULTIPLIERS.map((multiplier) => ({
    multiplier,
    cleared: (() => {
      const result = playGame(
        planBot(plan),
        { ...difficulty, healthScale: difficulty.healthScale * multiplier },
        rules,
        0,
      );
      return result.result === 'won' ? difficulty.curve.waves : result.wave - 1;
    })(),
  }));

  const headroom: WaveHeadroom[] = [];
  for (let wave = 1; wave <= difficulty.curve.waves; wave += 1) {
    let multiplier: number | null = null;
    for (const result of results) {
      if (result.cleared >= wave) multiplier = result.multiplier;
    }
    headroom.push({ wave, multiplier });
  }
  return headroom;
}

function damageShareByType(damageByType: Record<TowerType, number>): Record<TowerType, number> {
  const total = TOWER_TYPES.reduce((sum, type) => sum + damageByType[type], 0);
  const share = {} as Record<TowerType, number>;
  for (const type of TOWER_TYPES) {
    share[type] = total === 0 ? 0 : damageByType[type] / total;
  }
  return share;
}

export function formatSearchReport(output: SearchOutput): string {
  const elites = output.elites;
  const lines: string[] = [];

  const best = elites.length === 0 ? null : bestElite(elites);
  const winning = elites.filter((elite) => elite.won).length;
  lines.push(`# Search: ${output.id}`);
  lines.push('');
  lines.push(
    `Difficulty: ${output.difficulty} · config: ${output.config} · games: ${output.games} · cells filled: ${elites.length} · winning cells: ${winning}`,
  );

  lines.push('');
  lines.push('## Best build');
  lines.push('');
  if (best) {
    lines.push('| Measure | Value |');
    lines.push('| --- | --- |');
    lines.push(`| Score | ${best.score.toFixed(2)} |`);
    lines.push(`| Wave | ${best.wave} |`);
    lines.push(`| Lives | ${best.lives} |`);
    lines.push(`| Towers | ${best.towers} |`);
    lines.push(`| Kick | ${best.mix.kick} |`);
    lines.push(`| Hat | ${best.mix.hat} |`);
    lines.push(`| Synth | ${best.mix.synth} |`);
    lines.push(`| Upgrades | ${best.upgrades} |`);
    lines.push('');
    const share = damageShareByType(best.damageByType);
    lines.push(
      `Damage share: kick ${(share.kick * 100).toFixed(1)}%, hat ${(share.hat * 100).toFixed(1)}%, synth ${(share.synth * 100).toFixed(1)}%.`,
    );
  } else {
    lines.push('No cells filled.');
  }

  lines.push('');
  lines.push('## Styles');
  for (let focusBin = 0; focusBin < FOCUS_HEADINGS.length; focusBin += 1) {
    lines.push('');
    lines.push(FOCUS_HEADINGS[focusBin] ?? '');
    lines.push('');
    lines.push(['| Kick spend', ...SYNTH_BIN_LABELS].join(' | ') + ' |');
    lines.push(['| ---', ...SYNTH_BIN_LABELS.map(() => '---')].join(' | ') + ' |');
    for (let kickBin = 0; kickBin < SYNTH_BIN_LABELS.length; kickBin += 1) {
      const cells = [SYNTH_BIN_LABELS[kickBin] ?? ''];
      for (let synthBin = 0; synthBin < SYNTH_BIN_LABELS.length; synthBin += 1) {
        const elite = elites.find(
          (entry) =>
            entry.behaviour.kickBin === kickBin &&
            entry.behaviour.synthBin === synthBin &&
            entry.behaviour.focusBin === focusBin,
        );
        cells.push(elite ? `${elite.won ? 'W ' : ''}${elite.score.toFixed(1)}` : '-');
      }
      lines.push(`| ${cells.join(' | ')} |`);
    }
  }

  lines.push('');
  lines.push('## Top cells');
  lines.push('');
  lines.push('| Key | Score | Wave | Lives | K/H/S |');
  lines.push('| --- | --- | --- | --- | --- |');
  const top = [...elites].sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1)).slice(0, 5);
  for (const elite of top) {
    lines.push(
      `| ${elite.key} | ${elite.score.toFixed(2)} | ${elite.wave} | ${elite.lives} | ${elite.mix.kick}/${elite.mix.hat}/${elite.mix.synth} |`,
    );
  }

  lines.push('');
  lines.push('## Headroom');
  lines.push('');
  lines.push('| Wave | Highest health multiplier cleared |');
  lines.push('| --- | --- |');
  for (const entry of output.headroom) {
    lines.push(`| ${entry.wave} | ${entry.multiplier === null ? '-' : String(entry.multiplier)} |`);
  }

  return lines.join('\n') + '\n';
}
