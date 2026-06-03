import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/sim.js';
import { Evolution } from '../src/evolution.js';
import { World } from '../src/world.js';
import { mergeConfig } from '../src/config.js';
import { makeRng } from '../src/rng.js';

// A small, fast config that still exhibits clear learning, so the suite stays
// quick while exercising the real engine end to end.
const FAST = { evolution: { population: 30, genSeconds: 12 } };

test('makeCreatures produces one creature per genome', () => {
  const cfg = mergeConfig(FAST);
  const rng = makeRng(1);
  const evo = new Evolution(cfg, rng);
  const world = new World(cfg, rng);
  world.reset();
  evo.makeCreatures(world);
  assert.equal(world.creatures.length, cfg.evolution.population);
  world.creatures.forEach((c, i) => assert.equal(c.index, i));
});

test('a generation records well-formed stats', () => {
  const sim = new Simulation(FAST, 1);
  const stats = sim.runGeneration();
  assert.equal(typeof stats.best, 'number');
  assert.equal(typeof stats.avgEaten, 'number');
  assert.ok(stats.best >= stats.avg, 'best should be at least the average');
  assert.ok(stats.bestEaten >= 0);
  assert.equal(sim.generation, 1);
  assert.equal(sim.history.length, 1);
});

test('identical seeds give identical histories', () => {
  const a = new Simulation(FAST, 7).runGenerations(5);
  const b = new Simulation(FAST, 7).runGenerations(5);
  assert.deepEqual(a, b);
});

test('different seeds give different histories', () => {
  const a = new Simulation(FAST, 1).runGenerations(5);
  const b = new Simulation(FAST, 2).runGenerations(5);
  assert.notDeepEqual(a, b);
});

test('population learns to forage far better than it starts', () => {
  // Deterministic run; thresholds are conservative (observed gains are ~3.8x).
  const sim = new Simulation(FAST, 1);
  const history = sim.runGenerations(25);

  const mean = (xs) => xs.reduce((s, h) => s + h.avgEaten, 0) / xs.length;
  const early = mean(history.slice(0, 3));
  const late = mean(history.slice(-3));

  assert.ok(early > 0, 'sanity: some food eaten early');
  assert.ok(
    late > early * 2,
    `expected late foraging (${late.toFixed(2)}) to more than double early (${early.toFixed(2)})`,
  );
  assert.ok(
    history[history.length - 1].avgEaten > 6,
    `expected final avg-eaten > 6, got ${history[history.length - 1].avgEaten.toFixed(2)}`,
  );
});
