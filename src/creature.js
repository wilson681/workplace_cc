// A creature: a little agent with a neural-network brain.
//
// Each step it senses nearby food through a fan of vision sectors, feeds those
// (plus its own energy level) to its brain, and gets back two motor commands:
// how hard to turn and how hard to thrust. Moving and merely existing both burn
// energy; eating food restores it. Run out of energy and the creature dies.

import { normalizeAngle, wrap, wrapDelta } from './geom.js';

export class Creature {
  /**
   * @param {ReturnType<import('./config.js').mergeConfig>} cfg
   * @param {import('./nn.js').NeuralNetwork} brain
   * @param {import('./rng.js').Rng} rng
   * @param {number} index  Position of this creature's genome in the population.
   */
  constructor(cfg, brain, rng, index) {
    this.cfg = cfg;
    this.brain = brain;
    this.index = index;

    const c = cfg.creature;
    this.x = rng.next() * cfg.world.width;
    this.y = rng.next() * cfg.world.height;
    this.angle = rng.range(-Math.PI, Math.PI);
    this.energy = c.startEnergy;
    this.age = 0;
    this.alive = true;

    this.foodEaten = 0;
    this.fitness = 0;
    this.hue = rng.int(0, 360); // for rendering only

    this.shaping = cfg.evolution.shaping;

    // Motor commands, kept around between think() and update().
    this.turnCmd = 0;
    this.thrustCmd = 0;

    // Last sensory reading, exposed for rendering/debugging.
    this.lastVision = new Float64Array(c.rays);
    this.lastNearest = 0;
  }

  /**
   * Build the input vector: one proximity reading per vision sector, plus the
   * creature's own energy as a "hunger" signal.
   * @param {import('./world.js').World} world
   * @returns {Float64Array}
   */
  sense(world) {
    const c = this.cfg.creature;
    const rays = c.rays;
    const half = c.fov / 2;
    const sectorW = c.fov / rays;

    const prox = this.lastVision;
    prox.fill(0);
    let nearest = 0;

    for (const f of world.foods) {
      const dx = wrapDelta(f.x - this.x, world.width);
      const dy = wrapDelta(f.y - this.y, world.height);
      const dist = Math.hypot(dx, dy);
      if (dist > c.viewDist) continue;
      const rel = normalizeAngle(Math.atan2(dy, dx) - this.angle);
      if (rel < -half || rel > half) continue;
      let idx = Math.floor((rel + half) / sectorW);
      if (idx < 0) idx = 0;
      else if (idx >= rays) idx = rays - 1;
      const p = 1 - dist / c.viewDist; // nearer food reads stronger
      if (p > prox[idx]) prox[idx] = p;
      if (p > nearest) nearest = p;
    }

    this.lastNearest = nearest;

    const input = new Float64Array(rays + 1);
    input.set(prox, 0);
    input[rays] = this.energy / c.maxEnergy;
    return input;
  }

  /** Run the brain on a sensory input and latch the motor commands. */
  think(input) {
    const out = this.brain.forward(input);
    this.turnCmd = out[0]; // (-1, 1)
    this.thrustCmd = (out[1] + 1) / 2; // (0, 1)
  }

  /** Apply motion and metabolism for one timestep. */
  update(dt, world) {
    const c = this.cfg.creature;
    this.angle = normalizeAngle(this.angle + this.turnCmd * c.turnRate * dt);
    const speed = this.thrustCmd * c.maxSpeed;
    this.x = wrap(this.x + Math.cos(this.angle) * speed * dt, world.width);
    this.y = wrap(this.y + Math.sin(this.angle) * speed * dt, world.height);

    this.energy -= (c.metabolism + c.moveCost * speed) * dt;
    this.age += dt;

    // Shaping reward: being close to food. Tiny next to the reward for actually
    // eating, but it gives evolution a gradient to climb before any creature is
    // good enough to land a meal.
    this.fitness += this.shaping * this.lastNearest * dt;

    if (this.energy <= 0) {
      this.energy = 0;
      this.alive = false;
    }
  }
}
