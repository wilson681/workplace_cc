// Seedable pseudo-random number generator (mulberry32) plus a few helpers.
//
// Everything in this project that needs randomness pulls from one of these
// generators, which means an entire run — world layout, mutations, the lot —
// is fully reproducible from a single integer seed. That is what makes the
// learning behaviour testable: same seed in, same evolution out.

/**
 * @typedef {Object} Rng
 * @property {() => number} next      Uniform float in [0, 1).
 * @property {(lo: number, hi: number) => number} range  Uniform float in [lo, hi).
 * @property {(lo: number, hi: number) => number} int    Uniform integer in [lo, hi).
 * @property {(mean?: number, std?: number) => number} gaussian  Normal sample.
 * @property {<T>(arr: T[]) => T} pick  Uniform element of a non-empty array.
 * @property {(p?: number) => boolean} bool  True with probability p.
 */

/**
 * Create a seeded RNG.
 * @param {number} seed
 * @returns {Rng}
 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo) * next()),
    gaussian: (mean = 0, std = 1) => {
      // Box–Muller transform. Guard against log(0).
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    bool: (p = 0.5) => next() < p,
  };
}
