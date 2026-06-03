#!/usr/bin/env node
// Headless evolution runner. Runs the simulation for a number of generations
// and prints how foraging skill develops, with no browser involved.
//
//   node bin/evolve.js --gens 60 --seed 1
//   node bin/evolve.js --gens 40 --pop 80 --json runs/out.json
//   node bin/evolve.js --quiet --gens 50      # summary line only

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Simulation } from '../src/sim.js';

function parseArgs(argv) {
  const args = { gens: 50, seed: 1, json: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--gens': args.gens = Number(next()); break;
      case '--seed': args.seed = Number(next()); break;
      case '--pop': args.pop = Number(next()); break;
      case '--json': args.json = next(); break;
      case '--quiet': args.quiet = true; break;
      case '--help': case '-h': args.help = true; break;
      default: throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

const HELP = `neuro-creatures — headless evolution runner

Usage: node bin/evolve.js [options]

  --gens N     number of generations to run (default 50)
  --seed N     RNG seed; same seed => identical run (default 1)
  --pop N      population size override
  --json PATH  also write the full per-generation history as JSON
  --quiet      print only the final summary line
  -h, --help   show this help
`;

function bar(value, max, width = 24) {
  const n = max <= 0 ? 0 : Math.round((value / max) * width);
  return '█'.repeat(n) + '·'.repeat(width - n);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const override = args.pop ? { evolution: { population: args.pop } } : {};
  const sim = new Simulation(override, args.seed);

  const t0 = Date.now();
  const history = sim.runGenerations(args.gens);
  const ms = Date.now() - t0;

  const peakEaten = Math.max(...history.map((h) => h.bestEaten), 1);

  if (!args.quiet) {
    const arch = sim.evo.arch.join('→');
    console.log(`neuro-creatures   seed=${args.seed}  pop=${sim.cfg.evolution.population}  brain=${arch}\n`);
    console.log('  gen   avg-eaten  best-eaten   foraging');
    console.log('  ----  ---------  ----------   ' + '-'.repeat(24));
    const stride = Math.max(1, Math.floor(history.length / 25));
    for (let i = 0; i < history.length; i++) {
      if (i % stride !== 0 && i !== history.length - 1) continue;
      const h = history[i];
      console.log(
        `  ${String(h.gen).padStart(4)}  ${h.avgEaten.toFixed(2).padStart(9)}  ` +
          `${String(h.bestEaten).padStart(10)}   ${bar(h.avgEaten, peakEaten)}`,
      );
    }
    console.log('');
  }

  const first = history[0];
  const last = history[history.length - 1];
  const early = history.slice(0, Math.max(1, Math.ceil(history.length * 0.1)));
  const lateStart = Math.floor(history.length * 0.9);
  const late = history.slice(lateStart);
  const mean = (xs, k) => xs.reduce((s, h) => s + h[k], 0) / xs.length;
  const earlyAvg = mean(early, 'avgEaten');
  const lateAvg = mean(late, 'avgEaten');
  const gain = earlyAvg > 0 ? (lateAvg / earlyAvg).toFixed(2) : '∞';

  console.log(
    `summary: gen0 avg-eaten ${first.avgEaten.toFixed(2)} → gen${last.gen} avg-eaten ${last.avgEaten.toFixed(2)} ` +
      `(early ${earlyAvg.toFixed(2)} → late ${lateAvg.toFixed(2)}, ${gain}× foraging)  in ${ms}ms`,
  );

  if (args.json) {
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(
      args.json,
      JSON.stringify({ seed: args.seed, config: sim.cfg, history }, null, 2),
    );
    console.log(`wrote ${args.json}`);
  }
}

main();
