Objective: original browser maze-chase game (genre-similar to classic arcade maze games, no copied IP).
Branch: feat/maze-chase · Delivery: single-pr (local, user decides push/PR) · Test runner: Vitest (`npm test`).

## Specs

- S1: "quiero que programes un nuevo comecocos desde 0" — new project from scratch in `comecocos/`.
- S2: "Quiero que sea en 2D y sobre un navegador" — 2D, runs in the browser. Stack: TypeScript + Vite + Canvas 2D + Web Audio, Vitest for logic.
- S3: "Tiene que poder jugar 1 o dos personas" — 1 or 2 players (alternating turns, arcade style; separate score, lives, level and pellet state).
- S4: "tiene que haber varias pantallas segun las vamos pasando" — multiple levels and several distinct mazes that rotate as levels are cleared.
- S5: "Lo más similar al juego original posible" — same genre mechanics: pellets, power pellets, 4 chasers with distinct targeting (chase/ambush/flank/shy), scatter/chase schedule, frightened mode with combo scoring, ghost house + release, side tunnel, bonus items, extra life, lives, level speed/fright scaling, ready/death/level-clear/game-over screens, high score. Assumption: original names, characters, mazes, art and sounds (no recreation of a specific existing game's IP).
- S6: "de manera autonoma sin pedir permiso hasta el final (una versión jugable)" — deliver a playable version before asking anything.

## Tasks

- T1 [S1,S2,S4] Scaffold + maze model + 3 original mazes with validity tests — inline — done (17 tests green; RED: dead-end test caught 6 dead ends in Ember Forge)
- T2 [S5] Movement + hero control (buffered turns, tunnel wrap) — inline — pending
- T3 [S5] Chaser AI + state machine (house, leaving, scatter/chase, frightened, eaten) — inline — pending
- T4 [S3,S4,S5] Game session: scoring, levels, bonus, lives, 2-player turns — inline — pending
- T5 [S2,S5,S6] Renderer, audio, input, screens, app loop — inline — pending
- T6 [S6] README + final verification (build, tests, browser smoke) — inline — pending

## Log

- L1 (2026-11-14) User request verbatim: "quiero que programes un nuevo comecocos desde 0. Quiero que uses gentle-ai pero quiero que lo hagas de manera autonoma sin pedir permiso hasta el final (una versión jugable). Quiero que sea en 2D y sobre un navegador: ¿qué tecnología y librerías propones? Tiene que poder jugar 1 o dos personas. Además tiene que haber varias pantallas segun las vamos pasando. Lo más similar al juego original posible."
- L2 Decision: no game engine; pure core logic in `src/core` (testable, deterministic RNG injected), rendering/audio/input adapters around it.
