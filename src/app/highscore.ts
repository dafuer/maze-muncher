const KEY = 'maze-muncher.highscore';

/** Browser storage may be unavailable (private mode, blocked site data): never throw. */
export function loadHighScore(): number {
  try {
    const value = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    if (score > loadHighScore()) window.localStorage.setItem(KEY, String(score));
  } catch {
    /* ignore */
  }
}
