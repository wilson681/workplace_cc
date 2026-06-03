// The genetic algorithm: holds a population of genomes, turns them into brains,
// and breeds the next generation from the fittest of the last.
//
// Selection is elitism + tournament. The best few genomes survive untouched;
// the rest of the next generation is filled by repeatedly picking two parents
// (each the winner of a small random tournament), recombining them, and mutating
// the child.

import { NeuralNetwork } from './nn.js';
import { randomGenome, clone, mutate, crossover } from './genome.js';
import { archFor } from './config.js';
import { Creature } from './creature.js';

export class Evolution {
  /**
   * @param {ReturnType<import('./config.js').mergeConfig>} cfg
   * @param {import('./rng.js').Rng} rng
   */
  constructor(cfg, rng) {
    this.cfg = cfg;
    this.rng = rng;
    this.arch = archFor(cfg);
    this.generation = 0;
    /** @type {{gen:number, best:number, avg:number, bestEaten:number, avgEaten:number}[]} */
    this.history = [];
    this.genomes = [];
    for (let i = 0; i < cfg.evolution.population; i++) {
      this.genomes.push(randomGenome(this.arch, rng));
    }
  }

  /** Instantiate one creature per genome and drop them into `world`. */
  makeCreatures(world) {
    for (let i = 0; i < this.genomes.length; i++) {
      const brain = new NeuralNetwork(this.arch, this.genomes[i]);
      world.addCreature(new Creature(this.cfg, brain, this.rng, i));
    }
  }

  /** Pick the fittest genome out of `k` random contenders. */
  _tournament(ranked) {
    const k = this.cfg.evolution.tournament;
    let best = ranked[this.rng.int(0, ranked.length)];
    for (let i = 1; i < k; i++) {
      const cand = ranked[this.rng.int(0, ranked.length)];
      if (cand.f > best.f) best = cand;
    }
    return best.g;
  }

  /**
   * Score the finished generation, record stats, and build the next genomes.
   * @param {import('./creature.js').Creature[]} creatures
   */
  evolve(creatures) {
    const ev = this.cfg.evolution;

    const ranked = creatures
      .map((c) => ({ g: this.genomes[c.index], f: c.fitness }))
      .sort((a, b) => b.f - a.f);

    const n = creatures.length;
    const best = ranked[0].f;
    const avg = ranked.reduce((s, r) => s + r.f, 0) / n;
    let bestEaten = 0;
    let sumEaten = 0;
    for (const c of creatures) {
      if (c.foodEaten > bestEaten) bestEaten = c.foodEaten;
      sumEaten += c.foodEaten;
    }
    const stats = { gen: this.generation, best, avg, bestEaten, avgEaten: sumEaten / n };
    this.history.push(stats);

    const next = [];
    for (let i = 0; i < ev.elitism && i < ranked.length; i++) next.push(clone(ranked[i].g));
    while (next.length < ev.population) {
      const p1 = this._tournament(ranked);
      const p2 = this._tournament(ranked);
      const child = mutate(crossover(p1, p2, this.rng), this.rng, {
        rate: ev.mutationRate,
        amount: ev.mutationAmount,
      });
      next.push(child);
    }

    this.genomes = next;
    this.generation++;
    return stats;
  }
}
