// Rough but realistic print-on-demand unit economics (USD), used for margin
// scoring and price suggestions. Numbers reflect typical Printify/Printful base
// costs + common retail price points; tune to your actual provider/variants.

import type { ProductType } from "../types.ts";

export type Economics = { baseCost: number; suggestedPrice: number };

export const ECONOMICS: Record<ProductType, Economics> = {
  sticker: { baseCost: 1.5, suggestedPrice: 4.99 },
  mug: { baseCost: 7.5, suggestedPrice: 18.99 },
  poster: { baseCost: 8.0, suggestedPrice: 22.99 },
  tote: { baseCost: 9.0, suggestedPrice: 21.99 },
  tshirt: { baseCost: 11.0, suggestedPrice: 24.99 },
  hoodie: { baseCost: 22.0, suggestedPrice: 42.99 },
};

export function marginPct(p: ProductType): number {
  const e = ECONOMICS[p];
  return (e.suggestedPrice - e.baseCost) / e.suggestedPrice;
}
