import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, ENEMIES, WAVE_CURVE } from '../src/config';
import { Sim } from '../src/sim';
import { buildWave, buildWaves, waveBudget } from '../src/waves';

function totalHealth(wave: number, id: 'easy' | 'hard'): number {
  return buildWave(wave, DIFFICULTIES[id]).reduce(
    (sum, group) => sum + group.hp * group.count,
    0,
  );
}

describe('waves', () => {
  it('builds the full run on both difficulties', () => {
    expect(buildWaves(DIFFICULTIES.easy)).toHaveLength(WAVE_CURVE.waves);
    expect(buildWaves(DIFFICULTIES.hard)).toHaveLength(WAVE_CURVE.waves);
  });

  it('opens hard mode with eight standard blips', () => {
    expect(buildWave(1, DIFFICULTIES.hard)).toEqual([
      { type: 'blip', count: 8, gapSteps: 8, hp: ENEMIES.blip.hp },
    ]);
  });

  it('grows the health budget every wave', () => {
    for (let wave = 2; wave <= WAVE_CURVE.waves; wave += 1) {
      expect(waveBudget(wave, WAVE_CURVE)).toBeGreaterThan(waveBudget(wave - 1, WAVE_CURVE));
    }
  });

  it('sends a boss every tenth wave and at no other time', () => {
    const waves = buildWaves(DIFFICULTIES.hard);
    waves.forEach((groups, index) => {
      const hasBoss = groups.some((group) => group.type === 'boss');
      expect(hasBoss).toBe((index + 1) % WAVE_CURVE.bossEvery === 0);
    });
  });

  it('never exceeds the enemy cap', () => {
    for (const groups of buildWaves(DIFFICULTIES.hard)) {
      const size = groups.reduce((sum, group) => sum + group.count, 0);
      expect(size).toBeLessThanOrEqual(WAVE_CURVE.maxEnemies);
    }
  });

  it('gives easy mode less enemy health on every wave', () => {
    for (let wave = 1; wave <= WAVE_CURVE.waves; wave += 1) {
      expect(totalHealth(wave, 'easy')).toBeLessThan(totalHealth(wave, 'hard'));
    }
  });
});

describe('boss health cap', () => {
  const uncappedHard = {
    ...DIFFICULTIES.hard,
    curve: { ...WAVE_CURVE, bossHealthCap: 1000000 },
  };

  function bossHp(wave: number, difficulty: typeof DIFFICULTIES.hard): number | undefined {
    return buildWave(wave, difficulty).find((group) => group.type === 'boss')?.hp;
  }

  it('caps the final boss on hard', () => {
    expect(bossHp(30, DIFFICULTIES.hard)).toBe(13000);
    expect(bossHp(30, uncappedHard)).toBe(29997);
  });

  it('scales the cap by healthScale on easy', () => {
    expect(bossHp(30, DIFFICULTIES.easy)).toBe(6500);
  });

  it('leaves the final wave runners alone', () => {
    const capped = buildWave(30, DIFFICULTIES.hard).filter((group) => group.type === 'runner');
    const uncapped = buildWave(30, uncappedHard).filter((group) => group.type === 'runner');
    expect(capped).toEqual(uncapped);
  });

  it('leaves earlier bosses below the cap unchanged', () => {
    expect(bossHp(10, DIFFICULTIES.hard)).toBe(bossHp(10, uncappedHard));
    expect(bossHp(20, DIFFICULTIES.hard)).toBe(bossHp(20, uncappedHard));
  });
});

describe('difficulty', () => {
  it('sets starting money and lives', () => {
    const easy = new Sim(DIFFICULTIES.easy);
    const hard = new Sim(DIFFICULTIES.hard);
    expect(easy.money).toBe(DIFFICULTIES.easy.startMoney);
    expect(easy.lives).toBe(DIFFICULTIES.easy.startLives);
    expect(hard.money).toBe(DIFFICULTIES.hard.startMoney);
    expect(hard.lives).toBe(DIFFICULTIES.hard.startLives);
  });

  it('spawns enemies with the health of their wave', () => {
    const sim = new Sim(DIFFICULTIES.easy);
    expect(sim.startWave()).toBe(true);
    sim.step();
    const expected = buildWave(1, DIFFICULTIES.easy)[0]?.hp;
    expect(sim.enemies[0]?.maxHp).toBe(expected);
    expect(sim.enemies[0]?.hp).toBe(expected);
  });

  it('pays the difficulty wave bonus on clearing a wave', () => {
    const sim = new Sim(DIFFICULTIES.easy);
    sim.towers.push({ type: 'kick', col: 5, row: 0 });
    expect(sim.startWave()).toBe(true);
    let cleared = false;
    let before = sim.money;
    for (let i = 0; i < 2000 && !cleared; i += 1) {
      before = sim.money;
      const events = sim.step();
      cleared = events.some((event) => event.kind === 'waveClear');
      if (cleared) {
        const kills = events.filter((event) => event.kind === 'kill').length;
        expect(sim.money).toBe(
          before + DIFFICULTIES.easy.waveBonus + kills * ENEMIES.blip.bounty,
        );
      }
    }
    expect(cleared || sim.phase === 'lost').toBe(true);
  });
});
