import { describe, expect, it } from 'vitest';
import { EXTRA_LIFE_SCORE, Game, PHASE_DURATION, START_LIVES } from '../src/core/game';
import { pelletKey } from '../src/core/maze';
import { MAZES } from '../src/core/mazes';
import { createRng, type Dir } from '../src/core/types';

const DT = 1 / 60;

function newGame(players: 1 | 2 = 1, startLevel = 1): Game {
  return new Game(players, { rng: createRng(3), startLevel });
}

function run(game: Game, seconds: number, input: Dir = 'none'): void {
  for (let t = 0; t < seconds; t += DT) game.update(DT, input);
}

function untilPlaying(game: Game): void {
  for (let i = 0; i < 2000 && game.phase !== 'playing'; i++) game.update(DT, 'none');
  expect(game.phase).toBe('playing');
}

/** Places a chaser on top of the hero so the next tick resolves a collision. */
function collide(game: Game, frightened: boolean, index = 0): void {
  const c = game.chasers[index];
  c.state = 'active';
  c.frightened = frightened;
  c.x = game.hero.x;
  c.y = game.hero.y;
  c.dir = 'left';
  game.update(DT, 'none');
}

function eatAllPelletsBut(game: Game, keep: number): void {
  const all = [...game.maze.pellets, ...game.maze.powerPellets];
  for (const key of all) if (key !== keep) game.player.eaten.add(key);
}

function die(game: Game): void {
  untilPlaying(game);
  collide(game, false);
  expect(game.phase).toBe('dying');
  run(game, PHASE_DURATION.dying + 0.1);
}

describe('game flow', () => {
  it('opens with an intro, then the round starts', () => {
    const game = newGame();
    expect(game.phase).toBe('ready');
    expect(game.drainEvents()).toContain('intro');
    run(game, PHASE_DURATION.intro - 0.2);
    expect(game.phase).toBe('ready');
    run(game, 0.3);
    expect(game.phase).toBe('playing');
  });

  it('eats pellets for 10 points each', () => {
    const game = newGame();
    untilPlaying(game);
    game.drainEvents();
    run(game, 0.1, 'left');
    expect(game.player.score).toBe(10);
    expect(game.hasPellet(12, 22)).toBe(false);
    expect(game.drainEvents()).toContain('chomp');
  });

  it('power pellets frighten chasers; eating them scores 200 then 400', () => {
    const game = newGame();
    untilPlaying(game);
    const power = [...game.maze.powerPellets][0];
    game.hero.x = power % game.maze.width;
    game.hero.y = Math.floor(power / game.maze.width);
    game.update(DT, 'none');
    expect(game.player.score).toBe(50);
    expect(game.frightTimer).toBeGreaterThan(5);
    expect(game.chasers.every((c) => c.frightened)).toBe(true);

    collide(game, true, 0);
    expect(game.player.score).toBe(250);
    expect(game.chasers[0].state).toBe('eaten');
    expect(game.phase).toBe('eatPause');
    run(game, PHASE_DURATION.eatPause + 0.05);
    collide(game, true, 1);
    expect(game.player.score).toBe(650);
  });

  it('losing a life keeps the eaten pellets and restarts the round', () => {
    const game = newGame();
    untilPlaying(game);
    run(game, 0.1, 'left');
    const eaten = game.player.eaten.size;
    die(game);
    expect(game.player.lives).toBe(START_LIVES - 1);
    expect(game.phase).toBe('ready');
    expect(game.player.eaten.size).toBe(eaten);
    expect({ x: game.hero.x, y: game.hero.y }).toEqual(game.maze.heroStart);
  });

  it('ends the game when the last life is lost', () => {
    const game = newGame();
    for (let i = 0; i < START_LIVES; i++) die(game);
    expect(game.phase).toBe('gameOver');
    expect(game.drainEvents()).toContain('gameOver');
  });

  it('clears the level, advances and changes maze on later levels', () => {
    const game = newGame(1, 2);
    untilPlaying(game);
    const keep = pelletKey(game.maze, 12, 22);
    eatAllPelletsBut(game, keep);
    run(game, 0.1, 'left');
    expect(game.phase).toBe('levelClear');
    run(game, PHASE_DURATION.levelClear + 0.1);
    expect(game.player.level).toBe(3);
    expect(game.player.eaten.size).toBe(0);
    expect(game.maze).toBe(MAZES[1]);
  });

  it('shows a bonus item after 70 pellets', () => {
    const game = newGame();
    untilPlaying(game);
    const keys = [...game.maze.pellets].filter((k) => k !== pelletKey(game.maze, 12, 22));
    for (const k of keys.slice(0, 69)) game.player.eaten.add(k);
    game.player.levelDots = 69;
    run(game, 0.1, 'left');
    expect(game.bonus?.kind).toBe('apple');
    expect(game.bonus?.pos).toEqual(game.bonusPosition());
    expect(game.maze.tiles[game.bonus!.pos.y][game.bonus!.pos.x]).toBe('path');
  });

  it('awards one extra life at 10000 points', () => {
    const game = newGame();
    untilPlaying(game);
    game.player.score = EXTRA_LIFE_SCORE - 10;
    run(game, 0.1, 'left');
    expect(game.player.lives).toBe(START_LIVES + 1);
    expect(game.drainEvents()).toContain('extraLife');
    expect(game.highScore).toBe(EXTRA_LIFE_SCORE);
  });

  it('releases chasers from the house as pellets are eaten', () => {
    const game = newGame();
    expect(game.chasers.find((c) => c.kind === 'zap')!.state).toBe('leaving');
    expect(game.chasers.find((c) => c.kind === 'flux')!.state).toBe('house');
    untilPlaying(game);
    game.hero.queued = 'none'; // stand still so no pellet resets the idle timer
    run(game, 4.5); // idle timer releases the next one
    expect(game.chasers.find((c) => c.kind === 'flux')!.state).not.toBe('house');
  });
});

describe('two players', () => {
  it('alternates turns after a death, each with their own state', () => {
    const game = newGame(2);
    untilPlaying(game);
    run(game, 0.1, 'left');
    expect(game.player.id).toBe(1);
    const p1Score = game.player.score;
    die(game);
    expect(game.player.id).toBe(2);
    expect(game.player.score).toBe(0);
    expect(game.player.eaten.size).toBe(0);
    expect(game.players[0].score).toBe(p1Score);
    die(game);
    expect(game.player.id).toBe(1);
    expect(game.player.eaten.size).toBeGreaterThan(0);
  });

  it('keeps playing with the remaining player after the other is out', () => {
    const game = newGame(2);
    game.players[0].lives = 1;
    die(game);
    expect(game.phase).toBe('turnOver');
    run(game, PHASE_DURATION.turnOver + 0.1);
    expect(game.player.id).toBe(2);
    expect(game.phase).toBe('ready');
    for (let i = 0; i < START_LIVES; i++) die(game);
    expect(game.phase).toBe('gameOver');
  });
});
