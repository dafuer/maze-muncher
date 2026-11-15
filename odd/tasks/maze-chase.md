Objective: original browser maze-chase game (genre-similar to classic arcade maze games, no copied IP).
Branch: feat/maze-chase · Delivery: single-pr (local, user decides push/PR) · Test runner: Vitest (`npm test`).

## Specs

- S1: "quiero que programes un nuevo comecocos desde 0" — new project from scratch in `comecocos/`.
- S2: "Quiero que sea en 2D y sobre un navegador" — 2D, runs in the browser. Stack: TypeScript + Vite + Canvas 2D + Web Audio, Vitest for logic.
- S3: "Tiene que poder jugar 1 o dos personas" + "a dos jugadores quiero que salgan dos pacman a la vez y se pueda jugar a la vez las dos personas." — 1 or 2 players; in 2-player mode both heroes are on screen at the same time (simultaneous co-op): P1 arrows/swipe, P2 WASD, shared maze and level, separate score and lives, chasers target the nearest hero; a catch costs that player a life and restarts the round; a player with no lives is out; game over when both are out. (Assumptions: control keys, co-op rules.)
- S4: "tiene que haber varias pantallas segun las vamos pasando" + "a dos jugadores nos hemos pasado la primera pantalla pero luego a vuelto a ponernos el siguiente nivel. no hemos dicho que ibamos a tener varios niveles?" — every cleared level loads a different maze (rotating Neon Grid → Candy Circuit → Ember Forge → …) and a visible "LEVEL N" banner announces the new level.
- S5: "Lo más similar al juego original posible" — same genre mechanics: pellets, power pellets, 4 chasers with distinct targeting (chase/ambush/flank/shy), scatter/chase schedule, frightened mode with combo scoring, ghost house + release, side tunnel, bonus items, extra life, lives, level speed/fright scaling, ready/death/level-clear/game-over screens, high score. Assumption: original names, characters, mazes, art and sounds (no recreation of a specific existing game's IP).
- S6: "de manera autonoma sin pedir permiso hasta el final (una versión jugable)" — deliver a playable version before asking anything.

## Tasks

- T1 [S1,S2,S4] Scaffold + maze model + 3 original mazes with validity tests — inline — done (17 tests green; RED: dead-end test caught 6 dead ends in Ember Forge)
- T2 [S5] Movement + hero control (buffered turns, tunnel wrap) — inline — done (5 hero tests green)
- T3 [S5] Chaser AI + state machine (house, leaving, scatter/chase, frightened, eaten) — inline — done (14 chaser/level tests green)
- T4 [S3,S4,S5] Game session: scoring, levels, bonus, lives, 2-player turns — inline — done (11 game tests green, incl. 2-player alternation)
- T5 [S2,S5,S6] Renderer, audio, input, screens, app loop — inline — done (build ok; browser smoke: title, 2P start, movement, death, level clear → Candy Circuit, level 6 → Ember Forge, fright; no console errors)
- T6 [S6] README + final verification (build, tests, browser smoke) — inline — done (README; 47 tests, tsc, build green)

- T7 [S3] Simultaneous 2-player mode (replaces alternating turns) — inline — done (RED: 15 failing → GREEN 53/53; browser smoke: two heroes, independent arrows/WASD control, P2 death only cost P2 a life)
- T8 [S4] Maze changes on every level + level banner — inline — done (RED 4 failing → GREEN 55/55; browser: 2P level 1 clear → LEVEL 2 Candy Circuit banner)
- T9 [S5] One-tile-wide corridors in every maze — inline — done (RED 2 failing → GREEN 58/58; browser: Candy Circuit single corridor above house)

## Log

- L1 (2026-11-14) User request verbatim: "quiero que programes un nuevo comecocos desde 0. Quiero que uses gentle-ai pero quiero que lo hagas de manera autonoma sin pedir permiso hasta el final (una versión jugable). Quiero que sea en 2D y sobre un navegador: ¿qué tecnología y librerías propones? Tiene que poder jugar 1 o dos personas. Además tiene que haber varias pantallas segun las vamos pasando. Lo más similar al juego original posible."
- L2 Decision: no game engine; pure core logic in `src/core` (testable, deterministic RNG injected), rendering/audio/input adapters around it.
- L3 Verification: `npm test` 47/47, `tsc --noEmit` clean, `vite build` ok; manual browser smoke via Chrome on dev server. Not covered by automated tests: rendering, audio, input (manual only).
- L4 (2026-11-14) User correction verbatim: "a dos jugadores quiero que salgan dos pacman a la vez y se pueda jugar a la vez las dos personas." → S3 rewritten, T7 opened.
- L5 (2026-11-14) User correction verbatim: "a dos jugadores nos hemos pasado la primera pantalla pero luego a vuelto a ponernos el siguiente nivel. no hemos dicho que ibamos a tener varios niveles?" Verified: mazeIndexForLevel(2) returned 0 (same maze for levels 1-2 by design). S4 rewritten, T8 opened.
- L6 (2026-11-14) User correction verbatim: "en el laberinto dos, hay caminos que tienen dos lineas de puntitos. Eso no era así en el juego original. Por cada camino solo tienes una linea de premios. ¿puedes revisar los mapas originales y hacerlo lo más parecido a ellos que sea posible?" Verified: rows 10-11 above the house were parallel corridors in Candy Circuit and Ember Forge. Decision: enforce 1-wide corridors; original layouts are not copied (no recreation of the specific game's levels).
