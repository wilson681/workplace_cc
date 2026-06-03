// Central tuning knobs for a simulation. Pass a (possibly partial) override to
// `mergeConfig` to get a complete config back.

export const DEFAULT_CONFIG = {
  world: {
    width: 900,
    height: 600,
    foodCount: 90, // food kept roughly constant: each eaten item respawns
    foodEnergy: 32, // energy gained per food
    foodRadius: 4,
  },
  creature: {
    radius: 6,
    maxSpeed: 95, // px/s at full thrust
    turnRate: 3.4, // rad/s at full turn
    fov: Math.PI * 0.9, // total field of view, split into `rays` sectors
    rays: 5,
    viewDist: 175,
    startEnergy: 100,
    maxEnergy: 160,
    metabolism: 5, // base energy drain per second (just being alive)
    moveCost: 0.045, // extra drain per (px/s) of speed per second
  },
  brain: {
    hidden: [10], // hidden layer sizes; arch = [rays+1, ...hidden, 2]
  },
  evolution: {
    population: 60,
    elitism: 4, // top genomes copied unchanged into the next generation
    tournament: 4, // tournament size for parent selection
    mutationRate: 0.12,
    mutationAmount: 0.45,
    genSeconds: 20, // simulated seconds per generation
    dt: 1 / 30, // fixed timestep
    shaping: 0.35, // reward weight for being near food (bootstraps learning)
  },
};

/** Deep-ish merge of a partial override onto DEFAULT_CONFIG (two levels). */
export function mergeConfig(override = {}) {
  const out = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    out[key] = { ...DEFAULT_CONFIG[key], ...(override[key] || {}) };
  }
  return out;
}

/** Network architecture implied by a config: inputs = rays + energy, 2 outputs. */
export function archFor(cfg) {
  return [cfg.creature.rays + 1, ...cfg.brain.hidden, 2];
}
