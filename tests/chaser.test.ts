import { describe, expect, it } from 'vitest';
import {
  chaseTarget,
  chooseDirection,
  createChasers,
  currentTarget,
  releaseChaser,
  scatterCorner,
  updateChaser,
  type ChaseContext,
  type Chaser,
} from '../src/core/chaser';
import { levelConfig, modeAt } from '../src/core/levels';
import { MAZES } from '../src/core/mazes';
import { createRng } from '../src/core/types';

const maze = MAZES[0];

function ctx(overrides: Partial<ChaseContext> = {}): ChaseContext {
  return {
    maze,
    mode: 'chase',
    heroTile: { x: 13, y: 22 },
    heroFacing: 'left',
    boltTile: { x: 13, y: 11 },
    enraged: false,
    rng: createRng(1),
    ...overrides,
  };
}

function byKind(chasers: Chaser[], kind: Chaser['kind']): Chaser {
  return chasers.find((c) => c.kind === kind)!;
}

describe('chaser targeting', () => {
  it('bolt hunts the hero tile directly', () => {
    expect(chaseTarget('bolt', ctx())).toEqual({ x: 13, y: 22 });
  });

  it('zap ambushes four tiles ahead of the hero', () => {
    expect(chaseTarget('zap', ctx({ heroFacing: 'up' }))).toEqual({ x: 13, y: 18 });
  });

  it('flux doubles the vector from bolt to two tiles ahead of the hero', () => {
    // pivot = (11,22); target = 2*pivot - bolt(13,11) = (9,33)
    expect(chaseTarget('flux', ctx())).toEqual({ x: 9, y: 33 });
  });

  it('glitch hunts when far and retreats to its corner when close', () => {
    const glitch = byKind(createChasers(maze), 'glitch');
    glitch.state = 'active';
    glitch.x = 1;
    glitch.y = 1;
    expect(currentTarget(glitch, ctx())).toEqual({ x: 13, y: 22 });
    glitch.x = 12;
    glitch.y = 22;
    expect(currentTarget(glitch, ctx())).toEqual(scatterCorner(maze, 'glitch'));
  });

  it('heads to its scatter corner during scatter unless it is an enraged bolt', () => {
    const [bolt] = createChasers(maze);
    expect(currentTarget(bolt, ctx({ mode: 'scatter' }))).toEqual(scatterCorner(maze, 'bolt'));
    expect(currentTarget(bolt, ctx({ mode: 'scatter', enraged: true }))).toEqual({ x: 13, y: 22 });
  });

  it('eaten chasers head back to the house exit', () => {
    const [bolt] = createChasers(maze);
    bolt.state = 'eaten';
    expect(currentTarget(bolt, ctx())).toEqual(maze.houseExit);
  });
});

describe('direction choice', () => {
  it('never reverses and picks the option closest to the target', () => {
    // At (6,5) moving right: options up? (6,4) open, right (7,5), down (6,6); left excluded.
    const dir = chooseDirection(maze, { x: 6, y: 5 }, 'right', { x: 6, y: 30 }, null);
    expect(dir).toBe('down');
    const dir2 = chooseDirection(maze, { x: 6, y: 5 }, 'right', { x: 6, y: 5 - 10 }, null);
    expect(dir2).toBe('up');
  });

  it('chooses randomly among legal options when frightened', () => {
    const picks = new Set<string>();
    const rng = createRng(42);
    for (let i = 0; i < 50; i++) picks.add(chooseDirection(maze, { x: 6, y: 5 }, 'right', { x: 0, y: 0 }, rng));
    expect([...picks].sort()).toEqual(['down', 'right', 'up']);
  });
});

describe('chaser state machine', () => {
  it('starts with bolt outside and the others inside the house', () => {
    const chasers = createChasers(maze);
    expect(chasers.map((c) => c.state)).toEqual(['active', 'house', 'house', 'house']);
  });

  it('leaves the house through the door and becomes active', () => {
    const flux = byKind(createChasers(maze), 'flux');
    releaseChaser(flux);
    for (let i = 0; i < 20; i++) updateChaser(flux, ctx(), 0.25);
    expect(flux.state).toBe('active');
    expect(flux.y).toBeLessThan(maze.door.y);
  });

  it('returns home as eyes, re-enters and comes back out revived', () => {
    const [bolt] = createChasers(maze);
    bolt.state = 'eaten';
    bolt.frightened = true;
    bolt.x = 1;
    bolt.y = 1;
    bolt.dir = 'right';
    const seen = new Set<string>();
    for (let i = 0; i < 400 && !(seen.has('leaving') && (bolt.state as string) === 'active'); i++) {
      updateChaser(bolt, ctx(), 0.3);
      seen.add(bolt.state);
    }
    expect(seen.has('entering')).toBe(true);
    expect(seen.has('leaving')).toBe(true);
    expect(bolt.state).toBe('active');
    expect(bolt.frightened).toBe(false);
  });

  it('roams the maze without ever entering walls', () => {
    const chasers = createChasers(maze);
    chasers.forEach(releaseChaser);
    const rng = createRng(7);
    for (let i = 0; i < 2000; i++) {
      for (const c of chasers) {
        c.frightened = i % 500 < 200;
        updateChaser(c, ctx({ rng, mode: i % 300 < 100 ? 'scatter' : 'chase' }), 0.37);
        if (c.state === 'active') {
          const tx = Math.round(c.x);
          const ty = Math.round(c.y);
          const inBounds = tx >= 0 && tx < maze.width;
          if (inBounds) expect(maze.tiles[ty][tx]).toBe('path');
        }
      }
    }
  });
});

describe('level config', () => {
  it('speeds up and shortens fright time on later levels', () => {
    const l1 = levelConfig(1);
    const l5 = levelConfig(5);
    expect(l5.heroSpeed).toBeGreaterThan(l1.heroSpeed);
    expect(l5.chaserSpeed).toBeGreaterThan(l1.chaserSpeed);
    expect(l5.frightSeconds).toBeLessThan(l1.frightSeconds);
    expect(levelConfig(30).frightSeconds).toBe(0);
  });

  it('alternates scatter and chase by schedule', () => {
    const s = levelConfig(1).schedule;
    expect(modeAt(s, 0)).toBe('scatter');
    expect(modeAt(s, 8)).toBe('chase');
    expect(modeAt(s, 28)).toBe('scatter');
    expect(modeAt(s, 10_000)).toBe('chase');
  });
});
