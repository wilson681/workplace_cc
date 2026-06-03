import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';

test('same seed produces the same sequence', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('different seeds diverge', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  let same = 0;
  for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
  assert.ok(same < 5, `expected sequences to differ, ${same} collisions`);
});

test('next() stays within [0, 1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 10000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
  }
});

test('int(lo, hi) covers the half-open range', () => {
  const r = makeRng(99);
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(r.int(0, 6));
  assert.deepEqual([...seen].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5]);
});

test('gaussian has roughly zero mean and unit variance', () => {
  const r = makeRng(123);
  const n = 50000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const x = r.gaussian(0, 1);
    sum += x;
    sumSq += x * x;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean} not near 0`);
  assert.ok(Math.abs(variance - 1) < 0.1, `variance ${variance} not near 1`);
});
