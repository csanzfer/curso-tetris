# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no build step, package manager, linter, or test suite. Nothing needs to be installed.

- Run the game: open `index.html` directly, or serve the folder statically (`python3 -m http.server 8000`, then visit `http://localhost:8000`). Serving is optional; the game works from `file://`.
- Verification is manual: load the page in a browser and play. There are no automated tests, so there is no "run a single test" command.

## Architecture

The game is three plain files with no modules and no bundler:

- `index.html` defines the DOM: a 300×600 `<canvas id="board">` for the playfield, a 120×120 `<canvas id="next-canvas">` for the preview, HUD spans (`score`, `lines`, `level`), and the pause/game-over overlay. `game.js` is loaded at the end of `<body>` as a classic script.
- `style.css` is the dark theme. It has no layout logic that the JS depends on.
- `game.js` holds all game logic in top-level globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `lastTime`, `animId`). It runs in strict mode and calls `init()` at the bottom.

Key relationships inside `game.js` that span multiple functions:

- **Piece type doubles as color index.** `PIECES[t]` and `COLORS[t]` are aligned for `t` in 1–7, and the board stores `t` (0 = empty). Adding or reordering a piece means keeping both arrays in sync.
- **Lock sequence.** `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current`, rolls a new `next`, and calls `endGame()` if the new piece collides. `endGame()` cancels the animation frame, so the loop stops there.
- **Gravity loop.** `loop(ts)` accumulates `dt` into `dropAccum` and moves the piece down one row when it reaches `dropInterval`, otherwise calling `lockPiece()`. `draw()` clears and redraws the whole canvas every frame; there is no dirty tracking.
- **Speed and score both live in `clearLines()`.** It updates `lines`, adds `LINE_SCORES[n] * level`, then recomputes `level` and `dropInterval`. The score uses the level from before the update.
- **Pause and resume.** `togglePause()` cancels the frame loop on pause and calls `loop()` directly on resume. Only `P` works while paused or after game over; other keys are ignored there.
- **Reset.** `init()` is the only reset path, used at startup and by the restart button. Any new piece of state must be initialized there too.
- **Input.** A single `keydown` listener on `document` dispatches on `e.code`. It calls `updateHUD()` after each key.
- **Canvas sizes are hard-coded in two places.** `index.html` uses 300×600, which must equal `COLS×BLOCK` by `ROWS×BLOCK`. `drawNext()` assumes a 4×4 preview grid with its own `NB = 30`. Changing `COLS`, `ROWS`, or `BLOCK` means editing `index.html` as well.

## Language

The README and all user-visible strings (HUD labels, controls panel, overlay text) are in Spanish. Code identifiers and most comments are in English. Keep UI text in Spanish unless asked otherwise.
