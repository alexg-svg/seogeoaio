import type { CheerioAPI } from "cheerio";

export interface MetaExtractionResult {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonicalUrl: string | null;
  language: string | null;
  hasViewport: boolean;
  isNoindex: boolean;
  isNofollow: boolean;
  metaRobots: string | null;
  metaTags: Record<string, string>;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
}

/**
 * Extract all head-level metadata from a parsed HTML document.
 *
 * @param $ Cheerio instance loaded with the page HTML.
 * @param pageUrl Final URL of the page (used to resolve relative canonicals).
 */
export function extractMeta($: CheerioAPI, pageUrl: string): MetaExtractionResult {
  // ── Title ────────────────────────────────────────────────────────────────────
  const rawTitle = $("title").first().text().trim();
  const title = rawTitle || null;

  // ── All meta tags ─────────────────────────────────────────────────────────
  // Index by name, property, or http-equiv (all lowercased).
  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const key =
      $(el).attr("name") ||
      $(el).attr("property") ||
      $(el).attr("http-equiv");
    const content = $(el).attr("content");
    if (key && content !== undefined) {
      metaTags[key.toLowerCase()] = content;
    }
  });

  // ── Description ──────────────────────────────────────────────────────────
  const metaDescription = metaTags["description"] ?? null;

  // ── Canonical ────────────────────────────────────────────────────────────
  const canonicalHref =
    $('link[rel="canonical"]').first().attr("href")?.trim() ?? null;
  let canonicalUrl: string | null = null;
  if (canonicalHref) {
    try {
      canonicalUrl = new URL(canonicalHref, pageUrl).href;
    } catch {
      // Malformed canonical — store as-is so rules can still flag it
      canonicalUrl = canonicalHref;
    }
  }

  // ── Language ─────────────────────────────────────────────────────────────
  // Try <html lang>, then <meta http-equiv="content-language">, then nothing.
  const htmlLang = $("html").first().attr("lang")?.trim() || null;
  const metaLang =
    (metaTags["content-language"] ?? "").trim() || null;
  const language = htmlLang ?? metaLang;

  // ── Robots ───────────────────────────────────────────────────────────────
  const metaRobotsRaw =
    metaTags["robots"] ?? metaTags["googlebot"] ?? null;
  const robotsLower = (metaRobotsRaw ?? "").toLowerCase();
  const isNoindex = robotsLower.includes("noindex");
  const isNofollow = robotsLower.includes("nofollow");

  // ── Viewport ─────────────────────────────────────────────────────────────
  const hasViewport = $('meta[name="viewport"]').length > 0;

  // ── Open Graph ───────────────────────────────────────────────────────────
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property") ?? "";
    const content = $(el).attr("content") ?? "";
    openGraph[prop] = content;
  });
  // og:description may appear as name= on some CMS
  if (!openGraph["og:description"] && metaTags["og:description"]) {
    openGraph["og:description"] = metaTags["og:description"];
  }

  // ── Twitter Card ─────────────────────────────────────────────────────────
  const twitterCard: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name") ?? "";
    const content = $(el).attr("content") ?? "";
    twitterCard[name] = content;
  });

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonicalUrl,
    language,
    hasViewport,
    isNoindex,
    isNofollow,
    metaRobots: metaRobotsRaw,
    metaTags,
    openGraph,
    twitterCard,
  };
}
