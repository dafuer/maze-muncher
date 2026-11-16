import { describe, expect, it } from 'vitest';
import { currentTarget } from '../src/core/chaser';
import { EXTRA_LIFE_SCORE, FINAL_LEVEL, Game, PHASE_DURATION, START_LIVES } from '../src/core/game';
import { pelletKey } from '../src/core/maze';
import { MAZES } from '../src/core/mazes';
import { createRng, type Dir } from '../src/core/types';

const DT = 1 / 60;

function newGame(players: 1 | 2 = 1, startLevel = 1): Game {
  return new Game(players, { rng: createRng(3), startLevel });
}

function run(game: Game, seconds: number, ...inputs: Dir[]): void {
  for (let t = 0; t < seconds; t += DT) game.update(DT, inputs);
}

function untilPlaying(game: Game): void {
  for (let i = 0; i < 2000 && game.phase !== 'playing'; i++) game.update(DT, []);
  expect(game.phase).toBe('playing');
}

/** Places a chaser on top of a hero so the next tick resolves a collision. */
function collide(game: Game, frightened: boolean, index = 0, heroIndex = 0): void {
  const c = game.chasers[index];
  const hero = game.heroes[heroIndex];
  c.state = 'active';
  c.frightened = frightened;
  c.x = hero.x;
  c.y = hero.y;
  c.dir = 'left';
  game.update(DT, []);
}

/** Parks every other hero far away so collisions only involve the chosen one. */
function isolate(game: Game, heroIndex: number): void {
  game.heroes.forEach((h, i) => {
    if (i === heroIndex) return;
    h.x = 1;
    h.y = 1;
    h.queued = 'none';
    h.dir = 'none';
  });
}

function eatAllPelletsBut(game: Game, keep: number): void {
  const all = [...game.maze.pellets, ...game.maze.powerPellets];
  for (const key of all) if (key !== keep) game.eaten.add(key);
}

function die(game: Game, heroIndex = 0): void {
  untilPlaying(game);
  isolate(game, heroIndex);
  collide(game, false, 0, heroIndex);
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

  it('has a single hero in one-player mode', () => {
    const game = newGame();
    expect(game.heroes).toHaveLength(1);
    expect({ x: game.heroes[0].x, y: game.heroes[0].y }).toEqual(game.maze.heroStart);
  });

  it('eats pellets for 10 points each', () => {
    const game = newGame();
    untilPlaying(game);
    game.drainEvents();
    run(game, 0.1, 'left');
    expect(game.players[0].score).toBe(10);
    expect(game.hasPellet(12, 22)).toBe(false);
    expect(game.drainEvents()).toContain('chomp');
  });

  it('power pellets frighten chasers; eating them scores 200 then 400', () => {
    const game = newGame();
    untilPlaying(game);
    const power = [...game.maze.powerPellets][0];
    game.heroes[0].x = power % game.maze.width;
    game.heroes[0].y = Math.floor(power / game.maze.width);
    game.update(DT, []);
    expect(game.players[0].score).toBe(50);
    expect(game.frightTimer).toBeGreaterThan(5);
    expect(game.chasers.every((c) => c.frightened)).toBe(true);

    collide(game, true, 0);
    expect(game.players[0].score).toBe(250);
    expect(game.chasers[0].state).toBe('eaten');
    expect(game.phase).toBe('eatPause');
    run(game, PHASE_DURATION.eatPause + 0.05);
    collide(game, true, 1);
    expect(game.players[0].score).toBe(650);
  });

  it('losing a life keeps the eaten pellets and restarts the round', () => {
    const game = newGame();
    untilPlaying(game);
    run(game, 0.1, 'left');
    const eaten = game.eaten.size;
    die(game);
    expect(game.players[0].lives).toBe(START_LIVES - 1);
    expect(game.phase).toBe('ready');
    expect(game.eaten.size).toBe(eaten);
    expect({ x: game.heroes[0].x, y: game.heroes[0].y }).toEqual(game.maze.heroStart);
  });

  it('ends the game when the last life is lost', () => {
    const game = newGame();
    for (let i = 0; i < START_LIVES; i++) die(game);
    expect(game.phase).toBe('gameOver');
    expect(game.drainEvents()).toContain('gameOver');
  });

  it('clears the level, advances and changes maze', () => {
    const game = newGame(1, 2);
    untilPlaying(game);
    const keep = pelletKey(game.maze, game.maze.heroStart.x - 1, game.maze.heroStart.y);
    eatAllPelletsBut(game, keep);
    run(game, 0.1, 'left');
    expect(game.phase).toBe('levelClear');
    run(game, PHASE_DURATION.levelClear + 0.1);
    expect(game.level).toBe(3);
    expect(game.eaten.size).toBe(0);
    expect(game.maze).toBe(MAZES[2]);
    expect(game.roundKind).toBe('newLevel');
  });

  it('shows the victory screen instead of a new level after clearing the final level', () => {
    expect(FINAL_LEVEL).toBe(9);
    const game = newGame(1, FINAL_LEVEL);
    untilPlaying(game);
    const keep = pelletKey(game.maze, game.maze.heroStart.x - 1, game.maze.heroStart.y);
    eatAllPelletsBut(game, keep);
    run(game, 0.1, 'left');
    expect(game.phase).toBe('levelClear');
    game.drainEvents();
    run(game, PHASE_DURATION.levelClear + 0.1);
    expect(game.phase).toBe('victory');
    expect(game.level).toBe(FINAL_LEVEL);
    expect(game.drainEvents()).toContain('victory');
    run(game, 5, 'left');
    expect(game.phase).toBe('victory');
  });

  it('announces a new level with a longer ready phase, but not after a death', () => {
    const game = newGame();
    expect(game.roundKind).toBe('gameStart');
    untilPlaying(game);
    eatAllPelletsBut(game, pelletKey(game.maze, 12, 22));
    run(game, 0.1, 'left');
    run(game, PHASE_DURATION.levelClear + 0.05);
    expect(game.phase).toBe('ready');
    expect(game.roundKind).toBe('newLevel');
    expect(game.phaseTimer).toBeGreaterThan(PHASE_DURATION.ready);
    die(game);
    expect(game.roundKind).toBe('retry');
    expect(game.phaseTimer).toBeLessThanOrEqual(PHASE_DURATION.ready);
  });

  it('shows a bonus item after 70 pellets', () => {
    const game = newGame();
    untilPlaying(game);
    const keys = [...game.maze.pellets].filter((k) => k !== pelletKey(game.maze, 12, 22));
    for (const k of keys.slice(0, 69)) game.eaten.add(k);
    game.levelDots = 69;
    run(game, 0.1, 'left');
    expect(game.bonus?.kind).toBe('apple');
    expect(game.bonus?.pos).toEqual(game.bonusPosition());
    expect(game.maze.tiles[game.bonus!.pos.y][game.bonus!.pos.x]).toBe('path');
  });

  it('awards one extra life at 10000 points', () => {
    const game = newGame();
    untilPlaying(game);
    game.players[0].score = EXTRA_LIFE_SCORE - 10;
    run(game, 0.1, 'left');
    expect(game.players[0].lives).toBe(START_LIVES + 1);
    expect(game.drainEvents()).toContain('extraLife');
    expect(game.highScore).toBe(EXTRA_LIFE_SCORE);
  });

  it('releases chasers from the house as pellets are eaten', () => {
    const game = newGame();
    expect(game.chasers.find((c) => c.kind === 'zap')!.state).toBe('leaving');
    expect(game.chasers.find((c) => c.kind === 'flux')!.state).toBe('house');
    untilPlaying(game);
    game.heroes[0].queued = 'none'; // stand still so no pellet resets the idle timer
    run(game, 4.5); // idle timer releases the next one
    expect(game.chasers.find((c) => c.kind === 'flux')!.state).not.toBe('house');
  });
});

describe('two players at the same time', () => {
  it('spawns both heroes at once, on open tiles beside the start', () => {
    for (const maze of MAZES) {
      expect(maze.tiles[maze.heroStart.y][maze.heroStart.x - 1]).toBe('path');
      expect(maze.tiles[maze.heroStart.y][maze.heroStart.x + 1]).toBe('path');
    }
    const game = newGame(2);
    expect(game.heroes).toHaveLength(2);
    const [a, b] = game.heroes;
    expect({ x: a.x, y: a.y }).toEqual({ x: game.maze.heroStart.x - 1, y: game.maze.heroStart.y });
    expect({ x: b.x, y: b.y }).toEqual({ x: game.maze.heroStart.x + 1, y: game.maze.heroStart.y });
  });

  it('moves each hero with its own input', () => {
    const game = newGame(2);
    untilPlaying(game);
    const [a, b] = game.heroes;
    const ax = a.x;
    const bx = b.x;
    run(game, 0.2, 'left', 'right');
    expect(a.x).toBeLessThan(ax);
    expect(b.x).toBeGreaterThan(bx);
  });

  it('shares the pellets but keeps separate scores', () => {
    const game = newGame(2);
    untilPlaying(game);
    run(game, 0.1, 'left', 'right');
    // Each hero eats the pellet it spawned on plus the next one.
    expect(game.players[0].score).toBe(20);
    expect(game.players[1].score).toBe(20);
    game.heroes[1].x = 11;
    run(game, 0.05, 'none', 'none');
    expect(game.players[1].score).toBe(20); // already eaten by player one
    expect(game.hasPellet(11, 22)).toBe(false);
    expect(game.hasPellet(15, 22)).toBe(false);
  });

  it('a catch costs only that player a life and restarts the round for both', () => {
    const game = newGame(2);
    die(game, 1);
    expect(game.players[1].lives).toBe(START_LIVES - 1);
    expect(game.players[0].lives).toBe(START_LIVES);
    expect(game.phase).toBe('ready');
    expect(game.heroes).toHaveLength(2);
    expect(game.heroes[0].x).toBe(game.maze.heroStart.x - 1);
  });

  it('keeps playing with one hero after the other is out, game over when both are out', () => {
    const game = newGame(2);
    game.players[0].lives = 1;
    die(game, 0);
    expect(game.phase).toBe('ready');
    expect(game.isOut(0)).toBe(true);
    expect(game.activeHeroIndices()).toEqual([1]);
    for (let i = 0; i < START_LIVES; i++) die(game, 1);
    expect(game.phase).toBe('gameOver');
  });

  it('both players move on to a new maze together after clearing the level', () => {
    const game = newGame(2);
    untilPlaying(game);
    eatAllPelletsBut(game, pelletKey(game.maze, 11, 22));
    run(game, 0.15, 'left', 'right');
    expect(game.phase).toBe('levelClear');
    run(game, PHASE_DURATION.levelClear + 0.05);
    expect(game.level).toBe(2);
    expect(game.maze).toBe(MAZES[1]);
    expect(game.heroes).toHaveLength(2);
    expect(game.players.map((p) => p.lives)).toEqual([START_LIVES, START_LIVES]);
  });

  it('chasers hunt the nearest hero', () => {
    const game = newGame(2);
    untilPlaying(game);
    const [a, b] = game.heroes;
    a.x = 1;
    a.y = 1;
    b.x = 25;
    b.y = 28;
    game.mode = 'chase';
    const bolt = game.chasers[0];
    bolt.x = 24;
    bolt.y = 28;
    expect(currentTarget(bolt, game.chaseContextFor(bolt))).toEqual({ x: 25, y: 28 });
    bolt.x = 2;
    bolt.y = 1;
    expect(currentTarget(bolt, game.chaseContextFor(bolt))).toEqual({ x: 1, y: 1 });
  });

  it('awards points to the hero that eats a frightened chaser', () => {
    const game = newGame(2);
    untilPlaying(game);
    isolate(game, 1);
    collide(game, true, 0, 1);
    expect(game.players[1].score).toBeGreaterThanOrEqual(200);
    expect(game.players[0].score).toBeLessThan(200);
  });
});
