import { DIR_VECTORS, type Dir, type Vec } from './types';

export type Tile = 'wall' | 'path' | 'door' | 'house';

export interface MazeDefinition {
  name: string;
  /** Left half of the maze including the center column; the right half is mirrored. */
  leftHalf: readonly string[];
  wallColor: string;
  wallFill: string;
  pelletColor: string;
}

export interface Maze {
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
  /** Initial pellet layout: key = y * width + x. */
  pellets: ReadonlySet<number>;
  powerPellets: ReadonlySet<number>;
  heroStart: Vec;
  /** Tile right above the house door, where chasers enter/leave the house. */
  houseExit: Vec;
  /** Center of the house interior. */
  houseCenter: Vec;
  door: Vec;
  tunnelRows: readonly number[];
  wallColor: string;
  wallFill: string;
  pelletColor: string;
}

/**
 * Legend:
 *  '#' wall, '.' pellet, 'o' power pellet, ' ' empty path,
 *  '-' house door, 'H' house interior, 'P' hero start (empty path).
 */
export function mirrorRows(leftHalf: readonly string[]): string[] {
  return leftHalf.map((row) => {
    const mirrored = row.slice(0, -1).split('').reverse().join('');
    return row + mirrored;
  });
}

export function parseMaze(def: MazeDefinition): Maze {
  const rows = mirrorRows(def.leftHalf);
  const height = rows.length;
  const width = rows[0].length;
  const tiles: Tile[][] = [];
  const pellets = new Set<number>();
  const powerPellets = new Set<number>();
  let heroStart: Vec | null = null;
  let door: Vec | null = null;
  const houseCells: Vec[] = [];

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Maze ${def.name}: row ${y} has length ${row.length}, expected ${width}`);
    }
    const line: Tile[] = [];
    row.split('').forEach((ch, x) => {
      switch (ch) {
        case '#':
          line.push('wall');
          break;
        case '.':
          line.push('path');
          pellets.add(y * width + x);
          break;
        case 'o':
          line.push('path');
          powerPellets.add(y * width + x);
          break;
        case ' ':
          line.push('path');
          break;
        case 'P':
          line.push('path');
          heroStart = { x, y };
          break;
        case '-':
          line.push('door');
          door = { x, y };
          break;
        case 'H':
          line.push('house');
          houseCells.push({ x, y });
          break;
        default:
          throw new Error(`Maze ${def.name}: unknown tile '${ch}' at ${x},${y}`);
      }
    });
    tiles.push(line);
  });

  if (!heroStart) throw new Error(`Maze ${def.name}: missing hero start`);
  if (!door) throw new Error(`Maze ${def.name}: missing house door`);
  if (houseCells.length === 0) throw new Error(`Maze ${def.name}: missing house`);

  const doorPos = door as Vec;
  const xs = houseCells.map((c) => c.x);
  const ys = houseCells.map((c) => c.y);
  const houseCenter = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };

  const tunnelRows: number[] = [];
  tiles.forEach((line, y) => {
    if (line[0] === 'path' && line[width - 1] === 'path') tunnelRows.push(y);
  });

  return {
    name: def.name,
    width,
    height,
    tiles,
    pellets,
    powerPellets,
    heroStart: heroStart as Vec,
    door: doorPos,
    houseExit: { x: doorPos.x, y: doorPos.y - 1 },
    houseCenter,
    tunnelRows,
    wallColor: def.wallColor,
    wallFill: def.wallFill,
    pelletColor: def.pelletColor,
  };
}

export function tileAt(maze: Maze, x: number, y: number): Tile {
  if (y < 0 || y >= maze.height) return 'wall';
  if (x < 0 || x >= maze.width) {
    // Outside horizontally: only tunnel rows continue.
    return maze.tunnelRows.includes(y) ? 'path' : 'wall';
  }
  return maze.tiles[y][x];
}

/** Whether the hero (or a chaser roaming the maze) may enter this tile. */
export function isOpen(maze: Maze, x: number, y: number): boolean {
  return tileAt(maze, x, y) === 'path';
}

export function neighbor(pos: Vec, dir: Dir): Vec {
  const v = DIR_VECTORS[dir];
  return { x: pos.x + v.x, y: pos.y + v.y };
}

export function wrapX(maze: Maze, x: number): number {
  if (x < -0.5) return x + maze.width;
  if (x > maze.width - 0.5) return x - maze.width;
  return x;
}

export function isTunnel(maze: Maze, x: number, y: number): boolean {
  if (!maze.tunnelRows.includes(y)) return false;
  return x <= 4 || x >= maze.width - 5;
}

export function pelletKey(maze: Maze, x: number, y: number): number {
  return y * maze.width + x;
}
