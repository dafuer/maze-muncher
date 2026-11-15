import { neighbor, type Maze } from './maze';
import { advance, canMove, isAtCenter, tileOf, type Mover } from './movement';
import { DIR_PRIORITY, DIR_VECTORS, distanceSq, opposite, type Dir, type Rng, type Vec } from './types';

export type ChaserKind = 'bolt' | 'zap' | 'flux' | 'glitch';
export type ChaserState = 'house' | 'leaving' | 'active' | 'eaten' | 'entering';
export type GlobalMode = 'scatter' | 'chase';

export const CHASER_KINDS: readonly ChaserKind[] = ['bolt', 'zap', 'flux', 'glitch'];

export const CHASER_INFO: Record<ChaserKind, { name: string; trait: string; color: string }> = {
  bolt: { name: 'BOLT', trait: 'the hunter', color: '#ff4040' },
  zap: { name: 'ZAP', trait: 'the trickster', color: '#c06bff' },
  flux: { name: 'FLUX', trait: 'the flanker', color: '#2fb8ff' },
  glitch: { name: 'GLITCH', trait: 'the coward', color: '#ffb030' },
};

export interface Chaser extends Mover {
  kind: ChaserKind;
  state: ChaserState;
  frightened: boolean;
  /** Resting x position inside the house. */
  homeX: number;
  target: Vec;
}

export interface ChaseContext {
  maze: Maze;
  mode: GlobalMode;
  heroTile: Vec;
  heroFacing: Dir;
  boltTile: Vec;
  /** The lead chaser keeps hunting during scatter when enraged. */
  enraged: boolean;
  rng: Rng;
}

export function createChasers(maze: Maze): Chaser[] {
  const c = maze.houseCenter;
  const homes: Record<ChaserKind, number> = { bolt: c.x, zap: c.x, flux: c.x - 2, glitch: c.x + 2 };
  return CHASER_KINDS.map((kind) => {
    const outside = kind === 'bolt';
    return {
      kind,
      state: outside ? 'active' : 'house',
      frightened: false,
      homeX: homes[kind],
      x: outside ? maze.houseExit.x : homes[kind],
      y: outside ? maze.houseExit.y : c.y,
      dir: outside ? 'left' : kind === 'zap' ? 'down' : 'up',
      target: { x: 0, y: 0 },
    } satisfies Chaser;
  });
}

export function scatterCorner(maze: Maze, kind: ChaserKind): Vec {
  switch (kind) {
    case 'bolt':
      return { x: maze.width - 3, y: -3 };
    case 'zap':
      return { x: 2, y: -3 };
    case 'flux':
      return { x: maze.width - 1, y: maze.height };
    case 'glitch':
      return { x: 0, y: maze.height };
  }
}

export function chaseTarget(kind: ChaserKind, ctx: ChaseContext): Vec {
  const h = ctx.heroTile;
  const f = DIR_VECTORS[ctx.heroFacing];
  switch (kind) {
    case 'bolt':
      return { ...h };
    case 'zap':
      return { x: h.x + 4 * f.x, y: h.y + 4 * f.y };
    case 'flux': {
      const pivot = { x: h.x + 2 * f.x, y: h.y + 2 * f.y };
      return { x: 2 * pivot.x - ctx.boltTile.x, y: 2 * pivot.y - ctx.boltTile.y };
    }
    case 'glitch':
      // Glitch hunts directly; its shyness is applied in currentTarget.
      return { ...h };
  }
}

export function currentTarget(ch: Chaser, ctx: ChaseContext): Vec {
  if (ch.state === 'eaten') return ctx.maze.houseExit;
  if (ch.kind === 'glitch') {
    const me = tileOf(ch);
    const close = distanceSq(me, ctx.heroTile) <= 64;
    if (ctx.mode === 'scatter' || close) return scatterCorner(ctx.maze, 'glitch');
    return { ...ctx.heroTile };
  }
  if (ctx.mode === 'scatter' && !(ch.kind === 'bolt' && ctx.enraged)) {
    return scatterCorner(ctx.maze, ch.kind);
  }
  return chaseTarget(ch.kind, ctx);
}

/** Picks the next direction at a tile center; chasers never reverse on their own. */
export function chooseDirection(
  maze: Maze,
  tile: Vec,
  dir: Dir,
  target: Vec,
  random: Rng | null,
): Dir {
  const back = opposite(dir);
  const options = DIR_PRIORITY.filter((d) => d !== back && canMove(maze, tile, d));
  if (options.length === 0) return back !== 'none' ? back : 'left';
  if (random) return options[Math.floor(random() * options.length)];
  let best = options[0];
  let bestDist = Infinity;
  for (const d of options) {
    const dist = distanceSq(neighbor(tile, d), target);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/** Moves along one axis toward a coordinate; returns the distance left over. */
function slide(ch: Chaser, axis: 'x' | 'y', to: number, distance: number): number {
  const delta = to - ch[axis];
  if (Math.abs(delta) <= distance) {
    ch[axis] = to;
    return distance - Math.abs(delta);
  }
  const s = Math.sign(delta);
  ch[axis] += s * distance;
  ch.dir = axis === 'x' ? (s > 0 ? 'right' : 'left') : s > 0 ? 'down' : 'up';
  return 0;
}

/** Waiting inside the house: bob up and down around the house center. */
function bob(ch: Chaser, maze: Maze, distance: number): void {
  const top = maze.houseCenter.y - 0.5;
  const bottom = maze.houseCenter.y + 0.5;
  let remaining = distance;
  let guard = 0;
  while (remaining > 0 && guard++ < 8) {
    const to = ch.dir === 'up' ? top : bottom;
    remaining = slide(ch, 'y', to, remaining);
    if (ch.y === to) ch.dir = ch.dir === 'up' ? 'down' : 'up';
  }
}

export function reverseChaser(ch: Chaser): void {
  if (ch.state === 'active') ch.dir = opposite(ch.dir);
}

export function releaseChaser(ch: Chaser): void {
  if (ch.state === 'house') ch.state = 'leaving';
}

/** Advances one chaser by `distance` tiles according to its state. */
export function updateChaser(ch: Chaser, ctx: ChaseContext, distance: number): void {
  const { maze } = ctx;
  switch (ch.state) {
    case 'house':
      bob(ch, maze, distance);
      return;
    case 'leaving': {
      let rest = slide(ch, 'x', maze.houseExit.x, distance);
      if (ch.x === maze.houseExit.x) rest = slide(ch, 'y', maze.houseExit.y, rest);
      if (ch.x === maze.houseExit.x && ch.y === maze.houseExit.y) {
        ch.state = 'active';
        ch.dir = 'left';
      }
      return;
    }
    case 'entering': {
      let rest = slide(ch, 'y', maze.houseCenter.y, distance);
      if (ch.y === maze.houseCenter.y) rest = slide(ch, 'x', ch.homeX, rest);
      if (ch.y === maze.houseCenter.y && ch.x === ch.homeX) {
        ch.state = 'leaving';
        ch.frightened = false;
      }
      return;
    }
    case 'active':
    case 'eaten': {
      advance(maze, ch, distance, (tile) => {
        if (ch.state === 'eaten' && tile.x === maze.houseExit.x && tile.y === maze.houseExit.y) {
          ch.state = 'entering';
          return 'none';
        }
        ch.target = currentTarget(ch, ctx);
        const random = ch.frightened && ch.state === 'active' ? ctx.rng : null;
        return chooseDirection(maze, tile, ch.dir, ch.target, random);
      });
      if ((ch.state as ChaserState) === 'entering' && isAtCenter(ch)) ch.dir = 'down';
      return;
    }
  }
}
