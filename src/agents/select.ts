// Agent 2 — Select: score ideas on a transparent rubric and keep the winners.
//
// Offline scores are HEURISTIC PROXIES derived from the concept/niche text and
// product economics — they are explainable, not random. Wire a real keyword /
// trends data source into `demandSignal`/`competitionSignal` to upgrade to live
// market data without touching the rest of the pipeline.

import type { ProductIdea, ScoredIdea, OpportunityScore } from "../types.ts";
import { marginPct } from "../data/economics.ts";
import { NICHE_BANK } from "../data/niches.ts";

const WEIGHTS = {
  demand: 0.25,
  competition: 0.2,
  margin: 0.2,
  printability: 0.15,
  passion: 0.2,
};

export function selectIdeas(ideas: ProductIdea[], keep: number): ScoredIdea[] {
  const scored = ideas.map(scoreIdea);
  scored.sort((a, b) => b.score.total - a.score.total);
  return scored.slice(0, keep);
}

export function scoreIdea(idea: ProductIdea): ScoredIdea {
  const demand = demandSignal(idea);
  const competition = competitionSignal(idea);
  const margin = clamp(Math.round(marginPct(idea.product) * 100));
  const printability = printabilitySignal(idea);
  const passion = passionSignal(idea);

  const total = Math.round(
    demand * WEIGHTS.demand +
      competition * WEIGHTS.competition +
      margin * WEIGHTS.margin +
      printability * WEIGHTS.printability +
      passion * WEIGHTS.passion,
  );

  const score: OpportunityScore = { demand, competition, margin, printability, passion, total };
  return { ...idea, score };
}

/** Demand proxy: niche popularity tier (if known) blended with keyword breadth. */
function demandSignal(idea: ProductIdea): number {
  const known = NICHE_BANK.find((n) => n.slug === idea.nicheSlug);
  const base = known ? known.popularity : 62;
  const breadth = Math.min(idea.keywords.length, 6) * 3; // more angles = more entry points
  return clamp(Math.round(base * 0.85 + breadth));
}

/** Competition proxy: specific long-tail concepts are LESS crowded (score higher). */
function competitionSignal(idea: ProductIdea): number {
  const words = idea.concept.split(/\s+/).length;
  const specificity = clamp(40 + words * 6); // longer, more specific concept => better
  const generic = /\b(love|best|cool|the)\b/i.test(idea.concept) ? -8 : 0;
  return clamp(specificity + generic);
}

/** Printability: text/simple/vector concepts print cleanly; complex art does not. */
function printabilitySignal(idea: ProductIdea): number {
  const p = `${idea.concept} ${idea.designPrompt}`.toLowerCase();
  let s = 70;
  if (/(text|typograph|badge|emblem|minimal|line|slogan|word)/.test(p)) s += 18;
  if (/(photo|realistic|gradient|portrait|detailed|3d)/.test(p)) s -= 25;
  return clamp(s);
}

/** Passion: identity/repeat-buy niches convert better. */
function passionSignal(idea: ProductIdea): number {
  const known = NICHE_BANK.find((n) => n.slug === idea.nicheSlug);
  if (known) return known.passion;
  return /(mom|dad|nurse|teacher|lover|life|squad|era)/i.test(
    `${idea.nicheTitle} ${idea.concept}`,
  )
    ? 80
    : 66;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
