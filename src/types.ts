// Shared domain types for the AutoMerch pipeline.
// Kept dependency-free and "erasable" so Node 22 can run the .ts files directly.

export type ProductType =
  | "tshirt"
  | "hoodie"
  | "mug"
  | "poster"
  | "tote"
  | "sticker";

/** A passion/identity market segment we can design products for. */
export type Niche = {
  slug: string;
  title: string; // e.g. "Cat Dad"
  audience: string; // who buys, in one line
  keywords: string[];
  /** Curated 0-100 signals; replaced by live data when a research source is wired in. */
  popularity: number; // rough search/demand tier
  passion: number; // how identity-driven / repeat-buying the audience is
  rationale: string;
};

/** A concrete product concept derived from a niche. */
export type ProductIdea = {
  id: string;
  nicheSlug: string;
  nicheTitle: string;
  audience: string;
  concept: string; // short human-readable design concept
  designPrompt: string; // prompt handed to the image model
  product: ProductType;
  keywords: string[];
};

/** Transparent opportunity scoring. Higher is better on every axis. */
export type OpportunityScore = {
  demand: number; // 0-100
  competition: number; // 0-100 (high = LESS crowded = better)
  margin: number; // 0-100
  printability: number; // 0-100 (simpler art prints cleaner / fewer defects)
  passion: number; // 0-100
  total: number; // weighted 0-100
};

export type ScoredIdea = ProductIdea & { score: OpportunityScore };

/** A publish-ready marketplace listing. */
export type Listing = {
  ideaId: string;
  nicheTitle: string;
  product: ProductType;
  title: string; // SEO-oriented title
  description: string; // marketing body
  bullets: string[]; // feature bullets
  tags: string[]; // marketplace tags
  priceUsd: number;
  costUsd: number;
  marginPct: number;
  imagePrompt: string;
  imagePath?: string; // on-disk artwork (svg placeholder or png)
  imageInline?: string; // data-URI / inline svg for portable catalog
};

export type PipelineResult = {
  niche: string; // the user's seed
  createdAt: string;
  live: { text: boolean; image: boolean };
  listings: Listing[];
  scored: ScoredIdea[];
  outDir: string;
  catalogPath: string;
};
