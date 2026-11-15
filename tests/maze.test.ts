import { describe, expect, it } from 'vitest';
import { isOpen, mirrorRows, parseMaze, tileAt, wrapX } from '../src/core/maze';
import { MAZES, MAZE_DEFINITIONS, mazeIndexForLevel } from '../src/core/mazes';
import { DIR_PRIORITY, DIR_VECTORS } from '../src/core/types';

describe('maze parsing', () => {
  it('mirrors the left half around the center column', () => {
    expect(mirrorRows(['#.o'])).toEqual(['#.o.#']);
  });

  it('rejects unknown tiles', () => {
    expect(() =>
      parseMaze({ name: 'bad', leftHalf: ['#X'], wallColor: '', wallFill: '', pelletColor: '' }),
    ).toThrow(/unknown tile/);
  });

  it('treats out-of-bounds cells as walls except on tunnel rows', () => {
    const maze = MAZES[0];
    const tunnel = maze.tunnelRows[0];
    expect(tileAt(maze, -1, tunnel)).toBe('path');
    expect(tileAt(maze, -1, 1)).toBe('wall');
    expect(tileAt(maze, 3, -1)).toBe('wall');
  });

  it('wraps horizontal positions through the tunnel', () => {
    const maze = MAZES[0];
    expect(wrapX(maze, -0.6)).toBeCloseTo(maze.width - 0.6);
    expect(wrapX(maze, maze.width - 0.4)).toBeCloseTo(-0.4);
    expect(wrapX(maze, 3)).toBe(3);
  });
});

describe.each(MAZES.map((m, i) => [m.name, i] as const))('maze %s', (_name, index) => {
  const maze = MAZES[index];

  it('shares the same dimensions as the first maze', () => {
    expect(maze.width).toBe(MAZES[0].width);
    expect(maze.height).toBe(MAZES[0].height);
    expect(MAZE_DEFINITIONS[index].leftHalf.every((r) => r.length === 14)).toBe(true);
  });

  it('has four power pellets, a tunnel and a centered house', () => {
    expect(maze.powerPellets.size).toBe(4);
    expect(maze.tunnelRows.length).toBeGreaterThan(0);
    expect(maze.door.x).toBe((maze.width - 1) / 2);
    expect(isOpen(maze, maze.houseExit.x, maze.houseExit.y)).toBe(true);
    expect(isOpen(maze, maze.heroStart.x, maze.heroStart.y)).toBe(true);
  });

  it('has no dead ends (every open tile has at least two open neighbours)', () => {
    const deadEnds: string[] = [];
    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        if (!isOpen(maze, x, y)) continue;
        const exits = DIR_PRIORITY.filter((d) =>
          isOpen(maze, x + DIR_VECTORS[d].x, y + DIR_VECTORS[d].y),
        ).length;
        if (exits < 2) deadEnds.push(`${x},${y}`);
      }
    }
    expect(deadEnds).toEqual([]);
  });

  it('connects every open tile and pellet to the hero start', () => {
    const seen = new Set<string>();
    const queue = [maze.heroStart];
    seen.add(`${maze.heroStart.x},${maze.heroStart.y}`);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const d of DIR_PRIORITY) {
        let nx = cur.x + DIR_VECTORS[d].x;
        const ny = cur.y + DIR_VECTORS[d].y;
        if (nx < 0) nx = maze.width - 1;
        if (nx >= maze.width) nx = 0;
        const key = `${nx},${ny}`;
        if (!seen.has(key) && isOpen(maze, nx, ny)) {
          seen.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    const unreachable: string[] = [];
    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        if (isOpen(maze, x, y) && !seen.has(`${x},${y}`)) unreachable.push(`${x},${y}`);
      }
    }
    expect(unreachable).toEqual([]);
  });
});

describe('maze rotation per level', () => {
  it('changes maze as levels are cleared', () => {
    expect([1, 2, 3, 5, 6, 9, 10, 13, 14, 17].map(mazeIndexForLevel)).toEqual([
      0, 0, 1, 1, 2, 2, 1, 1, 2, 2,
    ]);
  });
});
