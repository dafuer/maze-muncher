/** Speed of a mover at 100% in tiles per second. */
export const BASE_SPEED = 9.5;

export type BonusKind =
  | 'apple'
  | 'donut'
  | 'cupcake'
  | 'gem'
  | 'star'
  | 'crown'
  | 'rocket'
  | 'trophy';

export const BONUS_POINTS: Record<BonusKind, number> = {
  apple: 100,
  donut: 300,
  cupcake: 500,
  gem: 700,
  star: 1000,
  crown: 2000,
  rocket: 3000,
  trophy: 5000,
};

export interface LevelConfig {
  level: number;
  heroSpeed: number;
  heroFrightSpeed: number;
  chaserSpeed: number;
  chaserFrightSpeed: number;
  chaserTunnelSpeed: number;
  /** Seconds the chasers stay frightened after a power pellet (0 = they only reverse). */
  frightSeconds: number;
  /** Pellets left when the lead chaser enrages and speeds up. */
  rageDots: number;
  bonus: BonusKind;
  /** Alternating scatter/chase durations in seconds, starting with scatter. */
  schedule: readonly number[];
}

const FRIGHT_SECONDS = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1];
const RAGE_DOTS = [20, 30, 40, 40, 40, 50, 50, 50, 60, 60, 60, 80, 80, 80, 100, 100, 100, 100, 120];

function bonusFor(level: number): BonusKind {
  if (level === 1) return 'apple';
  if (level === 2) return 'donut';
  if (level <= 4) return 'cupcake';
  if (level <= 6) return 'gem';
  if (level <= 8) return 'star';
  if (level <= 10) return 'crown';
  if (level <= 12) return 'rocket';
  return 'trophy';
}

function scheduleFor(level: number): number[] {
  if (level === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity];
  if (level <= 4) return [7, 20, 7, 20, 5, 1033, 1 / 60, Infinity];
  return [5, 20, 5, 20, 5, 1037, 1 / 60, Infinity];
}

export function levelConfig(level: number): LevelConfig {
  const lvl = Math.max(1, Math.floor(level));
  let speeds: [number, number, number, number, number];
  if (lvl === 1) speeds = [0.8, 0.9, 0.75, 0.5, 0.4];
  else if (lvl <= 4) speeds = [0.9, 0.95, 0.85, 0.55, 0.45];
  else if (lvl <= 20) speeds = [1, 1, 0.95, 0.6, 0.5];
  else speeds = [0.9, 0.9, 0.95, 0.6, 0.5];
  const [hero, heroFright, chaser, chaserFright, tunnel] = speeds;
  return {
    level: lvl,
    heroSpeed: hero * BASE_SPEED,
    heroFrightSpeed: heroFright * BASE_SPEED,
    chaserSpeed: chaser * BASE_SPEED,
    chaserFrightSpeed: chaserFright * BASE_SPEED,
    chaserTunnelSpeed: tunnel * BASE_SPEED,
    frightSeconds: FRIGHT_SECONDS[lvl - 1] ?? 0,
    rageDots: RAGE_DOTS[lvl - 1] ?? 120,
    bonus: bonusFor(lvl),
    schedule: scheduleFor(lvl),
  };
}

/** Returns the global mode for the elapsed (non-frightened) time of a level. */
export function modeAt(schedule: readonly number[], elapsed: number): 'scatter' | 'chase' {
  let t = 0;
  for (let i = 0; i < schedule.length; i++) {
    t += schedule[i];
    if (elapsed < t) return i % 2 === 0 ? 'scatter' : 'chase';
  }
  return 'chase';
}
