import { isOpen, neighbor, wrapX, type Maze } from './maze';
import { DIR_VECTORS, type Dir, type Vec } from './types';

const EPS = 1e-6;

export interface Mover {
  x: number;
  y: number;
  dir: Dir;
}

/** Tile coordinates currently occupied by a mover (tile centers are integers). */
export function tileOf(pos: Vec): Vec {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

export function isAtCenter(pos: Vec): boolean {
  return Math.abs(pos.x - Math.round(pos.x)) < EPS && Math.abs(pos.y - Math.round(pos.y)) < EPS;
}

function distanceToNextCenter(pos: Vec, dir: Dir): number {
  const v = DIR_VECTORS[dir];
  const p = v.x !== 0 ? pos.x : pos.y;
  const s = v.x !== 0 ? v.x : v.y;
  const next = s > 0 ? Math.floor(p + EPS) + 1 : Math.ceil(p - EPS) - 1;
  return Math.abs(next - p);
}

/**
 * Moves along the grid by `distance` tiles. Every time the mover reaches a tile
 * center, `chooseAtCenter` decides the next direction ('none' stops the mover).
 */
export function advance(
  maze: Maze,
  mover: Mover,
  distance: number,
  chooseAtCenter: (tile: Vec) => Dir,
): void {
  let remaining = distance;
  let guard = 0;
  while (remaining > EPS && guard++ < 64) {
    if (isAtCenter(mover)) {
      mover.x = Math.round(mover.x);
      mover.y = Math.round(mover.y);
      mover.dir = chooseAtCenter({ x: mover.x, y: mover.y });
      if (mover.dir === 'none') return;
    }
    if (mover.dir === 'none') return;
    const step = Math.min(remaining, distanceToNextCenter(mover, mover.dir));
    const v = DIR_VECTORS[mover.dir];
    mover.x = wrapX(maze, mover.x + v.x * step);
    mover.y += v.y * step;
    remaining -= step;
    // Snap away floating point drift on arrival.
    if (Math.abs(mover.x - Math.round(mover.x)) < EPS) mover.x = Math.round(mover.x);
    if (Math.abs(mover.y - Math.round(mover.y)) < EPS) mover.y = Math.round(mover.y);
  }
}

export function canMove(maze: Maze, tile: Vec, dir: Dir): boolean {
  if (dir === 'none') return false;
  const n = neighbor(tile, dir);
  return isOpen(maze, wrapTileX(maze, n.x), n.y);
}

export function wrapTileX(maze: Maze, x: number): number {
  if (x < 0) return x + maze.width;
  if (x >= maze.width) return x - maze.width;
  return x;
}
