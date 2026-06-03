// Agent 1 — Research: turn a free-text seed into concrete product ideas.
// LIVE: Claude proposes niches + design concepts grounded in POD best practice.
// MOCK: derive ideas from the curated niche bank + design-angle templates.

import type { Config } from "../config.ts";
import type { ProductIdea, ProductType } from "../types.ts";
import { completeJson } from "../llm.ts";
import { matchNiches, NICHE_BANK } from "../data/niches.ts";

const RESEARCH_SYSTEM = `You are a print-on-demand (POD) merchandising researcher.
You find evergreen, identity-driven niches and propose simple, original t-shirt/mug
design concepts that convert. Hard rules:
- NEVER reference trademarked brands, logos, sports teams, or copyrighted characters.
- Prefer text-based or simple-graphic concepts (they print cleanly and cheaply).
- Each concept must be original wordplay/sentiment, safe to sell commercially.`;

type RawIdea = {
  niche: string;
  audience: string;
  concept: string;
  designPrompt: string;
  product: string;
  keywords: string[];
};

const PRODUCTS: ProductType[] = ["tshirt", "mug", "hoodie", "poster", "tote", "sticker"];

function coerceProduct(p: string | undefined): ProductType {
  const v = (p ?? "").toLowerCase();
  return (PRODUCTS as string[]).includes(v) ? (v as ProductType) : "tshirt";
}

export async function research(
  cfg: Config,
  seed: string,
  count: number,
): Promise<ProductIdea[]> {
  const live = await researchLive(cfg, seed, count);
  if (live && live.length) return live;
  return researchMock(seed, count);
}

async function researchLive(
  cfg: Config,
  seed: string,
  count: number,
): Promise<ProductIdea[] | null> {
  const data = await completeJson<{ ideas: RawIdea[] }>(cfg, {
    system: RESEARCH_SYSTEM,
    maxTokens: 2000,
    user: `Seed market/theme: "${seed}".
Propose ${count} distinct POD product ideas. For each: a specific sub-niche,
its target audience, a punchy design concept (the actual phrase/graphic idea),
an image-generation prompt describing flat vector art on a transparent background,
the best product type (one of: ${PRODUCTS.join(", ")}), and 4-6 marketplace keywords.
Return JSON: {"ideas":[{"niche","audience","concept","designPrompt","product","keywords":[]}]}`,
  });
  if (!data?.ideas?.length) return null;
  return data.ideas.slice(0, count).map((r, i) => ({
    id: `idea-${i + 1}`,
    nicheSlug: slugify(r.niche),
    nicheTitle: r.niche,
    audience: r.audience,
    concept: r.concept,
    designPrompt: ensureFlatVector(r.designPrompt, r.concept),
    product: coerceProduct(r.product),
    keywords: (r.keywords ?? []).slice(0, 6),
  }));
}

// --- Deterministic mock: still produces specific, sellable concepts ---------

const ANGLES = [
  (n: string) => ({ concept: `"${n} Mode: ON" minimalist badge`, product: "tshirt" as ProductType }),
  (n: string) => ({ concept: `Funny "Powered by ${n} & Caffeine" line`, product: "mug" as ProductType }),
  (n: string) => ({ concept: `Vintage retro sunset "${n}" emblem`, product: "tshirt" as ProductType }),
  (n: string) => ({ concept: `"World's Okayest ${n}" tongue-in-cheek text`, product: "tshirt" as ProductType }),
  (n: string) => ({ concept: `Cute hand-drawn ${n} doodle pattern`, product: "tote" as ProductType }),
  (n: string) => ({ concept: `Bold typographic "${n} Era" statement`, product: "hoodie" as ProductType }),
];

export function researchMock(seed: string, count: number): ProductIdea[] {
  const niches = matchNiches(seed, Math.max(3, Math.ceil(count / 2)));
  const pool = niches.length ? niches : NICHE_BANK.slice(0, 4);
  const ideas: ProductIdea[] = [];
  let i = 0;
  while (ideas.length < count) {
    const niche = pool[i % pool.length];
    const angle = ANGLES[i % ANGLES.length];
    const a = angle(niche.title);
    ideas.push({
      id: `idea-${ideas.length + 1}`,
      nicheSlug: niche.slug,
      nicheTitle: niche.title,
      audience: niche.audience,
      concept: a.concept,
      designPrompt: ensureFlatVector(
        `${a.concept} for ${niche.audience}`,
        a.concept,
      ),
      product: a.product,
      keywords: niche.keywords.slice(0, 6),
    });
    i++;
  }
  return ideas.slice(0, count);
}

function ensureFlatVector(prompt: string, concept: string): string {
  const base = prompt && prompt.length > 8 ? prompt : concept;
  return `Flat vector illustration, bold clean lines, limited color palette, centered composition, transparent background, no mockup, no text artifacts — design concept: ${base}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "niche";
}
