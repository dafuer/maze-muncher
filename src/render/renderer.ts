import { CHASER_INFO, CHASER_KINDS, type Chaser } from '../core/chaser';
import type { Game } from '../core/game';
import { levelConfig } from '../core/levels';
import { tileAt, type Maze } from '../core/maze';
import { MAZES } from '../core/mazes';
import { drawBonus, drawChaser, drawHero, drawHeroDeath, HERO_COLOR, HERO_COLORS } from './sprites';

export const TILE = 24;
const HUD_TOP = 3;
const HUD_BOTTOM = 2;
const FONT = '"Press Start 2P", monospace';

export const COLS = MAZES[0].width;
export const ROWS = MAZES[0].height + HUD_TOP + HUD_BOTTOM;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export interface TitleState {
  highScore: number;
  clock: number;
  muted: boolean;
}

/** Clickable areas on the title screen, in canvas-normalized coordinates. */
export const TITLE_BUTTONS = {
  one: { x0: 0.12, x1: 0.48, y0: 0.8, y1: 0.88 },
  two: { x0: 0.52, x1: 0.88, y0: 0.8, y1: 0.88 },
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly wallCache = new Map<string, HTMLCanvasElement>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.fit();
    window.addEventListener('resize', () => this.fit());
  }

  /** Scales the canvas with CSS to fit the window while keeping the aspect ratio. */
  fit(): void {
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    this.canvas.style.width = `${Math.floor(WIDTH * scale)}px`;
    this.canvas.style.height = `${Math.floor(HEIGHT * scale)}px`;
  }

  // ------------------------------------------------------------------ helpers

  private text(str: string, x: number, y: number, color: string, size = 18, align: CanvasTextAlign = 'center'): void {
    const ctx = this.ctx;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  /** Pixel center of a tile coordinate inside the maze area. */
  private px(tx: number): number {
    return tx * TILE + TILE / 2;
  }

  private py(ty: number): number {
    return (ty + HUD_TOP) * TILE + TILE / 2;
  }

  private wallsFor(maze: Maze, white: boolean): HTMLCanvasElement {
    const key = `${maze.name}:${white}`;
    const cached = this.wallCache.get(key);
    if (cached) return cached;

    const outline = white ? '#ffffff' : maze.wallColor;
    const fill = white ? '#222' : maze.wallFill;
    const layer = document.createElement('canvas');
    layer.width = maze.width * TILE;
    layer.height = maze.height * TILE;
    const g = layer.getContext('2d')!;
    const isWall = (x: number, y: number) => tileAt(maze, x, y) === 'wall';

    const paint = (inset: number) => {
      for (let y = 0; y < maze.height; y++) {
        for (let x = 0; x < maze.width; x++) {
          if (!isWall(x, y)) continue;
          const l = isWall(x - 1, y) ? 0 : inset;
          const r = isWall(x + 1, y) ? 0 : inset;
          const t = isWall(x, y - 1) ? 0 : inset;
          const b = isWall(x, y + 1) ? 0 : inset;
          g.fillRect(x * TILE + l, y * TILE + t, TILE - l - r, TILE - t - b);
        }
      }
    };
    g.shadowColor = outline;
    g.shadowBlur = 8;
    g.fillStyle = outline;
    paint(TILE * 0.2);
    g.shadowBlur = 0;
    g.fillStyle = fill;
    paint(TILE * 0.2 + 3);

    // House door.
    g.fillStyle = white ? '#fff' : '#ffb3e6';
    g.fillRect(maze.door.x * TILE, maze.door.y * TILE + TILE * 0.4, TILE, TILE * 0.2);

    this.wallCache.set(key, layer);
    return layer;
  }

  // ------------------------------------------------------------------ title

  drawTitle(state: TitleState): void {
    const ctx = this.ctx;
    const t = state.clock;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.text('HIGH SCORE', WIDTH / 2, TILE, '#fff', 16);
    this.text(String(state.highScore).padStart(6, '0'), WIDTH / 2, TILE * 2.1, '#fff', 16);

    // Title with a gentle wave.
    const title = 'MAZE MUNCHER';
    ctx.font = `40px ${FONT}`;
    const total = ctx.measureText(title).width;
    let x = (WIDTH - total) / 2;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const w = ctx.measureText(ch).width;
      const hue = (i * 25 + t * 80) % 360;
      this.text(ch, x + w / 2, TILE * 5.5 + Math.sin(t * 3 + i * 0.5) * 6, `hsl(${hue},100%,60%)`, 40);
      x += w;
    }

    this.text('- MEET THE DRONES -', WIDTH / 2, TILE * 9, '#9cf', 16);
    CHASER_KINDS.forEach((kind, i) => {
      const info = CHASER_INFO[kind];
      const y = TILE * (11.5 + i * 2.6);
      const fake = { kind, state: 'active', frightened: false, homeX: i, x: 0, y: 0, dir: 'right', target: { x: 0, y: 0 } } as Chaser;
      drawChaser(ctx, fake, TILE * 5, y, TILE * 0.9, t, 99);
      this.text(info.name, TILE * 7.5, y - 8, info.color, 18, 'left');
      this.text(info.trait, TILE * 7.5, y + 16, '#bbb', 12, 'left');
    });

    // Little chase animation across the screen.
    const runY = TILE * 22.5;
    const phase = (t * 0.18) % 1;
    const hx = -TILE * 2 + phase * (WIDTH + TILE * 10);
    drawHero(ctx, hx, runY, TILE * 0.85, 'right', Math.abs(Math.sin(t * 12)));
    CHASER_KINDS.forEach((kind, i) => {
      const fake = { kind, state: 'active', frightened: false, homeX: i, x: 0, y: 0, dir: 'right', target: { x: 0, y: 0 } } as Chaser;
      drawChaser(ctx, fake, hx - TILE * (2.6 + i * 1.8), runY, TILE * 0.8, t, 99);
    });
    for (let i = 0; i < 20; i++) {
      const px = i * TILE * 1.5 + TILE;
      if (px > hx) {
        ctx.fillStyle = '#ffe9c2';
        ctx.fillRect(px - 3, runY - 3, 6, 6);
      }
    }

    this.text('PELLET 10   POWER 50', WIDTH / 2, TILE * 25, '#ffe9c2', 13);

    const blink = Math.floor(t * 2) % 2 === 0;
    for (const [key, label] of [['one', '1 PLAYER'], ['two', '2 PLAYERS']] as const) {
      const b = TITLE_BUTTONS[key];
      const bx = b.x0 * WIDTH;
      const by = b.y0 * HEIGHT;
      const bw = (b.x1 - b.x0) * WIDTH;
      const bh = (b.y1 - b.y0) * HEIGHT;
      ctx.strokeStyle = HERO_COLOR;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);
      this.text(label, bx + bw / 2, by + bh / 2, blink ? HERO_COLOR : '#fff', 16);
    }
    this.text('PRESS 1 OR 2  ·  TAP A BUTTON', WIDTH / 2, HEIGHT * 0.91, '#aaa', 11);
    this.text('P1 ARROWS/SWIPE · P2 WASD · P PAUSE · M SOUND', WIDTH / 2, HEIGHT * 0.94, '#777', 10);
    this.text(state.muted ? 'SOUND OFF' : 'SOUND ON', WIDTH / 2, HEIGHT * 0.97, state.muted ? '#f66' : '#6f6', 10);
  }

  // ------------------------------------------------------------------ game

  drawGame(game: Game, paused: boolean, muted: boolean): void {
    const ctx = this.ctx;
    const maze = game.maze;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawHud(game);

    const flashWhite =
      game.phase === 'levelClear' && game.phaseTimer < 2 && Math.floor(game.phaseTimer * 4) % 2 === 0;
    ctx.drawImage(this.wallsFor(maze, flashWhite), 0, HUD_TOP * TILE);

    this.drawPellets(game);

    if (game.bonus) {
      drawBonus(ctx, game.bonus.kind, this.px(game.bonus.pos.x), this.py(game.bonus.pos.y), TILE * 0.7);
    }

    const showActors = game.phase !== 'gameOver';
    const dying = game.phase === 'dying';
    if (showActors && game.phase !== 'levelClear') {
      // During the death animation the chasers disappear after a short freeze.
      const hideChasers = (dying && game.phaseTimer < 2.4 - 0.6) || this.showPlayerBanner(game);
      if (!hideChasers) {
        for (const c of game.chasers) {
          if (game.phase === 'eatPause' && c.state === 'eaten' && game.popups.some((p) => p.timer > 1.0)) continue;
          this.drawChaserClipped(game, c);
        }
      }
    }
    if (showActors) game.activeHeroIndices().forEach((i) => this.drawHeroState(game, i));

    for (const p of game.popups) {
      this.text(p.text, this.px(p.x), this.py(p.y), '#7ff', 13);
    }

    this.drawMessages(game);

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      this.text('PAUSED', WIDTH / 2, HEIGHT / 2 - 20, '#fff', 28);
      this.text('P TO RESUME · ESC TO QUIT', WIDTH / 2, HEIGHT / 2 + 24, '#aaa', 12);
    }
    if (muted) this.text('MUTE', WIDTH - 6, HEIGHT - TILE * 0.5, '#f66', 10, 'right');
  }

  private drawChaserClipped(game: Game, c: Chaser): void {
    const ctx = this.ctx;
    // Clip so chasers vanish into the tunnel edges.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_TOP * TILE - TILE, WIDTH, game.maze.height * TILE + TILE * 2);
    ctx.clip();
    drawChaser(ctx, c, this.px(c.x), this.py(c.y), TILE * 0.8, game.clock, game.frightTimer);
    ctx.restore();
  }

  private drawHeroState(game: Game, index: number): void {
    const h = game.heroes[index];
    const color = HERO_COLORS[index] ?? HERO_COLOR;
    const cx = this.px(h.x);
    const cy = this.py(h.y);
    if (game.phase === 'dying' && index === game.dyingHero) {
      const freeze = 0.6;
      const elapsed = 2.4 - game.phaseTimer;
      if (elapsed < freeze) drawHero(this.ctx, cx, cy, TILE * 0.8, h.facing, 0.5, color);
      else drawHeroDeath(this.ctx, cx, cy, TILE * 0.8, Math.min(1, (elapsed - freeze) / 1.6), color);
      return;
    }
    if (game.phase === 'eatPause' && index === game.eaterHero) return; // the score popup replaces the hero briefly
    const mouth = game.phase === 'playing' ? Math.abs(Math.sin(h.travelled * Math.PI * 1.5)) : 0.6;
    drawHero(this.ctx, cx, cy, TILE * 0.8, h.facing, mouth, color);
  }

  private drawPellets(game: Game): void {
    const ctx = this.ctx;
    const maze = game.maze;
    const blink = game.phase !== 'playing' || Math.floor(game.clock * 4) % 2 === 0;
    ctx.fillStyle = maze.pelletColor;
    for (const key of maze.pellets) {
      if (game.eaten.has(key)) continue;
      const x = key % maze.width;
      const y = Math.floor(key / maze.width);
      ctx.fillRect(this.px(x) - 3, this.py(y) - 3, 6, 6);
    }
    if (!blink) return;
    for (const key of maze.powerPellets) {
      if (game.eaten.has(key)) continue;
      const x = key % maze.width;
      const y = Math.floor(key / maze.width);
      ctx.beginPath();
      ctx.arc(this.px(x), this.py(y), TILE * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHud(game: Game): void {
    const blink = Math.floor(game.clock * 3) % 2 === 0;
    const multi = game.players.length > 1;
    game.players.forEach((p, i) => {
      const x = i === 0 ? TILE * 4 : WIDTH - TILE * 4;
      const color = multi ? HERO_COLORS[i] : '#fff';
      if (game.isOut(i) && multi) {
        if (blink) this.text('OUT', x, TILE * 0.8, '#f33', 16);
      } else if (multi || blink || game.phase !== 'playing') {
        this.text(`${p.id}UP`, x, TILE * 0.8, color, 16);
      }
      this.text(String(p.score).padStart(2, '0'), x, TILE * 1.9, '#fff', 16);
    });
    this.text('HIGH SCORE', WIDTH / 2, TILE * 0.8, '#fff', 16);
    this.text(String(game.highScore).padStart(2, '0'), WIDTH / 2, TILE * 1.9, '#fff', 16);

    // Bottom: reserve lives per player and (one player) recent bonus items.
    const by = HEIGHT - TILE;
    game.players.forEach((p, i) => {
      const reserve = Math.min(Math.max(0, p.lives - 1), 4);
      for (let k = 0; k < reserve; k++) {
        const x = i === 0 ? TILE * (1.5 + k * 1.6) : WIDTH - TILE * (1.5 + k * 1.6);
        drawHero(this.ctx, x, by, TILE * 0.6, i === 0 ? 'left' : 'right', 0.5, HERO_COLORS[i]);
      }
    });
    const level = game.level;
    if (!multi) {
      const first = Math.max(1, level - 6);
      for (let l = level, i = 0; l >= first; l--, i++) {
        drawBonus(this.ctx, levelConfig(l).bonus, WIDTH - TILE * (1.5 + i * 1.6), by, TILE * 0.55);
      }
    }
    this.text(`LEVEL ${level}`, WIDTH / 2, by - 7, '#aaa', 11);
    this.text(game.maze.name.toUpperCase(), WIDTH / 2, by + 9, game.maze.wallColor, 9);
  }

  /** The banner shows first at the start of a game or level, then the chasers appear. */
  private showPlayerBanner(game: Game): boolean {
    if (game.phase !== 'ready' || game.roundKind === 'retry') return false;
    return game.phaseTimer > (game.roundKind === 'gameStart' ? 2 : 1.4);
  }

  private drawMessages(game: Game): void {
    const maze = game.maze;
    const midX = this.px(maze.houseExit.x);
    const belowHouse = this.py(maze.door.y + 5);
    const aboveHouse = this.py(maze.door.y - 1);
    const multi = game.players.length > 1;

    if (game.phase === 'ready') {
      if (this.showPlayerBanner(game)) {
        if (game.roundKind === 'newLevel') {
          this.text(`LEVEL ${game.level}`, midX, aboveHouse, '#3ef', 22);
          this.text(maze.name.toUpperCase(), midX, this.py(maze.door.y + 2), maze.wallColor, 14);
        } else {
          this.text(multi ? '2 PLAYERS' : 'PLAYER ONE', midX, aboveHouse, '#3ef', 18);
        }
      }
      this.text('READY!', midX, belowHouse, '#ff0', 18);
    }
    if (game.phase === 'gameOver') {
      this.text('GAME  OVER', midX, belowHouse, '#f33', 18);
    }
    if (game.phase === 'levelClear' && game.phaseTimer > 1.4) {
      this.text('STAGE CLEAR!', midX, belowHouse, '#0f8', 18);
    }
  }
}
