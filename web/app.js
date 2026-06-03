// Browser front-end. Drives the exact same Simulation used by the headless
// runner and paints it onto a canvas, with a few controls and a live chart of
// foraging skill per generation.

import { Simulation } from '../src/sim.js';

const worldCanvas = document.getElementById('world');
const wctx = worldCanvas.getContext('2d');
const chartCanvas = document.getElementById('chart');
const cctx = chartCanvas.getContext('2d');
const genflash = document.getElementById('genflash');

const el = {
  gen: document.getElementById('stat-gen'),
  alive: document.getElementById('stat-alive'),
  avg: document.getElementById('stat-avg'),
  best: document.getElementById('stat-best'),
  record: document.getElementById('stat-record'),
  progress: document.getElementById('progress-fill'),
  mutation: document.getElementById('mutation'),
  mutVal: document.getElementById('mut-val'),
  playPause: document.getElementById('playPause'),
  newRun: document.getElementById('newRun'),
};

const COLORS = {
  food: '#84cc16',
  foodCore: '#bef264',
  best: '#facc15',
  vision: 'rgba(94, 234, 212, 0.16)',
};

let sim = new Simulation({}, (Math.random() * 1e9) | 0);
let playing = true;
let speed = 1; // 1 | 3 | 10 | 'max'
let simClock = 0;
let lastTime = 0;
let record = 0; // best food-eaten ever seen
let lastFlash = 0;

const DT = sim.cfg.evolution.dt;

// ---------------------------------------------------------------- simulation
function advance(realDelta, now) {
  const genBefore = sim.generation;

  if (speed === 'max') {
    const budgetEnd = performance.now() + 12; // fast-forward within a frame budget
    let n = 0;
    while (performance.now() < budgetEnd && n < 6000) {
      sim.step();
      n++;
    }
  } else {
    simClock += realDelta * speed;
    let guard = 0;
    while (simClock >= DT && guard < 4000) {
      sim.step();
      simClock -= DT;
      guard++;
    }
  }

  if (sim.generation > genBefore && now - lastFlash > 400) {
    flashGeneration(sim.generation);
    lastFlash = now;
  }
}

function flashGeneration(gen) {
  genflash.textContent = `Generation ${gen}`;
  genflash.classList.add('show');
  setTimeout(() => genflash.classList.remove('show'), 260);
}

// ------------------------------------------------------------------- drawing
function bestAliveCreature() {
  let best = null;
  for (const c of sim.world.creatures) {
    if (c.alive && (!best || c.fitness > best.fitness)) best = c;
  }
  return best;
}

function drawFood() {
  const r = sim.cfg.world.foodRadius;
  for (const f of sim.world.foods) {
    wctx.fillStyle = COLORS.food;
    wctx.beginPath();
    wctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    wctx.fill();
    wctx.fillStyle = COLORS.foodCore;
    wctx.beginPath();
    wctx.arc(f.x, f.y, r * 0.45, 0, Math.PI * 2);
    wctx.fill();
  }
}

function drawVision(c) {
  const cc = sim.cfg.creature;
  const half = cc.fov / 2;
  const sectorW = cc.fov / cc.rays;

  // the cone of attention
  wctx.save();
  wctx.translate(c.x, c.y);
  wctx.rotate(c.angle);
  wctx.fillStyle = COLORS.vision;
  wctx.beginPath();
  wctx.moveTo(0, 0);
  wctx.arc(0, 0, cc.viewDist, -half, half);
  wctx.closePath();
  wctx.fill();

  // per-sector activation: brighter wedge where the creature senses food
  for (let i = 0; i < cc.rays; i++) {
    const v = c.lastVision[i];
    if (v <= 0.01) continue;
    const a0 = -half + i * sectorW;
    wctx.fillStyle = `rgba(94, 234, 212, ${0.12 + v * 0.5})`;
    wctx.beginPath();
    wctx.moveTo(0, 0);
    wctx.arc(0, 0, cc.viewDist * (0.35 + 0.65 * v), a0, a0 + sectorW);
    wctx.closePath();
    wctx.fill();
  }
  wctx.restore();
}

function drawCreature(c, isBest) {
  const cc = sim.cfg.creature;
  const r = cc.radius;
  const energy = Math.max(0, Math.min(1, c.energy / cc.maxEnergy));

  wctx.save();
  wctx.translate(c.x, c.y);
  wctx.rotate(c.angle);

  wctx.beginPath();
  wctx.moveTo(r * 1.7, 0);
  wctx.lineTo(-r, r * 0.95);
  wctx.lineTo(-r * 0.5, 0);
  wctx.lineTo(-r, -r * 0.95);
  wctx.closePath();

  const light = 38 + energy * 26;
  wctx.fillStyle = `hsla(${c.hue}, 75%, ${light}%, ${0.45 + energy * 0.55})`;
  wctx.fill();

  if (isBest) {
    wctx.lineWidth = 2.2;
    wctx.strokeStyle = COLORS.best;
    wctx.stroke();
  }
  wctx.restore();
}

function render() {
  const W = worldCanvas.width;
  const H = worldCanvas.height;
  wctx.fillStyle = '#070a0f';
  wctx.fillRect(0, 0, W, H);

  // faint grid for depth
  wctx.strokeStyle = 'rgba(255,255,255,0.03)';
  wctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    wctx.beginPath();
    wctx.moveTo(x, 0);
    wctx.lineTo(x, H);
    wctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    wctx.beginPath();
    wctx.moveTo(0, y);
    wctx.lineTo(W, y);
    wctx.stroke();
  }

  drawFood();

  const best = bestAliveCreature();
  if (best) drawVision(best);
  for (const c of sim.world.creatures) {
    if (c.alive) drawCreature(c, c === best);
  }
}

function drawChart() {
  const W = chartCanvas.width;
  const H = chartCanvas.height;
  const pad = { l: 26, r: 8, t: 10, b: 16 };
  cctx.fillStyle = '#070a0f';
  cctx.fillRect(0, 0, W, H);

  const hist = sim.history;
  if (hist.length < 2) {
    cctx.fillStyle = '#5b6677';
    cctx.font = '12px ui-sans-serif, system-ui';
    cctx.fillText('evolving…', pad.l, H / 2);
    return;
  }

  let ymax = 1;
  for (const h of hist) ymax = Math.max(ymax, h.bestEaten);
  ymax = Math.ceil(ymax / 5) * 5;
  const xmax = hist.length - 1;

  const X = (i) => pad.l + (i / xmax) * (W - pad.l - pad.r);
  const Y = (v) => H - pad.b - (v / ymax) * (H - pad.t - pad.b);

  // axes + y labels
  cctx.strokeStyle = '#1c2533';
  cctx.fillStyle = '#5b6677';
  cctx.font = '10px ui-sans-serif, system-ui';
  cctx.lineWidth = 1;
  for (let g = 0; g <= ymax; g += Math.max(5, Math.round(ymax / 4 / 5) * 5)) {
    const y = Y(g);
    cctx.beginPath();
    cctx.moveTo(pad.l, y);
    cctx.lineTo(W - pad.r, y);
    cctx.stroke();
    cctx.fillText(String(g), 4, y + 3);
  }

  const line = (key, color) => {
    cctx.strokeStyle = color;
    cctx.lineWidth = 1.8;
    cctx.beginPath();
    hist.forEach((h, i) => {
      const x = X(i);
      const y = Y(h[key]);
      if (i === 0) cctx.moveTo(x, y);
      else cctx.lineTo(x, y);
    });
    cctx.stroke();
  };
  line('bestEaten', COLORS.best);
  line('avgEaten', '#5eead4');
}

function updateHud() {
  const hist = sim.history;
  const last = hist[hist.length - 1];
  let liveBest = 0;
  for (const c of sim.world.creatures) if (c.foodEaten > liveBest) liveBest = c.foodEaten;
  record = Math.max(record, liveBest, last ? last.bestEaten : 0);

  el.gen.textContent = String(sim.generation);
  el.alive.textContent = String(sim.world.aliveCount());
  el.avg.textContent = last ? last.avgEaten.toFixed(1) : '—';
  el.best.textContent = String(liveBest);
  el.record.textContent = String(record);
  el.progress.style.width = `${(sim.progress * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------- main loop
function loop(now) {
  if (!lastTime) lastTime = now;
  const realDelta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (playing) advance(realDelta, now);

  render();
  drawChart();
  updateHud();
  requestAnimationFrame(loop);
}

// ----------------------------------------------------------------- controls
function setSpeed(s) {
  speed = s === 'max' ? 'max' : Number(s);
  document.querySelectorAll('.speed').forEach((b) => {
    b.classList.toggle('active', b.dataset.speed === String(s));
  });
}

document.querySelectorAll('.speed').forEach((b) => {
  b.addEventListener('click', () => setSpeed(b.dataset.speed));
});

el.playPause.addEventListener('click', () => {
  playing = !playing;
  el.playPause.textContent = playing ? '⏸ Pause' : '▶ Play';
  el.playPause.classList.toggle('btn-primary', playing);
});

el.newRun.addEventListener('click', () => {
  const mut = sim.cfg.evolution.mutationRate;
  sim = new Simulation({ evolution: { mutationRate: mut } }, (Math.random() * 1e9) | 0);
  record = 0;
  simClock = 0;
});

el.mutation.addEventListener('input', () => {
  const v = Number(el.mutation.value);
  sim.cfg.evolution.mutationRate = v; // shared config object → takes effect next generation
  el.mutVal.textContent = v.toFixed(2);
});

setSpeed(1);
requestAnimationFrame(loop);
