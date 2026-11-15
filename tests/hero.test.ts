import { describe, expect, it } from 'vitest';
import { createHero, moveHero, steerHero } from '../src/core/hero';
import { MAZES } from '../src/core/mazes';
import { isOpen } from '../src/core/maze';

const maze = MAZES[0];

describe('hero movement', () => {
  it('starts on the hero start tile and moves in the queued direction', () => {
    const hero = createHero(maze);
    expect({ x: hero.x, y: hero.y }).toEqual(maze.heroStart);
    steerHero(hero, 'left');
    moveHero(maze, hero, 1);
    expect(hero.x).toBe(maze.heroStart.x - 1);
    expect(hero.y).toBe(maze.heroStart.y);
    expect(hero.dir).toBe('left');
  });

  it('stops in front of a wall instead of entering it', () => {
    const hero = createHero(maze);
    steerHero(hero, 'up'); // wall above the start tile
    expect(isOpen(maze, hero.x, hero.y - 1)).toBe(false);
    moveHero(maze, hero, 3);
    expect({ x: hero.x, y: hero.y }).toEqual(maze.heroStart);
    expect(hero.dir).toBe('none');
  });

  it('buffers a turn and takes it at the next possible junction', () => {
    const hero = createHero(maze);
    steerHero(hero, 'left');
    moveHero(maze, hero, 0.5);
    steerHero(hero, 'up'); // not possible right now, buffered
    // From (13,22) moving left, the first opening upwards is at column 12.
    moveHero(maze, hero, 1.5);
    expect(hero.x).toBe(12);
    expect(hero.y).toBeCloseTo(21);
    expect(hero.dir).toBe('up');
  });

  it('reverses immediately between tiles', () => {
    const hero = createHero(maze);
    steerHero(hero, 'left');
    moveHero(maze, hero, 0.4);
    steerHero(hero, 'right');
    expect(hero.dir).toBe('right');
    moveHero(maze, hero, 0.4);
    expect(hero.x).toBeCloseTo(maze.heroStart.x);
  });

  it('wraps through the side tunnel', () => {
    const hero = createHero(maze);
    const row = maze.tunnelRows[0];
    hero.x = 1;
    hero.y = row;
    hero.dir = 'left';
    hero.queued = 'left';
    moveHero(maze, hero, 2.2);
    expect(hero.y).toBe(row);
    expect(hero.x).toBeCloseTo(maze.width - 1.2);
  });
});
