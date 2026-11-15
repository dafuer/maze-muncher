import { parseMaze, type Maze, type MazeDefinition } from './maze';

/*
 * Original maze layouts. Only the left half (14 columns, the last one being the
 * center column) is written; the right half is mirrored automatically.
 */

const NEON_GRID: MazeDefinition = {
  name: 'Neon Grid',
  wallColor: '#3ee6ff',
  wallFill: '#06202a',
  pelletColor: '#ffe9c2',
  leftHalf: [
    '##############',
    '#............#',
    '#.####.#####.#',
    '#o####.#####.#',
    '#.####.#####.#',
    '#.............',
    '#.####.##.####',
    '#.####.##.####',
    '#......##....#',
    '######.#####.#',
    '######.#####.#',
    '######.##.....',
    '######.##.###-',
    '######.##.#HHH',
    '      ....#HHH',
    '######.##.#HHH',
    '######.##.####',
    '######.##.....',
    '######.##.####',
    '#............#',
    '#.####.#####.#',
    '#.####.#####.#',
    '#o..##.......P',
    '###.##.##.####',
    '###.##.##.####',
    '#......##....#',
    '#.##########.#',
    '#.##########.#',
    '#.............',
    '##############',
  ],
};

const CANDY_CIRCUIT: MazeDefinition = {
  name: 'Candy Circuit',
  wallColor: '#ff6fb5',
  wallFill: '#2a0618',
  pelletColor: '#fff3a8',
  leftHalf: [
    '##############',
    '#.....##.....#',
    '#o###.##.###.#',
    '#.###.##.###.#',
    '#.............',
    '###.#.####.###',
    '###.#.####.###',
    '#...#......###',
    '#.####.##.####',
    '#.####.##.####',
    '#......##....#',
    '######.##.....',
    '######.##.###-',
    '######.##.#HHH',
    '      ....#HHH',
    '######.##.#HHH',
    '######.##.####',
    '######.##.....',
    '######.##.####',
    '#......#.....#',
    '#.####.#.###.#',
    '#o...........P',
    '###.#.###.####',
    '###.#.###.####',
    '#.....#.......',
    '#.###.#.####.#',
    '#.###.#.####.#',
    '#.###.#.####.#',
    '#............#',
    '##############',
  ],
};

const EMBER_FORGE: MazeDefinition = {
  name: 'Ember Forge',
  wallColor: '#ff9a3c',
  wallFill: '#2a1004',
  pelletColor: '#d8f7ff',
  leftHalf: [
    '##############',
    '#.....##......',
    '#.###.##.####.',
    '#o###.##.####.',
    '#.............',
    '#.##.####.##.#',
    '#.##.####.##.#',
    '#....#.......#',
    '####.#.##.####',
    '####...##.####',
    '######.##....#',
    '######.##.....',
    '######.##.###-',
    '######.##.#HHH',
    '      ....#HHH',
    '######.##.#HHH',
    '######.##.####',
    '######.##.....',
    '######.##.####',
    '#............#',
    '#.#.#.####.#.#',
    '#o..#......#.P',
    '##.##.##.#.###',
    '#.....#....###',
    '#.##.##.##.###',
    '#.##.##.##.###',
    '#.............',
    '#.##########.#',
    '#............#',
    '##############',
  ],
};

export const MAZE_DEFINITIONS: readonly MazeDefinition[] = [NEON_GRID, CANDY_CIRCUIT, EMBER_FORGE];

export const MAZES: readonly Maze[] = MAZE_DEFINITIONS.map(parseMaze);

/** Levels 1-2 use maze 0, 3-5 maze 1, 6-9 maze 2, then mazes 1 and 2 alternate every 4 levels. */
export function mazeIndexForLevel(level: number): number {
  if (level <= 2) return 0;
  if (level <= 5) return 1;
  if (level <= 9) return 2;
  return Math.floor((level - 10) / 4) % 2 === 0 ? 1 : 2;
}

export function mazeForLevel(level: number): Maze {
  return MAZES[mazeIndexForLevel(level)];
}
