import './fonts.css';
import { Sound } from '../audio/sound';
import { Game } from '../core/game';
import { Input, type Command } from '../input/input';
import { Renderer, TITLE_BUTTONS } from '../render/renderer';
import { loadHighScore, saveHighScore } from './highscore';

const STEP = 1 / 60;
const GAME_OVER_HOLD = 4;
const VICTORY_HOLD = 14;

type Screen = 'title' | 'game';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new Sound();

let screen: Screen = 'title';
let game: Game | null = null;
let paused = false;
let highScore = loadHighScore();
let titleClock = 0;
let gameOverTimer = 0;
let lastPhase = '';

input.onGesture = () => sound.unlock();
input.onTap = (x, y) => {
  if (screen !== 'title') {
    if (screen === 'game' && paused) input.pushCommand('pause');
    return;
  }
  const inside = (b: { x0: number; x1: number; y0: number; y1: number }) =>
    x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  if (inside(TITLE_BUTTONS.one)) input.pushCommand('start1');
  else if (inside(TITLE_BUTTONS.two)) input.pushCommand('start2');
};

function startGame(players: 1 | 2): void {
  game = new Game(players, { highScore });
  screen = 'game';
  paused = false;
  gameOverTimer = 0;
  input.clearDirections();
}

function backToTitle(): void {
  if (game) {
    highScore = Math.max(highScore, game.highScore);
    saveHighScore(highScore);
  }
  game = null;
  screen = 'title';
  paused = false;
}

function handleCommand(c: Command): void {
  if (c === 'mute') {
    sound.toggleMute();
    return;
  }
  if (screen === 'title') {
    if (c === 'start1') startGame(1);
    if (c === 'start2') startGame(2);
    return;
  }
  if (c === 'pause') paused = !paused;
  if (c === 'back') {
    if (paused) backToTitle();
    else paused = true;
  }
}

function step(): void {
  for (const c of input.drainCommands()) handleCommand(c);

  if (screen === 'title' || !game) {
    titleClock += STEP;
    return;
  }
  if (paused) return;

  game.update(STEP, input.directions(game.players.length as 1 | 2));
  for (const e of game.drainEvents()) sound.play(e);

  // Forget the held direction whenever a new round is about to start.
  if (game.phase === 'ready' && lastPhase !== 'ready') input.clearDirections();
  lastPhase = game.phase;

  if (game.phase === 'gameOver' || game.phase === 'victory') {
    gameOverTimer += STEP;
    if (gameOverTimer >= (game.phase === 'victory' ? VICTORY_HOLD : GAME_OVER_HOLD)) backToTitle();
  }
}

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    step();
    acc -= STEP;
  }
  if (screen === 'game' && game) renderer.drawGame(game, paused, sound.muted);
  else renderer.drawTitle({ highScore, clock: titleClock, muted: sound.muted });
  sound.updateLoop(screen === 'game' ? game : null, paused);
  requestAnimationFrame(frame);
}

// Pause automatically when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'game') paused = true;
});

void document.fonts?.load('16px "Press Start 2P"').then(() => renderer.fit());
requestAnimationFrame(frame);

// Development-only hook for debugging in the browser console.
if (import.meta.env.DEV) {
  (window as unknown as { __muncher: unknown }).__muncher = { get game() { return game; } };
}
