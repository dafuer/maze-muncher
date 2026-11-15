import type { Chaser } from '../core/chaser';
import { CHASER_INFO } from '../core/chaser';
import type { BonusKind } from '../core/levels';
import { DIR_VECTORS, type Dir } from '../core/types';

export const HERO_COLOR = '#a6ff3d';
const FRIGHT_COLOR = '#3a3f8f';
const FRIGHT_FLASH = '#e8e8ff';

const ANGLES: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, none: Math.PI };

/** The hero: a round muncher with a big eye and a chomping mouth. */
export function drawHero(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  facing: Dir,
  mouth: number,
): void {
  const angle = ANGLES[facing];
  const open = 0.05 + mouth * 0.75;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  // Mirror when facing left so the eye stays on top.
  if (facing === 'left') ctx.scale(1, -1);

  ctx.fillStyle = HERO_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, open, Math.PI * 2 - open);
  ctx.closePath();
  ctx.fill();

  // Cheek shading.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(-r * 0.1, r * 0.25, r * 0.6, 0.2, Math.PI - 0.2);
  ctx.fill();

  // Eye.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(r * 0.1, -r * 0.5, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(r * 0.18, -r * 0.5, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Death animation: the hero spins and pops into sparks. `t` goes from 0 to 1. */
export function drawHeroDeath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number): void {
  if (t < 0.75) {
    const k = t / 0.75;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(k * Math.PI * 4);
    ctx.fillStyle = HERO_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const open = 0.05 + k * (Math.PI - 0.05);
    ctx.arc(0, 0, r * (1 - k * 0.4), open, Math.PI * 2 - open);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const k = (t - 0.75) / 0.25;
  ctx.strokeStyle = HERO_COLOR;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const d0 = r * (0.3 + k * 0.8);
    const d1 = r * (0.6 + k * 1.1);
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
    ctx.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawVisor(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: Dir, color: string): void {
  const v = DIR_VECTORS[dir];
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + v.x * r * 0.25, y + v.y * r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Chasers are little hover-drones: a dome with one big visor eye, an antenna,
 * and three thruster legs.
 */
export function drawChaser(
  ctx: CanvasRenderingContext2D,
  ch: Chaser,
  cx: number,
  cy: number,
  r: number,
  clock: number,
  frightTimer: number,
): void {
  const info = CHASER_INFO[ch.kind];
  const eyesOnly = ch.state === 'eaten' || ch.state === 'entering';
  const frightened = ch.frightened && !eyesOnly;
  const flashing = frightened && frightTimer < 2 && Math.floor(clock * 6) % 2 === 0;
  const body = frightened ? (flashing ? FRIGHT_FLASH : FRIGHT_COLOR) : info.color;
  const hover = Math.sin(clock * 6 + ch.homeX) * r * 0.08;
  const y = cy + hover;

  if (!eyesOnly) {
    // Antenna.
    ctx.strokeStyle = body;
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx, y - r * 0.8);
    ctx.lineTo(cx + r * 0.2, y - r * 1.15);
    ctx.stroke();
    ctx.fillStyle = Math.floor(clock * 3) % 2 === 0 ? '#fff' : body;
    ctx.beginPath();
    ctx.arc(cx + r * 0.2, y - r * 1.15, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Dome + body.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, y - r * 0.05, r * 0.85, Math.PI, 0);
    ctx.lineTo(cx + r * 0.85, y + r * 0.45);
    ctx.lineTo(cx - r * 0.85, y + r * 0.45);
    ctx.closePath();
    ctx.fill();

    // Thruster legs (animated).
    const step = Math.floor(clock * 10) % 2;
    for (let i = -1; i <= 1; i++) {
      const lx = cx + i * r * 0.55;
      const len = r * (0.32 + (((i + step) & 1) === 0 ? 0.12 : 0));
      ctx.fillRect(lx - r * 0.14, y + r * 0.45, r * 0.28, len);
    }
    // Band.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - r * 0.85, y + r * 0.2, r * 1.7, r * 0.12);
  }

  if (frightened) {
    // Scared face: two small eyes and a zigzag mouth.
    const face = flashing ? '#d22' : '#ffd0d0';
    ctx.fillStyle = face;
    ctx.fillRect(cx - r * 0.38, y - r * 0.35, r * 0.2, r * 0.2);
    ctx.fillRect(cx + r * 0.18, y - r * 0.35, r * 0.2, r * 0.2);
    ctx.strokeStyle = face;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const px = cx - r * 0.55 + (i * r * 1.1) / 6;
      const py = y + r * 0.05 + (i % 2 === 0 ? 0 : -r * 0.12);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    return;
  }

  drawVisor(ctx, cx, y - r * 0.2, r, ch.dir, eyesOnly ? '#2266ff' : '#1a1a40');
}

/** Bonus items, drawn procedurally. */
export function drawBonus(ctx: CanvasRenderingContext2D, kind: BonusKind, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  switch (kind) {
    case 'apple':
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.arc(-r * 0.3, r * 0.1, r * 0.6, 0, Math.PI * 2);
      ctx.arc(r * 0.3, r * 0.1, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4c2';
      ctx.beginPath();
      ctx.ellipse(r * 0.25, -r * 0.65, r * 0.35, r * 0.15, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'donut':
      ctx.strokeStyle = '#f7a';
      ctx.lineWidth = r * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillRect(Math.cos(a) * r * 0.6 - 1, Math.sin(a) * r * 0.6 - 1, 3, 3);
      }
      break;
    case 'cupcake':
      ctx.fillStyle = '#c84';
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 0);
      ctx.lineTo(r * 0.6, 0);
      ctx.lineTo(r * 0.4, r * 0.8);
      ctx.lineTo(-r * 0.4, r * 0.8);
      ctx.fill();
      ctx.fillStyle = '#fdf';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f24';
      ctx.beginPath();
      ctx.arc(0, -r * 0.7, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'gem':
      ctx.fillStyle = '#3ef';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(r * 0.7, -r * 0.2);
      ctx.lineTo(0, r * 0.85);
      ctx.lineTo(-r * 0.7, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(r * 0.25, -r * 0.2);
      ctx.lineTo(-r * 0.25, -r * 0.2);
      ctx.fill();
      break;
    case 'star':
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r * 0.9 : r * 0.4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = '#fc3';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, r * 0.5);
      ctx.lineTo(-r * 0.8, -r * 0.5);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(0, -r * 0.7);
      ctx.lineTo(r * 0.4, 0);
      ctx.lineTo(r * 0.8, -r * 0.5);
      ctx.lineTo(r * 0.8, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e24';
      ctx.fillRect(-r * 0.15, r * 0.1, r * 0.3, r * 0.25);
      break;
    case 'rocket':
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.35, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e33';
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, r * 0.3);
      ctx.lineTo(-r * 0.7, r * 0.8);
      ctx.lineTo(-r * 0.2, r * 0.6);
      ctx.moveTo(r * 0.35, r * 0.3);
      ctx.lineTo(r * 0.7, r * 0.8);
      ctx.lineTo(r * 0.2, r * 0.6);
      ctx.fill();
      ctx.fillStyle = '#39f';
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'trophy':
      ctx.fillStyle = '#fd4';
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.7);
      ctx.lineTo(r * 0.6, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.6, r * 0.2, 0, r * 0.25);
      ctx.quadraticCurveTo(-r * 0.6, r * 0.2, -r * 0.6, -r * 0.7);
      ctx.fill();
      ctx.fillRect(-r * 0.12, r * 0.2, r * 0.24, r * 0.35);
      ctx.fillRect(-r * 0.45, r * 0.55, r * 0.9, r * 0.2);
      break;
  }
  ctx.restore();
}
