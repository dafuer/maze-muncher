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
    '#......##.####',
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
    '######.##.####',
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

/** Every new level loads the next maze, cycling through all of them. */
export function mazeIndexForLevel(level: number): number {
  return (Math.max(1, Math.floor(level)) - 1) % MAZES.length;
}

export function mazeForLevel(level: number): Maze {
  return MAZES[mazeIndexForLevel(level)];
}
