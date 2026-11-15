import {
  createChasers,
  releaseChaser,
  reverseChaser,
  updateChaser,
  type ChaseContext,
  type Chaser,
  type ChaserKind,
  type GlobalMode,
} from './chaser';
import { createHero, moveHero, steerHero, type Hero } from './hero';
import { BASE_SPEED, BONUS_POINTS, levelConfig, modeAt, type BonusKind, type LevelConfig } from './levels';
import { isTunnel, pelletKey, type Maze } from './maze';
import { mazeForLevel } from './mazes';
import { tileOf } from './movement';
import { createRng, type Dir, type Rng, type Vec } from './types';

export type Phase = 'ready' | 'playing' | 'eatPause' | 'dying' | 'levelClear' | 'turnOver' | 'gameOver';

export type GameEvent =
  | 'intro'
  | 'chomp'
  | 'power'
  | 'eatChaser'
  | 'bonus'
  | 'death'
  | 'extraLife'
  | 'levelClear'
  | 'gameOver';

export interface PlayerState {
  id: number;
  score: number;
  /** Lives including the one in play. */
  lives: number;
  level: number;
  /** Keys of pellets (and power pellets) already eaten on the current level. */
  eaten: Set<number>;
  levelDots: number;
  extraLifeGiven: boolean;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  timer: number;
}

export interface ActiveBonus {
  kind: BonusKind;
  pos: Vec;
  timer: number;
}

export const START_LIVES = 3;
export const EXTRA_LIFE_SCORE = 10_000;
export const PELLET_POINTS = 10;
export const POWER_POINTS = 50;
export const BONUS_DOTS = [70, 170] as const;

export const PHASE_DURATION = {
  intro: 4.2,
  ready: 2,
  eatPause: 0.6,
  dying: 2.4,
  levelClear: 2.6,
  turnOver: 2.5,
};

const RELEASE_ORDER: readonly ChaserKind[] = ['zap', 'flux', 'glitch'];
const GLOBAL_RELEASE_DOTS: Record<ChaserKind, number> = { bolt: 0, zap: 7, flux: 17, glitch: 32 };

function personalReleaseDots(level: number, kind: ChaserKind): number {
  if (level === 1) return { bolt: 0, zap: 0, flux: 30, glitch: 60 }[kind];
  if (level === 2) return { bolt: 0, zap: 0, flux: 0, glitch: 50 }[kind];
  return 0;
}

export interface GameOptions {
  rng?: Rng;
  highScore?: number;
  startLevel?: number;
}

export class Game {
  readonly players: PlayerState[];
  current = 0;
  phase: Phase = 'ready';
  phaseTimer = PHASE_DURATION.intro;
  maze!: Maze;
  config!: LevelConfig;
  hero!: Hero;
  chasers: Chaser[] = [];
  mode: GlobalMode = 'scatter';
  modeElapsed = 0;
  frightTimer = 0;
  combo = 0;
  bonus: ActiveBonus | null = null;
  popups: Popup[] = [];
  highScore: number;
  /** Elapsed time for animations. */
  clock = 0;
  private events: GameEvent[] = [];
  private rng: Rng;
  private roundDots = 0;
  private useGlobalRelease = false;
  private idleTimer = 0;

  constructor(numPlayers: 1 | 2, options: GameOptions = {}) {
    this.rng = options.rng ?? createRng(Date.now());
    this.highScore = options.highScore ?? 0;
    const startLevel = options.startLevel ?? 1;
    this.players = Array.from({ length: numPlayers }, (_, i) => ({
      id: i + 1,
      score: 0,
      lives: START_LIVES,
      level: startLevel,
      eaten: new Set<number>(),
      levelDots: 0,
      extraLifeGiven: false,
    }));
    this.startRound(false);
    this.phaseTimer = PHASE_DURATION.intro;
    this.events.push('intro');
  }

  get player(): PlayerState {
    return this.players[this.current];
  }

  /** Returns and clears the events produced since the last call. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  remainingPellets(): number {
    const total = this.maze.pellets.size + this.maze.powerPellets.size;
    return total - this.player.eaten.size;
  }

  hasPellet(x: number, y: number): boolean {
    const key = pelletKey(this.maze, x, y);
    return this.maze.pellets.has(key) && !this.player.eaten.has(key);
  }

  hasPowerPellet(x: number, y: number): boolean {
    const key = pelletKey(this.maze, x, y);
    return this.maze.powerPellets.has(key) && !this.player.eaten.has(key);
  }

  bonusPosition(): Vec {
    return { x: this.maze.door.x, y: this.maze.door.y + 5 };
  }

  update(dt: number, input: Dir): void {
    this.clock += dt;
    this.popups = this.popups.filter((p) => (p.timer -= dt) > 0);

    switch (this.phase) {
      case 'ready':
        if ((this.phaseTimer -= dt) <= 0) this.phase = 'playing';
        return;
      case 'eatPause':
        if ((this.phaseTimer -= dt) <= 0) this.phase = 'playing';
        else this.moveEatenChasers(dt);
        return;
      case 'dying':
        if ((this.phaseTimer -= dt) <= 0) this.afterDeath();
        return;
      case 'levelClear':
        if ((this.phaseTimer -= dt) <= 0) this.nextLevel();
        return;
      case 'turnOver':
        if ((this.phaseTimer -= dt) <= 0) this.switchToNextAlivePlayer();
        return;
      case 'gameOver':
        return;
      case 'playing':
        this.tick(dt, input);
        return;
    }
  }

  // ---------------------------------------------------------------- round flow

  private startRound(afterDeath: boolean): void {
    const p = this.player;
    this.maze = mazeForLevel(p.level);
    this.config = levelConfig(p.level);
    this.hero = createHero(this.maze);
    this.chasers = createChasers(this.maze);
    this.mode = 'scatter';
    this.modeElapsed = 0;
    this.frightTimer = 0;
    this.combo = 0;
    this.bonus = null;
    this.popups = [];
    this.roundDots = 0;
    this.idleTimer = 0;
    this.useGlobalRelease = afterDeath;
    this.phase = 'ready';
    this.phaseTimer = PHASE_DURATION.ready;
    this.releaseByDots();
  }

  private nextLevel(): void {
    const p = this.player;
    p.level += 1;
    p.eaten = new Set();
    p.levelDots = 0;
    this.startRound(false);
  }

  private afterDeath(): void {
    const p = this.player;
    p.lives -= 1;
    if (this.players.every((pl) => pl.lives <= 0)) {
      this.phase = 'gameOver';
      this.events.push('gameOver');
      return;
    }
    if (p.lives <= 0) {
      // This player is out but the other one is still alive.
      this.phase = 'turnOver';
      this.phaseTimer = PHASE_DURATION.turnOver;
      return;
    }
    if (this.players.length > 1) {
      this.switchToNextAlivePlayer();
      return;
    }
    this.startRound(true);
  }

  private switchToNextAlivePlayer(): void {
    const n = this.players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (this.current + step) % n;
      if (this.players[idx].lives > 0) {
        const samePlayer = idx === this.current;
        this.current = idx;
        this.startRound(samePlayer);
        return;
      }
    }
    this.phase = 'gameOver';
    this.events.push('gameOver');
  }

  // ---------------------------------------------------------------- simulation

  private tick(dt: number, input: Dir): void {
    const cfg = this.config;
    steerHero(this.hero, input);

    // Global scatter/chase clock pauses while chasers are frightened.
    if (this.frightTimer > 0) {
      this.frightTimer -= dt;
      if (this.frightTimer <= 0) {
        this.frightTimer = 0;
        this.chasers.forEach((c) => (c.frightened = false));
      }
    } else {
      this.modeElapsed += dt;
      const mode = modeAt(cfg.schedule, this.modeElapsed);
      if (mode !== this.mode) {
        this.mode = mode;
        this.chasers.forEach(reverseChaser);
      }
    }

    const heroSpeed = this.frightTimer > 0 ? cfg.heroFrightSpeed : cfg.heroSpeed;
    moveHero(this.maze, this.hero, heroSpeed * dt);
    this.eatAtHero();
    if (this.phase !== 'playing') return;

    this.idleTimer += dt;
    if (this.idleTimer >= (this.player.level < 5 ? 4 : 3)) {
      this.idleTimer = 0;
      const next = this.nextInHouse();
      if (next) releaseChaser(next);
    }

    const ctx = this.chaseContext();
    for (const c of this.chasers) updateChaser(c, ctx, this.chaserSpeed(c) * dt);
    this.checkCollisions();

    if (this.bonus && (this.bonus.timer -= dt) <= 0) this.bonus = null;
  }

  private moveEatenChasers(dt: number): void {
    const ctx = this.chaseContext();
    for (const c of this.chasers) {
      if (c.state === 'eaten' || c.state === 'entering') updateChaser(c, ctx, this.chaserSpeed(c) * dt);
    }
  }

  private chaseContext(): ChaseContext {
    const bolt = this.chasers.find((c) => c.kind === 'bolt')!;
    return {
      maze: this.maze,
      mode: this.mode,
      heroTile: tileOf(this.hero),
      heroFacing: this.hero.facing,
      boltTile: tileOf(bolt),
      enraged: this.rageLevel() > 0,
      rng: this.rng,
    };
  }

  /** 0 = calm, 1 or 2 = the lead chaser speeds up as pellets run out. */
  rageLevel(): number {
    const left = this.remainingPellets();
    if (left <= this.config.rageDots / 2) return 2;
    if (left <= this.config.rageDots) return 1;
    return 0;
  }

  chaserSpeed(c: Chaser): number {
    const cfg = this.config;
    if (c.state === 'eaten' || c.state === 'entering') return BASE_SPEED * 1.8;
    if (c.state === 'house' || c.state === 'leaving') return BASE_SPEED * 0.45;
    if (c.frightened) return cfg.chaserFrightSpeed;
    if (isTunnel(this.maze, Math.round(c.x), Math.round(c.y))) return cfg.chaserTunnelSpeed;
    if (c.kind === 'bolt') return cfg.chaserSpeed + this.rageLevel() * 0.05 * BASE_SPEED;
    return cfg.chaserSpeed;
  }

  private eatAtHero(): void {
    const tile = tileOf(this.hero);
    if (tile.x < 0 || tile.x >= this.maze.width) return;
    const key = pelletKey(this.maze, tile.x, tile.y);
    const p = this.player;

    if (!p.eaten.has(key) && (this.maze.pellets.has(key) || this.maze.powerPellets.has(key))) {
      p.eaten.add(key);
      p.levelDots += 1;
      this.roundDots += 1;
      this.idleTimer = 0;
      if (this.maze.powerPellets.has(key)) {
        this.addScore(POWER_POINTS);
        this.energize();
      } else {
        this.addScore(PELLET_POINTS);
        this.events.push('chomp');
      }
      if ((BONUS_DOTS as readonly number[]).includes(p.levelDots)) {
        this.bonus = { kind: this.config.bonus, pos: this.bonusPosition(), timer: 9.5 };
      }
      this.releaseByDots();
      if (this.remainingPellets() === 0) {
        this.phase = 'levelClear';
        this.phaseTimer = PHASE_DURATION.levelClear;
        this.events.push('levelClear');
        return;
      }
    }

    if (this.bonus && tile.x === this.bonus.pos.x && tile.y === this.bonus.pos.y) {
      const points = BONUS_POINTS[this.bonus.kind];
      this.addScore(points);
      this.popups.push({ x: tile.x, y: tile.y, text: String(points), timer: 2 });
      this.bonus = null;
      this.events.push('bonus');
    }
  }

  private energize(): void {
    this.events.push('power');
    this.combo = 0;
    this.chasers.forEach(reverseChaser);
    if (this.config.frightSeconds <= 0) return;
    this.frightTimer = this.config.frightSeconds;
    for (const c of this.chasers) {
      if (c.state !== 'eaten' && c.state !== 'entering') c.frightened = true;
    }
  }

  private nextInHouse(): Chaser | undefined {
    for (const kind of RELEASE_ORDER) {
      const c = this.chasers.find((ch) => ch.kind === kind);
      if (c && c.state === 'house') return c;
    }
    return undefined;
  }

  private releaseByDots(): void {
    let next = this.nextInHouse();
    while (next) {
      const ready = this.useGlobalRelease
        ? this.roundDots >= GLOBAL_RELEASE_DOTS[next.kind]
        : this.player.levelDots >= personalReleaseDots(this.player.level, next.kind);
      if (!ready) return;
      releaseChaser(next);
      next = this.nextInHouse();
    }
  }

  private checkCollisions(): void {
    for (const c of this.chasers) {
      if (c.state !== 'active') continue;
      if (Math.abs(c.x - this.hero.x) > 0.6 || Math.abs(c.y - this.hero.y) > 0.6) continue;
      if (c.frightened) {
        this.combo += 1;
        const points = 200 * 2 ** (this.combo - 1);
        this.addScore(points);
        c.state = 'eaten';
        c.frightened = false;
        this.popups.push({ x: c.x, y: c.y, text: String(points), timer: 1.2 });
        this.events.push('eatChaser');
        this.phase = 'eatPause';
        this.phaseTimer = PHASE_DURATION.eatPause;
        return;
      }
      this.phase = 'dying';
      this.phaseTimer = PHASE_DURATION.dying;
      this.bonus = null;
      this.events.push('death');
      return;
    }
  }

  private addScore(points: number): void {
    const p = this.player;
    p.score += points;
    if (!p.extraLifeGiven && p.score >= EXTRA_LIFE_SCORE) {
      p.extraLifeGiven = true;
      p.lives += 1;
      this.events.push('extraLife');
    }
    if (p.score > this.highScore) this.highScore = p.score;
  }
}
