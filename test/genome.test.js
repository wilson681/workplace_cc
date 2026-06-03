import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomGenome, clone, mutate, crossover } from '../src/genome.js';
import { weightCount } from '../src/nn.js';
import { makeRng } from '../src/rng.js';

const arch = [6, 10, 2];

test('randomGenome has the right length', () => {
  const g = randomGenome(arch, makeRng(1));
  assert.equal(g.length, weightCount(arch));
});

test('clone is a copy, not an alias', () => {
  const g = randomGenome(arch, makeRng(1));
  const c = clone(g);
  c[0] += 1;
  assert.notEqual(c[0], g[0]);
});

test('mutate changes roughly the configured fraction of genes', () => {
  const g = randomGenome(arch, makeRng(2));
  const rate = 0.3;
  const m = mutate(g, makeRng(2), { rate, amount: 0.5 });
  let changed = 0;
  for (let i = 0; i < g.length; i++) if (m[i] !== g[i]) changed++;
  const frac = changed / g.length;
  assert.ok(Math.abs(frac - rate) < 0.2, `mutated fraction ${frac} far from ${rate}`);
  assert.equal(g.length, m.length);
});

test('mutate keeps weights within the clamp range', () => {
  const g = randomGenome(arch, makeRng(3));
  let m = g;
  // hammer it: many high-variance mutation passes should never escape +/-8
  for (let pass = 0; pass < 200; pass++) {
    m = mutate(m, makeRng(pass + 1), { rate: 1, amount: 5 });
  }
  for (const v of m) assert.ok(v >= -8 && v <= 8, `weight ${v} escaped clamp`);
});

test('crossover child genes all come from one parent or the other', () => {
  const a = randomGenome(arch, makeRng(10));
  const b = randomGenome(arch, makeRng(20));
  const child = crossover(a, b, makeRng(30));
  assert.equal(child.length, a.length);
  for (let i = 0; i < child.length; i++) {
    assert.ok(child[i] === a[i] || child[i] === b[i], `gene ${i} came from neither parent`);
  }
});

test('crossover rejects mismatched lengths', () => {
  assert.throws(() => crossover(new Float64Array(3), new Float64Array(4), makeRng(1)));
});
