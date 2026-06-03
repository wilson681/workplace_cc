import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuralNetwork, weightCount } from '../src/nn.js';
import { makeRng } from '../src/rng.js';

test('weightCount counts weights and biases per layer', () => {
  // layer1: 2*3 + 3 = 9 ; layer2: 3*1 + 1 = 4 => 13
  assert.equal(weightCount([2, 3, 1]), 13);
  assert.equal(weightCount([6, 10, 2]), 6 * 10 + 10 + 10 * 2 + 2);
});

test('constructor rejects a wrong-sized weight vector', () => {
  assert.throws(() => new NeuralNetwork([2, 2], new Float64Array(3)));
});

test('forward matches a hand-computed single neuron', () => {
  // arch [1, 1]: one weight, one bias. output = tanh(w*x + b)
  const w = 0.5;
  const b = -0.25;
  const x = 2;
  const net = new NeuralNetwork([1, 1], Float64Array.from([w, b]));
  const out = net.forward([x]);
  assert.equal(out.length, 1);
  assert.ok(Math.abs(out[0] - Math.tanh(w * x + b)) < 1e-12);
});

test('forward output has the final layer size and stays in (-1, 1)', () => {
  const rng = makeRng(5);
  const net = NeuralNetwork.random([6, 10, 2], rng);
  const out = net.forward([0.1, -0.2, 0.3, 0.9, -1, 0.5]);
  assert.equal(out.length, 2);
  for (const v of out) assert.ok(v > -1 && v < 1);
});

test('forward is deterministic for fixed weights', () => {
  const rng = makeRng(5);
  const net = NeuralNetwork.random([4, 8, 3], rng);
  const input = [0.2, 0.4, -0.6, 0.8];
  assert.deepEqual([...net.forward(input)], [...net.forward(input)]);
});
