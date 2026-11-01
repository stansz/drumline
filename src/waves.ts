import {
  ENEMIES,
  type Difficulty,
  type EnemyStats,
  type WaveCurve,
  type WaveGroup,
} from './config';
import type { EnemyType } from './sim';

const MIN_GAP_STEPS = 2;
const START_GAP_STEPS = 8;
const WAVES_PER_GAP_STEP = 5;

type Roster = Array<[EnemyType, number]>;

export function waveBudget(wave: number, curve: WaveCurve): number {
  const budget =
    curve.baseHealth * (1 + curve.ramp * (wave - 1)) * curve.growth ** (wave - 1);
  return wave % curve.bossEvery === 0 ? budget * curve.bossBudget : budget;
}

function waveSize(wave: number, curve: WaveCurve): number {
  const size = curve.baseEnemies + curve.enemiesPerWave * (wave - 1);
  return Math.min(curve.maxEnemies, Math.round(size));
}

function waveRoster(wave: number, curve: WaveCurve): Roster {
  const size = waveSize(wave, curve);
  if (wave % curve.bossEvery === 0) {
    return [
      ['boss', 1],
      ['runner', Math.ceil(size / 2)],
    ];
  }
  if (wave % 3 === 1) return [['blip', size]];
  if (wave % 3 === 2) {
    const blips = Math.round(size * 0.6);
    return [
      ['blip', blips],
      ['runner', size - blips],
    ];
  }
  const brutes = Math.max(1, Math.round(size * 0.3));
  return [
    ['brute', brutes],
    ['runner', size - brutes],
  ];
}

export function buildWave(
  wave: number,
  difficulty: Difficulty,
  enemies: Record<EnemyType, EnemyStats> = ENEMIES,
): WaveGroup[] {
  const curve = difficulty.curve;
  const roster = waveRoster(wave, curve);
  const weight = roster.reduce((sum, [type, count]) => sum + enemies[type].hp * count, 0);
  const scale = (waveBudget(wave, curve) * difficulty.healthScale) / weight;
  const gapSteps = Math.max(
    MIN_GAP_STEPS,
    START_GAP_STEPS - Math.floor(wave / WAVES_PER_GAP_STEP),
  );
  const bossCap = Math.round(curve.bossHealthCap * difficulty.healthScale);
  return roster.map(([type, count]) => {
    const hp = Math.max(1, Math.round(enemies[type].hp * scale));
    return {
      type,
      count,
      gapSteps: type === 'boss' ? 0 : gapSteps,
      hp: type === 'boss' ? Math.min(hp, bossCap) : hp,
    };
  });
}

export function buildWaves(
  difficulty: Difficulty,
  enemies: Record<EnemyType, EnemyStats> = ENEMIES,
): WaveGroup[][] {
  const waves: WaveGroup[][] = [];
  for (let wave = 1; wave <= difficulty.curve.waves; wave += 1) {
    waves.push(buildWave(wave, difficulty, enemies));
  }
  return waves;
}
