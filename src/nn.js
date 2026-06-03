// A tiny feed-forward neural network (multi-layer perceptron), written from
// scratch with no dependencies.
//
// The whole network — every weight and bias — is stored in one flat
// Float64Array, laid out layer by layer. That representation is deliberate:
// the genetic algorithm treats this array as the genome, so mutation and
// crossover are just operations on a flat list of numbers.

/**
 * Number of trainable parameters (weights + biases) for an architecture.
 * @param {number[]} arch e.g. [6, 10, 2]
 * @returns {number}
 */
export function weightCount(arch) {
  let n = 0;
  for (let i = 1; i < arch.length; i++) {
    n += arch[i - 1] * arch[i] + arch[i]; // weight matrix + bias vector
  }
  return n;
}

const tanh = Math.tanh;

export class NeuralNetwork {
  /**
   * @param {number[]} arch  Layer sizes, input first, output last.
   * @param {Float64Array} weights  Flat parameter vector, length weightCount(arch).
   */
  constructor(arch, weights) {
    if (weights.length !== weightCount(arch)) {
      throw new Error(
        `weight vector length ${weights.length} does not match architecture ${arch.join('x')} (expected ${weightCount(arch)})`,
      );
    }
    this.arch = arch;
    this.weights = weights;
  }

  /**
   * Build a network with parameters drawn from a standard normal.
   * @param {number[]} arch
   * @param {import('./rng.js').Rng} rng
   */
  static random(arch, rng) {
    const w = new Float64Array(weightCount(arch));
    for (let i = 0; i < w.length; i++) w[i] = rng.gaussian(0, 1);
    return new NeuralNetwork(arch, w);
  }

  /**
   * Forward pass. tanh activation on every layer, so outputs live in (-1, 1).
   * @param {ArrayLike<number>} input  Length must equal arch[0].
   * @returns {Float64Array} Length equals the final layer size.
   */
  forward(input) {
    const { arch, weights } = this;
    let act = input;
    let p = 0;
    for (let l = 1; l < arch.length; l++) {
      const inN = arch[l - 1];
      const outN = arch[l];
      const next = new Float64Array(outN);
      for (let o = 0; o < outN; o++) {
        let sum = 0;
        for (let i = 0; i < inN; i++) sum += act[i] * weights[p++];
        sum += weights[p++]; // bias
        next[o] = tanh(sum);
      }
      act = next;
    }
    return act;
  }
}
