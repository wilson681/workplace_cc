// Agent 3 — Listing: turn a selected idea into publish-ready marketplace copy.
// LIVE: Claude writes SEO title + description + bullets + tags.
// MOCK: deterministic templates that still use the concept/niche/keywords.

import type { Config } from "../config.ts";
import type { Listing, ScoredIdea } from "../types.ts";
import { completeJson } from "../llm.ts";
import { ECONOMICS, marginPct } from "../data/economics.ts";

const LISTING_SYSTEM = `You are an e-commerce copywriter for a print-on-demand store.
Write conversion-focused, honest marketplace copy. No trademarked terms, no false
claims. Titles are keyword-rich but readable (<= 140 chars).`;

type RawListing = {
  title: string;
  description: string;
  bullets: string[];
  tags: string[];
};

export async function makeListing(cfg: Config, idea: ScoredIdea): Promise<Listing> {
  const econ = ECONOMICS[idea.product];
  const base = {
    ideaId: idea.id,
    nicheTitle: idea.nicheTitle,
    product: idea.product,
    priceUsd: econ.suggestedPrice,
    costUsd: econ.baseCost,
    marginPct: Math.round(marginPct(idea.product) * 100),
    imagePrompt: idea.designPrompt,
  };

  const live = await makeListingLive(cfg, idea);
  if (live) return { ...base, ...live };

  return { ...base, ...listingMock(idea) };
}

async function makeListingLive(
  cfg: Config,
  idea: ScoredIdea,
): Promise<RawListing | null> {
  const data = await completeJson<RawListing>(cfg, {
    system: LISTING_SYSTEM,
    maxTokens: 900,
    user: `Product: ${idea.product} for "${idea.nicheTitle}" (${idea.audience}).
Design concept: ${idea.concept}.
Target keywords: ${idea.keywords.join(", ")}.
Write JSON: {"title","description","bullets":[3-5],"tags":[10-13]}`,
  });
  if (!data?.title || !data?.description) return null;
  return {
    title: data.title.slice(0, 140),
    description: data.description,
    bullets: (data.bullets ?? []).slice(0, 5),
    tags: (data.tags ?? idea.keywords).slice(0, 13),
  };
}

function listingMock(idea: ScoredIdea): RawListing {
  const product = readableProduct(idea.product);
  const title = `${idea.nicheTitle} ${product} — ${idea.concept}`.slice(0, 140);
  const description = `${idea.concept}. A perfect ${product.toLowerCase()} for ${idea.audience.toLowerCase()}. ` +
    `Designed to be comfortable, durable, and a great gift idea. Printed on demand just for you — ` +
    `order yours and show your ${idea.nicheTitle.toLowerCase()} pride.`;
  const bullets = [
    `Original ${idea.nicheTitle} design: ${idea.concept}`,
    `Great gift for ${idea.audience.toLowerCase()}`,
    "Premium print-on-demand quality, made to order",
    "Durable print that lasts wash after wash",
  ];
  const tags = dedupe([
    ...idea.keywords,
    idea.nicheTitle.toLowerCase(),
    `${idea.nicheTitle.toLowerCase()} gift`,
    `${product.toLowerCase()}`,
    "print on demand",
    "gift idea",
  ]).slice(0, 13);
  return { title, description, bullets, tags };
}

function readableProduct(p: string): string {
  const map: Record<string, string> = {
    tshirt: "T-Shirt",
    hoodie: "Hoodie",
    mug: "Mug",
    poster: "Poster",
    tote: "Tote Bag",
    sticker: "Sticker",
  };
  return map[p] ?? "Tee";
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}
