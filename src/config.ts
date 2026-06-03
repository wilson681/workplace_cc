// Runtime configuration. Decides MOCK vs LIVE based on which keys are present.

export type Config = {
  anthropicApiKey?: string;
  anthropicModel: string;
  openaiApiKey?: string;
  openaiImageModel: string;
  printifyToken?: string;
  printifyShopId?: string;
  outDir: string;
  /** Convenience flags. */
  liveText: boolean;
  liveImage: boolean;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

export function loadConfig(): Config {
  const anthropicApiKey = env("ANTHROPIC_API_KEY");
  const openaiApiKey = env("OPENAI_API_KEY");
  return {
    anthropicApiKey,
    anthropicModel: env("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001",
    openaiApiKey,
    openaiImageModel: env("OPENAI_IMAGE_MODEL") ?? "gpt-image-1",
    printifyToken: env("PRINTIFY_API_TOKEN"),
    printifyShopId: env("PRINTIFY_SHOP_ID"),
    outDir: env("OUT_DIR") ?? "output",
    liveText: Boolean(anthropicApiKey),
    liveImage: Boolean(openaiApiKey),
  };
}
