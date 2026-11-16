import { describe, expect, it } from 'vitest';
import { levelConfig } from '../src/core/levels';

const speeds = (level: number) => {
  const c = levelConfig(level);
  return [c.heroSpeed, c.heroFrightSpeed, c.chaserSpeed, c.chaserFrightSpeed, c.chaserTunnelSpeed];
};

describe('level speed tiers', () => {
  it('keeps the same speeds within each block of three levels', () => {
    expect(speeds(2)).toEqual(speeds(1));
    expect(speeds(3)).toEqual(speeds(1));
    expect(speeds(5)).toEqual(speeds(4));
    expect(speeds(6)).toEqual(speeds(4));
    expect(speeds(8)).toEqual(speeds(7));
    expect(speeds(9)).toEqual(speeds(7));
  });

  it('gets faster from one block to the next', () => {
    expect(levelConfig(4).heroSpeed).toBeGreaterThan(levelConfig(3).heroSpeed);
    expect(levelConfig(4).chaserSpeed).toBeGreaterThan(levelConfig(3).chaserSpeed);
    expect(levelConfig(7).heroSpeed).toBeGreaterThan(levelConfig(6).heroSpeed);
    expect(levelConfig(7).chaserSpeed).toBeGreaterThan(levelConfig(6).chaserSpeed);
  });
});
