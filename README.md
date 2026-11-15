# Maze Muncher

An original arcade maze-chase game for the browser, built from scratch with
TypeScript, Vite and the Canvas 2D API. Sounds are synthesized with the Web Audio API.

**Play online: https://dafuer.github.io/maze-muncher/**

## Play locally

```bash
npm install
npm run dev      # open the printed URL (default http://localhost:5173)
npm run build    # static build in dist/ (open with `npm run preview`)
npm test         # game logic tests (Vitest)
```

## Controls

| Action | Keys |
| --- | --- |
| Start 1 / 2 players | `1` / `2` (or `Enter`, or tap the buttons) |
| Move (1 player) | Arrows or `WASD` (swipe on touch screens) |
| Move (2 players) | Player 1: arrows (or swipe) · Player 2: `WASD` |
| Pause | `P` (`Esc` pauses; `Esc` again while paused returns to the title) |
| Sound on/off | `M` |

In 2-player mode both heroes are in the maze at the same time (co-op). Pellets
and level are shared; each player has their own score and lives. Drones hunt
whichever hero is closest. When a hero is caught that player loses a life and the
round restarts for both (eaten pellets stay eaten). A player with no lives left is
out and the other keeps playing; the game ends when both are out.

## Rules

- Eat every pellet (10 pts) to clear the stage. Power pellets (50 pts) make the
  drones vulnerable: eat them for 200, 400, 800 and 1600 pts.
- Bonus items appear below the house after 70 and 170 pellets.
- Extra life at 10,000 pts. You start with 3 lives.
- Side tunnels wrap around and slow the drones down.
- Every cleared level loads a new maze (Neon Grid → Candy Circuit → Ember Forge →
  and around again), and each level is faster with shorter power time.

### The drones

Drones alternate between *scatter* (each retreats to its corner) and *chase*:

- **BOLT** (red) hunts you directly and speeds up when few pellets are left.
- **ZAP** (purple) aims four tiles ahead of you.
- **FLUX** (blue) flanks you, using BOLT's position as a pivot.
- **GLITCH** (amber) chases you from far away but runs off when it gets close.

## Architecture

```
src/core     pure, deterministic game logic (no DOM): mazes, movement, AI, session
src/render   Canvas 2D renderer and procedural sprites
src/audio    Web Audio synthesizer
src/input    keyboard / touch input
src/app      entry point: screens, fixed-timestep loop, high score storage
tests        Vitest specs for the core
```

The core runs at a fixed 60 Hz step and exposes state plus events; the app layer
draws that state and turns events into sound.

## Deployment

`.github/workflows/deploy.yml` runs the tests, builds the game and publishes
`dist/` to GitHub Pages:

- on every push to `main`;
- every 10 minutes as a fallback: it compares the commit on `main` with the
  `version.txt` of the live site and deploys only when they differ;
- by hand from the Actions tab ("Run workflow") or with `gh workflow run deploy.yml`.

## License

Code: [MIT](LICENSE) © 2026 David Fuertes.

Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38,
licensed under the SIL Open Font License 1.1 (`src/assets/fonts/OFL.txt`). It is
self-hosted, so the game makes no requests to third-party servers.
