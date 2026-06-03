// A curated bank of evergreen print-on-demand passion niches.
// These are identity-driven segments that buy apparel/merch repeatedly.
// `popularity` and `passion` are rough 0-100 tiers used by mock mode; in LIVE
// mode the research agent proposes niches grounded in the same principles.

import type { Niche } from "../types.ts";

export const NICHE_BANK: Niche[] = [
  {
    slug: "cat-parents",
    title: "Cat Parents",
    audience: "Cat owners who treat their cat like family",
    keywords: ["cat mom", "cat dad", "crazy cat lady", "cat lover gift"],
    popularity: 88,
    passion: 92,
    rationale: "Huge, repeat-buying, gift-driven audience; light-hearted text designs sell well.",
  },
  {
    slug: "dog-breeds",
    title: "Dog Breed Pride",
    audience: "Owners of a specific breed (corgi, dachshund, husky...)",
    keywords: ["corgi mom", "dachshund dad", "husky lover", "rescue dog"],
    popularity: 90,
    passion: 90,
    rationale: "Breed-specific long-tail = low competition + fierce loyalty.",
  },
  {
    slug: "nurses",
    title: "Nurses",
    audience: "RNs, NICU/ER nurses, nursing students",
    keywords: ["nurse life", "ER nurse", "nursing student", "nurse gift"],
    popularity: 84,
    passion: 86,
    rationale: "Profession identity + frequent gifting (graduation, nurses week).",
  },
  {
    slug: "teachers",
    title: "Teachers",
    audience: "K-12 teachers, teacher's aides",
    keywords: ["teacher life", "kindergarten teacher", "teacher gift", "back to school"],
    popularity: 82,
    passion: 84,
    rationale: "Seasonal spikes + strong gifting culture among parents and staff.",
  },
  {
    slug: "software-devs",
    title: "Software Developers",
    audience: "Programmers, sysadmins, data folks",
    keywords: ["programmer humor", "code joke", "devops", "git commit"],
    popularity: 70,
    passion: 80,
    rationale: "High-income, in-joke driven audience; clever text designs convert.",
  },
  {
    slug: "gym-fitness",
    title: "Gym & Lifting",
    audience: "Gym-goers, powerlifters, runners",
    keywords: ["gym motivation", "leg day", "powerlifting", "run club"],
    popularity: 86,
    passion: 82,
    rationale: "Identity + motivation slogans; large evergreen market.",
  },
  {
    slug: "gardening",
    title: "Gardening & Plants",
    audience: "Home gardeners, plant parents",
    keywords: ["plant lady", "crazy plant lady", "vegetable garden", "succulent"],
    popularity: 76,
    passion: 84,
    rationale: "Cozy hobby niche, gift-heavy, low design complexity.",
  },
  {
    slug: "fishing",
    title: "Fishing",
    audience: "Anglers, bass/fly fishermen",
    keywords: ["fishing dad", "bass fishing", "fishing gift", "reel cool"],
    popularity: 78,
    passion: 80,
    rationale: "Dad-gift evergreen with strong Father's Day spikes.",
  },
  {
    slug: "new-parents",
    title: "New Parents",
    audience: "First-time moms/dads, baby announcements",
    keywords: ["girl dad", "boy mom", "mama bear", "new dad"],
    popularity: 85,
    passion: 88,
    rationale: "Emotional, gift-driven, year-round demand.",
  },
  {
    slug: "camping-hiking",
    title: "Camping & Hiking",
    audience: "Campers, hikers, van-lifers",
    keywords: ["happy camper", "take a hike", "national park", "wander"],
    popularity: 80,
    passion: 78,
    rationale: "Outdoorsy lifestyle + tourism overlap; works on totes & posters.",
  },
  {
    slug: "coffee-lovers",
    title: "Coffee Lovers",
    audience: "Caffeine-dependent professionals",
    keywords: ["but first coffee", "espresso", "coffee addict", "barista"],
    popularity: 83,
    passion: 76,
    rationale: "Universal relatable humor; perfect for mugs (high margin).",
  },
  {
    slug: "mental-health",
    title: "Mental Health & Self-care",
    audience: "Wellness-minded buyers, therapists",
    keywords: ["be kind", "self care", "anxiety", "therapist"],
    popularity: 74,
    passion: 82,
    rationale: "Values-driven slogans with strong sharing behavior.",
  },
];

/** Pick the bank niches most relevant to a free-text seed. */
export function matchNiches(seed: string, limit: number): Niche[] {
  const q = seed.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = NICHE_BANK.map((n) => {
    const hay = `${n.title} ${n.audience} ${n.keywords.join(" ")} ${n.slug}`.toLowerCase();
    let s = 0;
    for (const t of tokens) if (hay.includes(t)) s += 3;
    s += n.popularity * 0.01 + n.passion * 0.01; // tie-breaker toward strong niches
    return { n, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.n);
}
