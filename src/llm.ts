// Minimal, dependency-free Anthropic client (raw REST via global fetch).
// Falls back to "" when no key is set, so callers can switch to mock output.

import type { Config } from "./config.ts";

type AnthropicBlock = { type: string; text?: string };

export type CompleteOpts = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

/** Returns model text, or "" when no API key is configured (caller -> mock). */
export async function complete(cfg: Config, opts: CompleteOpts): Promise<string> {
  if (!cfg.anthropicApiKey) return "";

  const body = {
    model: cfg.anthropicModel,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.8,
    // Cache the (stable) system prompt so bulk generation is cheap on repeat calls.
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: AnthropicBlock[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}

/**
 * Ask for JSON and parse it robustly. Returns `null` when there is no key or
 * the model output cannot be parsed, so callers fall back to deterministic mock.
 */
export async function completeJson<T>(cfg: Config, opts: CompleteOpts): Promise<T | null> {
  const text = await complete(cfg, {
    ...opts,
    system: `${opts.system}\n\nRespond with ONLY valid minified JSON. No markdown, no prose.`,
  });
  if (!text) return null;
  return parseJsonLoose<T>(text);
}

/** Extracts the first JSON object/array from arbitrary text. */
export function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to bracket extraction
  }
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
