import type { Dir } from '../core/types';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
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

/** Keyboard + swipe input. Keeps the last requested direction (arcade-style buffering). */
export class Input {
  private dir: Dir = 'none';
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
        this.dir = d;
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
        this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
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

  direction(): Dir {
    return this.dir;
  }

  clearDirection(): void {
    this.dir = 'none';
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
