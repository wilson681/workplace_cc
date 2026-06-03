// Design/image generation. Uses OpenAI Images when a key is present, otherwise
// writes a labeled SVG placeholder so the catalog still renders end-to-end.

import { writeFile } from "node:fs/promises";
import type { Config } from "./config.ts";

export type GeneratedImage = {
  path: string; // on-disk file
  inline: string; // data-URI (png) or raw svg markup, for a portable catalog
  live: boolean;
};

export async function generateImage(
  cfg: Config,
  opts: { prompt: string; outPathNoExt: string },
): Promise<GeneratedImage> {
  if (cfg.liveImage && cfg.openaiApiKey) {
    try {
      const b64 = await openaiImage(cfg, opts.prompt);
      const path = `${opts.outPathNoExt}.png`;
      await writeFile(path, Buffer.from(b64, "base64"));
      return { path, inline: `data:image/png;base64,${b64}`, live: true };
    } catch (err) {
      // Never let a flaky image API abort the whole run — degrade to placeholder.
      console.warn(`  image: live generation failed, using placeholder (${(err as Error).message})`);
    }
  }
  const svg = placeholderSvg(opts.prompt);
  const path = `${opts.outPathNoExt}.svg`;
  await writeFile(path, svg);
  return { path, inline: svg, live: false };
}

async function openaiImage(cfg: Config, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: cfg.openaiImageModel,
      prompt,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI Images ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI Images returned no b64_json");
  return b64;
}

/** A tidy placeholder card that shows the design brief — keeps the catalog legible. */
function placeholderSvg(prompt: string): string {
  const lines = wrap(prompt, 34).slice(0, 8);
  const body = lines
    .map((ln, i) => `<text x="50%" y="${150 + i * 30}" text-anchor="middle" font-size="18" fill="#e5e7eb" font-family="system-ui, sans-serif">${escapeXml(ln)}</text>`)
    .join("\n    ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f2937"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <rect x="16" y="16" width="480" height="480" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8 6" rx="16"/>
  <text x="50%" y="88" text-anchor="middle" font-size="22" fill="#94a3b8" font-family="system-ui, sans-serif" font-weight="700">DESIGN BRIEF (mock)</text>
    ${body}
  <text x="50%" y="470" text-anchor="middle" font-size="13" fill="#64748b" font-family="system-ui, sans-serif">add OPENAI_API_KEY to render real art</text>
</svg>`;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      if (line) out.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) out.push(line);
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
