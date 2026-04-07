import type { CheerioAPI } from "cheerio";

export interface MetaResult {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  isNoindex: boolean;
  isNofollow: boolean;
  metaTags: Record<string, string>;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  hasViewport: boolean;
}

export function parseMeta($: CheerioAPI, pageUrl: string): MetaResult {
  const title = $("title").first().text().trim() || null;

  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name =
      $(el).attr("name") ||
      $(el).attr("property") ||
      $(el).attr("http-equiv");
    const content = $(el).attr("content");
    if (name && content !== undefined) {
      metaTags[name.toLowerCase()] = content;
    }
  });

  const metaDescription =
    metaTags["description"] || metaTags["og:description"] || null;

  // Canonical — resolve relative URLs
  const canonicalHref = $('link[rel="canonical"]').first().attr("href") || null;
  let canonicalUrl: string | null = null;
  if (canonicalHref) {
    try {
      canonicalUrl = new URL(canonicalHref, pageUrl).href;
    } catch {
      canonicalUrl = canonicalHref;
    }
  }

  const robotsContent = (metaTags["robots"] ?? "").toLowerCase();
  const isNoindex = robotsContent.includes("noindex");
  const isNofollow = robotsContent.includes("nofollow");

  const hasViewport = !!$('meta[name="viewport"]').length;

  // Open Graph
  const openGraph: Record<string, string> = {};
  $("meta[property]").each((_, el) => {
    const prop = $(el).attr("property") ?? "";
    const content = $(el).attr("content") ?? "";
    if (prop.startsWith("og:")) openGraph[prop] = content;
  });

  // Twitter Card
  const twitterCard: Record<string, string> = {};
  $("meta[name]").each((_, el) => {
    const name = $(el).attr("name") ?? "";
    const content = $(el).attr("content") ?? "";
    if (name.startsWith("twitter:")) twitterCard[name] = content;
  });

  return {
    title,
    metaDescription,
    canonicalUrl,
    isNoindex,
    isNofollow,
    metaTags,
    openGraph,
    twitterCard,
    hasViewport,
  };
}
