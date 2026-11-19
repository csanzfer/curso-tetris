'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#f06292', // Ring - pink
  '#ffffff', // WILD - comodín (se dibuja con degradado, este color no se usa)
  '#546e7a', // BOMB - gris azulado
  '#fdd835', // BOLT - amarillo eléctrico
  '#ec407a', // DYE - magenta
  '#8d6e63', // GRAVITY - marrón
  '#4fc3f7', // FREEZE - celeste
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Ring (3x3, hueco central)
  null,                                        // WILD - solo existe en el tablero
  [[10]],                                      // BOMB (1x1)
  [[11]],                                      // BOLT
  [[12]],                                      // DYE
  [[13]],                                      // GRAVITY
  [[14]],                                      // FREEZE
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const RING = 8;          // tipo especial: rueda 3x3 con hueco central
const RING_CHANCE = 0.10; // probabilidad de que salga una rueda en cada spawn

const WILD = 9;          // comodín: bloque sin color, creado por el Tinte
const BOMB = 10;
const BOLT = 11;
const DYE = 12;
const GRAVITY = 13;
const FREEZE = 14;
const SPECIALS = [BOMB, BOLT, DYE, GRAVITY, FREEZE]; // piezas con efecto al bloquearse
const SPECIAL_GLYPHS = { [BOMB]: '💣', [BOLT]: '⚡', [DYE]: '🎨', [GRAVITY]: '⬇', [FREEZE]: '❄' };
const SPECIAL_EVERY = 5; // una pieza especial cada N líneas
const FREEZE_MS = 5000;  // duración del efecto Congelar
const WILD_BONUS = 50;   // puntos extra por cada comodín dentro de una línea eliminada

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let specialsGiven, pendingSpecial, freezeLeft;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  let type;
  if (pendingSpecial) {
    pendingSpecial = false;
    type = SPECIALS[Math.floor(Math.random() * SPECIALS.length)];
  } else {
    type = Math.random() < RING_CHANCE ? RING : Math.floor(Math.random() * 7) + 1;
  }
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Efectos de las piezas especiales. (x, y) es la celda donde aterrizó la pieza.
function applyEffect({ type, x, y }) {
  switch (type) {
    case BOMB:
      for (let r = y - 1; r <= y + 1; r++)
        for (let c = x - 1; c <= x + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      break;
    case BOLT:
      if (Math.random() < 0.5) {
        board[y].fill(0);
      } else {
        for (let r = 0; r < ROWS; r++) board[r][x] = 0;
      }
      break;
    case DYE: {
      const counts = new Array(9).fill(0);
      for (const row of board)
        for (const v of row)
          if (v >= 1 && v <= 8) counts[v]++;
      let best = 0;
      for (let t = 1; t <= 8; t++)
        if (counts[t] > counts[best]) best = t;
      if (best)
        for (const row of board)
          for (let c = 0; c < COLS; c++)
            if (row[c] === best) row[c] = WILD;
      break;
    }
    case GRAVITY:
      for (let c = 0; c < COLS; c++) {
        const column = [];
        for (let r = ROWS - 1; r >= 0; r--)
          if (board[r][c]) column.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--)
          board[r][c] = column[ROWS - 1 - r] || 0;
      }
      break;
    case FREEZE:
      freezeLeft = FREEZE_MS;
      break;
  }
}

function clearLines() {
  let cleared = 0;
  let wildBonus = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      wildBonus += board[r].filter(v => v === WILD).length * WILD_BONUS;
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level + wildBonus;
    const milestone = Math.floor(lines / SPECIAL_EVERY);
    if (milestone > specialsGiven) {
      specialsGiven = milestone;
      pendingSpecial = true;
    }
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (SPECIALS.includes(current.type)) applyEffect(current);
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function updateStatus() {
  statusEl.textContent = freezeLeft > 0
    ? `❄ Congelado ${Math.ceil(freezeLeft / 1000)}s`
    : '';
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.globalAlpha = alpha ?? 1;
  if (colorIndex === WILD) {
    const grad = context.createLinearGradient(px, py, px + s, py + s);
    grad.addColorStop(0, '#ff5f6d');
    grad.addColorStop(0.25, '#ffc371');
    grad.addColorStop(0.5, '#47e891');
    grad.addColorStop(0.75, '#4facfe');
    grad.addColorStop(1, '#b06ab3');
    context.fillStyle = grad;
  } else {
    context.fillStyle = COLORS[colorIndex];
  }
  context.fillRect(px, py, s, s);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, s, 4);
  // icono de las piezas especiales
  if (colorIndex >= BOMB) {
    context.fillStyle = '#ffffff';
    context.font = `${Math.floor(s * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(SPECIAL_GLYPHS[colorIndex], px + s / 2, py + s / 2);
    context.textAlign = 'start';
    context.textBaseline = 'alphabetic';
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  // tinte azulado mientras está congelado
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(120,200,255,0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    updateStatus();
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  specialsGiven = 0;
  pendingSpecial = false;
  freezeLeft = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  updateStatus();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
