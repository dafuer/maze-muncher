import type { Game, GameEvent } from '../core/game';

type Wave = OscillatorType;

interface Note {
  freq: number;
  dur: number;
}

/** Original intro tune (frequencies in Hz, durations in seconds). */
const INTRO: Note[] = [
  [523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.24], [0, 0.06],
  [988, 0.12], [784, 0.12], [659, 0.24], [0, 0.06],
  [587, 0.12], [698, 0.12], [880, 0.12], [1175, 0.24], [0, 0.06],
  [1047, 0.12], [880, 0.12], [698, 0.24], [0, 0.06],
  [659, 0.1], [784, 0.1], [988, 0.1], [1319, 0.1], [1568, 0.4],
].map(([freq, dur]) => ({ freq, dur }));

const LEVEL_CLEAR: Note[] = [
  [784, 0.08], [988, 0.08], [1175, 0.08], [1568, 0.2],
].map(([freq, dur]) => ({ freq, dur }));

/**
 * Procedural arcade-style sound effects with the Web Audio API.
 * No audio files: every sound is synthesized.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private loopOsc: OscillatorNode | null = null;
  private loopGain: GainNode | null = null;
  private chompToggle = false;
  private lastChomp = 0;
  muted = false;

  /** Must be called from a user gesture so the browser allows audio. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.25;
      this.master.connect(this.ctx.destination);

      this.loopOsc = this.ctx.createOscillator();
      this.loopGain = this.ctx.createGain();
      this.loopGain.gain.value = 0;
      this.loopOsc.connect(this.loopGain).connect(this.master);
      this.loopOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.02);
    }
  }

  private tone(freq: number, start: number, dur: number, wave: Wave = 'square', vol = 0.3, endFreq?: number): void {
    if (!this.ctx || !this.master || freq <= 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private melody(notes: Note[], wave: Wave = 'square', vol = 0.18): void {
    if (!this.ctx) return;
    let t = this.ctx.currentTime + 0.05;
    for (const n of notes) {
      this.tone(n.freq, t, n.dur * 0.95, wave, vol);
      this.tone(n.freq / 2, t, n.dur * 0.95, 'triangle', vol * 0.8);
      t += n.dur;
    }
  }

  play(event: GameEvent): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    switch (event) {
      case 'intro':
        this.melody(INTRO);
        break;
      case 'chomp':
        if (now - this.lastChomp < 0.05) return;
        this.lastChomp = now;
        this.chompToggle = !this.chompToggle;
        this.tone(this.chompToggle ? 520 : 380, now, 0.07, 'triangle', 0.35, this.chompToggle ? 300 : 620);
        break;
      case 'power':
        this.tone(200, now, 0.25, 'square', 0.2, 800);
        break;
      case 'eatChaser':
        this.tone(200, now, 0.4, 'square', 0.25, 1600);
        break;
      case 'bonus':
        [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, now + i * 0.06, 0.08, 'square', 0.2));
        break;
      case 'extraLife':
        for (let i = 0; i < 6; i++) this.tone(1400, now + i * 0.12, 0.08, 'square', 0.18);
        break;
      case 'levelClear':
        this.melody(LEVEL_CLEAR, 'triangle', 0.25);
        break;
      case 'death':
        // Short silence, then a wobbling descent and two pops.
        for (let i = 0; i < 10; i++) {
          const f = 900 - i * 75;
          this.tone(f, now + 0.6 + i * 0.12, 0.12, 'square', 0.18, f * 0.7);
        }
        this.tone(300, now + 1.9, 0.12, 'square', 0.2, 80);
        this.tone(300, now + 2.1, 0.12, 'square', 0.2, 80);
        break;
      case 'gameOver':
        this.tone(330, now, 0.3, 'triangle', 0.25, 110);
        break;
      case 'victory':
        this.melody(LEVEL_CLEAR, 'square', 0.22);
        break;
    }
  }

  /** Updates the background loop (siren / frightened / eyes) from the game state. */
  updateLoop(game: Game | null, paused: boolean): void {
    if (!this.ctx || !this.loopOsc || !this.loopGain) return;
    const now = this.ctx.currentTime;
    const active = game && !paused && game.phase === 'playing';
    if (!active) {
      this.loopGain.gain.setTargetAtTime(0, now, 0.02);
      return;
    }
    const t = game.clock;
    const eyes = game.chasers.some((c) => c.state === 'eaten' || c.state === 'entering');
    let freq: number;
    let vol: number;
    if (eyes) {
      this.loopOsc.type = 'sawtooth';
      freq = 700 + 500 * ((t * 8) % 1);
      vol = 0.05;
    } else if (game.frightTimer > 0) {
      this.loopOsc.type = 'square';
      freq = 180 + 90 * Math.abs(Math.sin(t * 18));
      vol = 0.05;
    } else {
      this.loopOsc.type = 'triangle';
      const rate = 2.2 + game.rageLevel() * 0.8 + game.level * 0.05;
      const phase = (t * rate) % 1;
      freq = 380 + 260 * (phase < 0.5 ? phase * 2 : 2 - phase * 2);
      vol = 0.08;
    }
    this.loopOsc.frequency.setTargetAtTime(freq, now, 0.01);
    this.loopGain.gain.setTargetAtTime(vol, now, 0.02);
  }
}
