// Genetic operators over a genome.
//
// A genome here is simply the flat weight vector of a NeuralNetwork (a
// Float64Array). The network architecture is fixed for the whole population,
// so genomes are always the same length and can be freely recombined.

import { weightCount } from './nn.js';

const CLAMP = 8; // keep weights in a sane range so tanh does not saturate forever

/**
 * @param {number[]} arch
 * @param {import('./rng.js').Rng} rng
 * @returns {Float64Array}
 */
export function randomGenome(arch, rng) {
  const g = new Float64Array(weightCount(arch));
  for (let i = 0; i < g.length; i++) g[i] = rng.gaussian(0, 1);
  return g;
}

/** @param {Float64Array} g */
export function clone(g) {
  return Float64Array.from(g);
}

/**
 * Return a mutated copy. Each gene is independently perturbed with probability
 * `rate`, by Gaussian noise of scale `amount`.
 * @param {Float64Array} genome
 * @param {import('./rng.js').Rng} rng
 * @param {{rate?: number, amount?: number}} [opts]
 * @returns {Float64Array}
 */
export function mutate(genome, rng, { rate = 0.1, amount = 0.5 } = {}) {
  const g = Float64Array.from(genome);
  for (let i = 0; i < g.length; i++) {
    if (rng.next() < rate) {
      let v = g[i] + rng.gaussian(0, amount);
      if (v > CLAMP) v = CLAMP;
      else if (v < -CLAMP) v = -CLAMP;
      g[i] = v;
    }
  }
  return g;
}

/**
 * Uniform crossover: each gene is copied from one parent or the other with
 * equal probability.
 * @param {Float64Array} a
 * @param {Float64Array} b
 * @param {import('./rng.js').Rng} rng
 * @returns {Float64Array}
 */
export function crossover(a, b, rng) {
  if (a.length !== b.length) throw new Error('genome length mismatch in crossover');
  const g = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) g[i] = rng.next() < 0.5 ? a[i] : b[i];
  return g;
}
