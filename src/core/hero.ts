import type { Maze } from './maze';
import { advance, canMove, type Mover } from './movement';
import { opposite, type Dir } from './types';

export interface Hero extends Mover {
  /** Direction requested by the player, applied as soon as it is possible. */
  queued: Dir;
  /** Last direction the hero moved/faced, used for rendering. */
  facing: Dir;
  /** Distance travelled, drives the mouth animation. */
  travelled: number;
}

export function createHero(maze: Maze): Hero {
  return {
    x: maze.heroStart.x,
    y: maze.heroStart.y,
    dir: 'none',
    queued: 'left',
    facing: 'left',
    travelled: 0,
  };
}

export function steerHero(hero: Hero, requested: Dir): void {
  if (requested === 'none') return;
  hero.queued = requested;
  // Reversing is allowed at any time, even between tiles.
  if (hero.dir !== 'none' && requested === opposite(hero.dir)) {
    hero.dir = requested;
    hero.facing = requested;
  }
}

export function moveHero(maze: Maze, hero: Hero, distance: number): void {
  const before = { x: hero.x, y: hero.y };
  advance(maze, hero, distance, (tile) => {
    if (canMove(maze, tile, hero.queued)) return hero.queued;
    if (canMove(maze, tile, hero.dir)) return hero.dir;
    return 'none';
  });
  if (hero.dir !== 'none') hero.facing = hero.dir;
  const moved = Math.abs(hero.x - before.x) + Math.abs(hero.y - before.y);
  if (moved > 0 && moved < 2) hero.travelled += moved;
}
