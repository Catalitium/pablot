const GRID_SIZE = 50;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const SAVE_KEY = "pablobot_conway_state_v1";
const GRAPH_WINDOW = 280;

const PATTERNS = {
  block: { name: "Block", cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  beehive: { name: "Beehive", cells: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 2]] },
  loaf: { name: "Loaf", cells: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 3], [3, 2]] },
  boat: { name: "Boat", cells: [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1]] },
  blinker: { name: "Blinker", cells: [[0, 0], [0, 1], [0, 2]] },
  toad: { name: "Toad", cells: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2]] },
  beacon: { name: "Beacon", cells: [[0, 0], [0, 1], [1, 0], [2, 3], [3, 2], [3, 3]] },
  glider: { name: "Glider", cells: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
  lwss: { name: "Lightweight Spaceship", cells: [[0, 1], [0, 4], [1, 0], [2, 0], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3]] },
  pulsar: {
    name: "Pulsar",
    cells: [
      [0, 2], [0, 3], [0, 4], [0, 8], [0, 9], [0, 10],
      [2, 0], [3, 0], [4, 0], [2, 5], [3, 5], [4, 5], [2, 7], [3, 7], [4, 7], [2, 12], [3, 12], [4, 12],
      [5, 2], [5, 3], [5, 4], [5, 8], [5, 9], [5, 10],
      [7, 2], [7, 3], [7, 4], [7, 8], [7, 9], [7, 10],
      [8, 0], [9, 0], [10, 0], [8, 5], [9, 5], [10, 5], [8, 7], [9, 7], [10, 7], [8, 12], [9, 12], [10, 12],
      [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10]
    ]
  },
  pentadecathlon: {
    name: "Pentadecathlon",
    cells: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 2], [3, 1], [3, 2], [4, 0], [4, 3], [5, 1], [5, 2]]
  }
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const graphCanvas = document.getElementById("graphCanvas");
const graphCtx = graphCanvas.getContext("2d");

const elements = {
  startPauseBtn: document.getElementById("startPauseBtn"),
  stepBtn: document.getElementById("stepBtn"),
  resetBtn: document.getElementById("resetBtn"),
  randomBtn: document.getElementById("randomBtn"),
  clearBtn: document.getElementById("clearBtn"),
  speedSlider: document.getElementById("speedSlider"),
  patternSelect: document.getElementById("patternSelect"),
  loadPatternBtn: document.getElementById("loadPatternBtn"),
  saveBtn: document.getElementById("saveBtn"),
  restoreBtn: document.getElementById("restoreBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importInput: document.getElementById("importInput"),
  generation: document.getElementById("generation"),
  population: document.getElementById("population"),
  maxPopulation: document.getElementById("maxPopulation"),
  growthRate: document.getElementById("growthRate"),
  runStatus: document.getElementById("runStatus")
};

let grid = new Uint8Array(TOTAL_CELLS);
let generation = 0;
let populationHistory = [];
let isRunning = false;
let timerId = null;
let paintValue = 1;
let isPainting = false;
let cellSize = 1;

function index(row, col) {
  return row * GRID_SIZE + col;
}

function getCell(row, col) {
  const wrappedRow = (row + GRID_SIZE) % GRID_SIZE;
  const wrappedCol = (col + GRID_SIZE) % GRID_SIZE;
  return grid[index(wrappedRow, wrappedCol)];
}

function countNeighbors(row, col) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr !== 0 || dc !== 0) count += getCell(row + dr, col + dc);
    }
  }
  return count;
}

function nextGeneration() {
  const next = new Uint8Array(TOTAL_CELLS);
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const alive = grid[index(row, col)] === 1;
      const neighbors = countNeighbors(row, col);
      next[index(row, col)] = alive ? Number(neighbors === 2 || neighbors === 3) : Number(neighbors === 3);
    }
  }
  grid = next;
  generation++;
  recordPopulation();
  if (generation % 5 === 0) saveState(false);
  render();
}

function currentPopulation() {
  let total = 0;
  for (let i = 0; i < grid.length; i++) total += grid[i];
  return total;
}

function recordPopulation() {
  populationHistory.push(currentPopulation());
}

function resetHistory() {
  populationHistory = [currentPopulation()];
}

function clearGrid() {
  stop();
  grid = new Uint8Array(TOTAL_CELLS);
  generation = 0;
  resetHistory();
  render();
}

function randomize() {
  stop();
  grid = new Uint8Array(TOTAL_CELLS);
  for (let i = 0; i < TOTAL_CELLS; i++) {
    grid[i] = Math.random() > 0.72 ? 1 : 0;
  }
  generation = 0;
  resetHistory();
  render();
}

function loadPattern(key = elements.patternSelect.value) {
  stop();
  grid = new Uint8Array(TOTAL_CELLS);
  const pattern = PATTERNS[key] || PATTERNS.glider;
  const maxRow = Math.max(...pattern.cells.map(([row]) => row));
  const maxCol = Math.max(...pattern.cells.map(([, col]) => col));
  const startRow = Math.floor((GRID_SIZE - maxRow - 1) / 2);
  const startCol = Math.floor((GRID_SIZE - maxCol - 1) / 2);
  pattern.cells.forEach(([row, col]) => {
    grid[index(startRow + row, startCol + col)] = 1;
  });
  generation = 0;
  resetHistory();
  render();
}

function start() {
  if (isRunning) return;
  isRunning = true;
  updateControls();
  scheduleTick();
}

function stop() {
  isRunning = false;
  if (timerId) window.clearTimeout(timerId);
  timerId = null;
  updateControls();
}

function toggleRun() {
  if (isRunning) stop();
  else start();
}

function scheduleTick() {
  if (!isRunning) return;
  nextGeneration();
  const speed = Number(elements.speedSlider.value);
  const delay = Math.max(35, 620 - speed * 28);
  timerId = window.setTimeout(scheduleTick, delay);
}

function updateControls() {
  elements.startPauseBtn.textContent = isRunning ? "Pause" : "Start";
  elements.stepBtn.disabled = isRunning;
  elements.runStatus.textContent = isRunning ? "Running" : "Paused";
}

function resizeCanvases() {
  const boardSize = Math.floor(canvas.getBoundingClientRect().width);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(boardSize * dpr);
  canvas.height = Math.floor(boardSize * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cellSize = boardSize / GRID_SIZE;

  const graphRect = graphCanvas.getBoundingClientRect();
  graphCanvas.width = Math.floor(graphRect.width * dpr);
  graphCanvas.height = Math.floor(graphRect.height * dpr);
  graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawGrid() {
  const size = canvas.getBoundingClientRect().width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = cssVar("--dead");
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = cssVar("--alive");
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[index(row, col)] === 1) {
        ctx.fillRect(col * cellSize + 1, row * cellSize + 1, Math.max(1, cellSize - 1), Math.max(1, cellSize - 1));
      }
    }
  }

  ctx.strokeStyle = cssVar("--grid");
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * cellSize;
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
  }
  ctx.stroke();
}

function drawGraph() {
  const rect = graphCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const padding = 16;
  graphCtx.clearRect(0, 0, width, height);
  graphCtx.fillStyle = cssVar("--dead");
  graphCtx.fillRect(0, 0, width, height);

  const visible = populationHistory.slice(-GRAPH_WINDOW);
  if (visible.length < 2) return;

  const maxPopulation = Math.max(...visible, 1);
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  graphCtx.strokeStyle = cssVar("--grid");
  graphCtx.lineWidth = 1;
  graphCtx.beginPath();
  graphCtx.moveTo(padding, padding);
  graphCtx.lineTo(padding, height - padding);
  graphCtx.lineTo(width - padding, height - padding);
  graphCtx.stroke();

  graphCtx.strokeStyle = cssVar("--alive");
  graphCtx.lineWidth = 2;
  graphCtx.beginPath();
  visible.forEach((population, i) => {
    const x = padding + (i / (visible.length - 1)) * graphWidth;
    const y = height - padding - (population / maxPopulation) * graphHeight;
    if (i === 0) graphCtx.moveTo(x, y);
    else graphCtx.lineTo(x, y);
  });
  graphCtx.stroke();
}

function renderStats() {
  const population = currentPopulation();
  const maxPopulation = Math.max(...populationHistory, population, 0);
  const previous = populationHistory.length > 1 ? populationHistory[populationHistory.length - 2] : population;
  const growth = population - previous;

  elements.generation.textContent = String(generation);
  elements.population.textContent = String(population);
  elements.maxPopulation.textContent = String(maxPopulation);
  elements.growthRate.textContent = growth > 0 ? `+${growth}` : String(growth);
}

function render() {
  drawGrid();
  drawGraph();
  renderStats();
  updateControls();
}

function pointToCell(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
  return { row, col };
}

function paintCell(event) {
  const cell = pointToCell(event);
  if (!cell) return;
  grid[index(cell.row, cell.col)] = paintValue;
  generation = 0;
  resetHistory();
  render();
}

function handlePointerDown(event) {
  event.preventDefault();
  stop();
  const cell = pointToCell(event);
  if (!cell) return;
  paintValue = grid[index(cell.row, cell.col)] === 1 ? 0 : 1;
  isPainting = true;
  canvas.setPointerCapture(event.pointerId);
  paintCell(event);
}

function handlePointerMove(event) {
  if (!isPainting) return;
  event.preventDefault();
  paintCell(event);
}

function handlePointerUp(event) {
  isPainting = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function statePayload() {
  return {
    version: 1,
    gridSize: GRID_SIZE,
    generation,
    populationHistory,
    cells: Array.from(grid)
  };
}

function applyState(payload) {
  if (!payload || payload.gridSize !== GRID_SIZE || !Array.isArray(payload.cells) || payload.cells.length !== TOTAL_CELLS) {
    throw new Error("Invalid Conway state file.");
  }
  stop();
  grid = Uint8Array.from(payload.cells.map((value) => (value ? 1 : 0)));
  generation = Number.isFinite(payload.generation) ? payload.generation : 0;
  populationHistory = Array.isArray(payload.populationHistory) ? payload.populationHistory.map(Number).filter(Number.isFinite) : [];
  if (!populationHistory.length) resetHistory();
  render();
}

function saveState(showFeedback = true) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(statePayload()));
  if (showFeedback) elements.runStatus.textContent = "Saved";
}

function restoreState(showMissing = true) {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    if (showMissing) elements.runStatus.textContent = "No save";
    return false;
  }
  try {
    applyState(JSON.parse(raw));
    elements.runStatus.textContent = "Restored";
    return true;
  } catch (error) {
    localStorage.removeItem(SAVE_KEY);
    elements.runStatus.textContent = "Bad save";
    return false;
  }
}

function exportState() {
  const blob = new Blob([JSON.stringify(statePayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "conway-state.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importState(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      applyState(JSON.parse(String(reader.result)));
      saveState(false);
      elements.runStatus.textContent = "Imported";
    } catch (error) {
      elements.runStatus.textContent = "Import failed";
    }
  });
  reader.readAsText(file);
}

function populatePatterns() {
  Object.entries(PATTERNS).forEach(([key, pattern]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = pattern.name;
    elements.patternSelect.appendChild(option);
  });
  elements.patternSelect.value = "glider";
}

function bindEvents() {
  elements.startPauseBtn.addEventListener("click", toggleRun);
  elements.stepBtn.addEventListener("click", nextGeneration);
  elements.resetBtn.addEventListener("click", () => loadPattern(elements.patternSelect.value));
  elements.randomBtn.addEventListener("click", randomize);
  elements.clearBtn.addEventListener("click", clearGrid);
  elements.loadPatternBtn.addEventListener("click", () => loadPattern(elements.patternSelect.value));
  elements.saveBtn.addEventListener("click", () => saveState(true));
  elements.restoreBtn.addEventListener("click", () => restoreState(true));
  elements.exportBtn.addEventListener("click", exportState);
  elements.importBtn.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", (event) => importState(event.target.files[0]));
  elements.importInput.addEventListener("click", () => {
    elements.importInput.value = "";
  });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("resize", resizeCanvases);
}

function init() {
  populatePatterns();
  bindEvents();
  loadPattern("glider");
  resizeCanvases();
  if (localStorage.getItem(SAVE_KEY) && window.confirm("Restore saved Conway state?")) {
    restoreState(false);
  }
}

init();
