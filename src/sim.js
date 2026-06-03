// The top-level simulation, used unchanged by both the headless CLI and the
// browser visualiser.
//
// A generation runs the whole population in one shared world for a fixed number
// of simulated seconds (or until everyone has died), then evolution breeds the
// next generation and the world resets. Stepping is on a fixed timestep so that
// behaviour is identical no matter how fast the host renders.

import { mergeConfig } from './config.js';
import { makeRng } from './rng.js';
import { World } from './world.js';
import { Evolution } from './evolution.js';

export class Simulation {
  /**
   * @param {object} [configOverride]  Partial override of DEFAULT_CONFIG.
   * @param {number} [seed]
   */
  constructor(configOverride = {}, seed = 1) {
    this.cfg = mergeConfig(configOverride);
    this.seed = seed;
    this.rng = makeRng(seed);
    this.evo = new Evolution(this.cfg, this.rng);
    this.world = new World(this.cfg, this.rng);
    this.elapsed = 0;
    this.lastResult = null;
    this._begin();
  }

  _begin() {
    this.world.reset();
    this.evo.makeCreatures(this.world);
    this.elapsed = 0;
  }

  get generation() {
    return this.evo.generation;
  }

  get history() {
    return this.evo.history;
  }

  /** Fraction of the current generation elapsed, in [0, 1]. */
  get progress() {
    return Math.min(1, this.elapsed / this.cfg.evolution.genSeconds);
  }

  /**
   * Advance one fixed timestep.
   * @returns {boolean} true if a generation boundary was just crossed.
   */
  step() {
    const dt = this.cfg.evolution.dt;
    this.world.step(dt);
    this.elapsed += dt;
    if (this.elapsed >= this.cfg.evolution.genSeconds || this.world.aliveCount() === 0) {
      this.lastResult = this.evo.evolve(this.world.creatures);
      this._begin();
      return true;
    }
    return false;
  }

  /** Run steps until the current generation ends; returns that generation's stats. */
  runGeneration() {
    const maxSteps = Math.ceil(this.cfg.evolution.genSeconds / this.cfg.evolution.dt) + 5;
    let guard = 0;
    while (!this.step()) {
      if (++guard > maxSteps) break;
    }
    return this.lastResult;
  }

  /** Run `n` whole generations and return the full history. */
  runGenerations(n) {
    for (let i = 0; i < n; i++) this.runGeneration();
    return this.history;
  }
}
