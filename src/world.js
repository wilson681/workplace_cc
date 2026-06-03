// The environment a generation of creatures lives in: a toroidal plane sprinkled
// with food. The World owns the per-step update — sense, think, move, eat — for
// every creature, and keeps the food population roughly constant by respawning
// each item as it is eaten.

import { wrapDelta } from './geom.js';

export class World {
  /**
   * @param {ReturnType<import('./config.js').mergeConfig>} cfg
   * @param {import('./rng.js').Rng} rng
   */
  constructor(cfg, rng) {
    this.cfg = cfg;
    this.rng = rng;
    this.width = cfg.world.width;
    this.height = cfg.world.height;
    /** @type {{x: number, y: number}[]} */
    this.foods = [];
    /** @type {import('./creature.js').Creature[]} */
    this.creatures = [];
    this.reset();
  }

  randomPos() {
    return { x: this.rng.next() * this.width, y: this.rng.next() * this.height };
  }

  spawnFood(n) {
    for (let i = 0; i < n; i++) this.foods.push(this.randomPos());
  }

  /** Clear creatures and re-scatter a fresh field of food. */
  reset() {
    this.foods.length = 0;
    this.creatures.length = 0;
    this.spawnFood(this.cfg.world.foodCount);
  }

  addCreature(c) {
    this.creatures.push(c);
  }

  aliveCount() {
    let n = 0;
    for (const c of this.creatures) if (c.alive) n++;
    return n;
  }

  /** Advance every creature by one timestep and resolve eating. */
  step(dt) {
    const eatR = this.cfg.creature.radius + this.cfg.world.foodRadius;
    const eatR2 = eatR * eatR;

    for (const c of this.creatures) {
      if (!c.alive) continue;
      c.think(c.sense(this));
      c.update(dt, this);
      if (!c.alive) continue;

      for (let j = 0; j < this.foods.length; j++) {
        const f = this.foods[j];
        const dx = wrapDelta(f.x - c.x, this.width);
        const dy = wrapDelta(f.y - c.y, this.height);
        if (dx * dx + dy * dy <= eatR2) {
          c.energy = Math.min(this.cfg.creature.maxEnergy, c.energy + this.cfg.world.foodEnergy);
          c.foodEaten++;
          c.fitness += 1;
          this.foods[j] = this.randomPos(); // respawn elsewhere
        }
      }
    }
  }
}
