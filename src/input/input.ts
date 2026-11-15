import type { Dir } from '../core/types';

/** Arrow keys drive player one, WASD drives player two. */
const KEY_DIRS: Record<string, { player: 0 | 1; dir: Dir }> = {
  ArrowUp: { player: 0, dir: 'up' },
  ArrowDown: { player: 0, dir: 'down' },
  ArrowLeft: { player: 0, dir: 'left' },
  ArrowRight: { player: 0, dir: 'right' },
  KeyW: { player: 1, dir: 'up' },
  KeyS: { player: 1, dir: 'down' },
  KeyA: { player: 1, dir: 'left' },
  KeyD: { player: 1, dir: 'right' },
};

export type Command = 'start1' | 'start2' | 'pause' | 'mute' | 'back';

const KEY_COMMANDS: Record<string, Command> = {
  Digit1: 'start1',
  Numpad1: 'start1',
  Enter: 'start1',
  Digit2: 'start2',
  Numpad2: 'start2',
  KeyP: 'pause',
  Escape: 'back',
  KeyM: 'mute',
};

/**
 * Keyboard + swipe input. Keeps the last requested direction per player
 * (arcade-style buffering). Swipes control player one.
 */
export class Input {
  private dirs: [Dir, Dir] = ['none', 'none'];
  private lastAny: Dir = 'none';
  private commands: Command[] = [];
  private touchStart: { x: number; y: number } | null = null;
  /** Called on the first user gesture (needed to unlock audio). */
  onGesture: () => void = () => {};
  /** Taps in canvas-normalized coordinates (0..1). */
  onTap: (x: number, y: number) => void = () => {};

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      this.onGesture();
      const d = KEY_DIRS[e.code];
      if (d) {
        this.setDir(d.player, d.dir);
        e.preventDefault();
        return;
      }
      const c = KEY_COMMANDS[e.code];
      if (c && !e.repeat) {
        this.commands.push(c);
        e.preventDefault();
      }
    });

    target.addEventListener(
      'touchstart',
      (e) => {
        this.onGesture();
        const t = e.changedTouches[0];
        this.touchStart = { x: t.clientX, y: t.clientY };
        e.preventDefault();
      },
      { passive: false },
    );
    target.addEventListener(
      'touchend',
      (e) => {
        const t = e.changedTouches[0];
        const s = this.touchStart;
        this.touchStart = null;
        if (!s) return;
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
          this.tapAt(target, t.clientX, t.clientY);
          return;
        }
        this.setDir(0, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      },
      { passive: false },
    );
    target.addEventListener('mousedown', (e) => {
      this.onGesture();
      this.tapAt(target, e.clientX, e.clientY);
    });
  }

  private tapAt(target: HTMLElement, clientX: number, clientY: number): void {
    const r = target.getBoundingClientRect();
    this.onTap((clientX - r.left) / r.width, (clientY - r.top) / r.height);
  }

  private setDir(player: 0 | 1, dir: Dir): void {
    this.dirs[player] = dir;
    this.lastAny = dir;
  }

  /** Directions per player. With one player, arrows and WASD both drive the single hero. */
  directions(players: 1 | 2): Dir[] {
    return players === 1 ? [this.lastAny] : [...this.dirs];
  }

  clearDirections(): void {
    this.dirs = ['none', 'none'];
    this.lastAny = 'none';
  }

  pushCommand(c: Command): void {
    this.commands.push(c);
  }

  drainCommands(): Command[] {
    const out = this.commands;
    this.commands = [];
    return out;
  }
}
