import { XMLParser } from "fast-xml-parser";

const MAX_SITEMAP_URLS = 500; // collect up to this before truncating
const SITEMAP_FETCH_TIMEOUT = 15_000;
const MAX_INDEX_DEPTH = 3;

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: number;
}

/**
 * Fetch a sitemap or sitemap index and return all discovered URLs,
 * sorted by priority desc then lastmod desc.
 * Handles sitemap index (recursive up to MAX_INDEX_DEPTH levels).
 */
export async function fetchSitemapUrls(
  sitemapUrl: string,
  depth = 0
): Promise<string[]> {
  if (depth > MAX_INDEX_DEPTH) return [];

  const xml = await fetchXml(sitemapUrl);
  if (!xml) return [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) =>
      ["url", "sitemap"].includes(name),
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }

  // Sitemap index — recurse into each child sitemap
  const sitemapIndex = (parsed as Record<string, unknown>)?.sitemapindex as
    | Record<string, unknown>
    | undefined;
  if (sitemapIndex) {
    const sitemaps = (sitemapIndex.sitemap as Array<{ loc: string }>) ?? [];
    const childUrls: string[] = [];
    for (const sm of sitemaps.slice(0, 20)) {
      if (!sm.loc) continue;
      const urls = await fetchSitemapUrls(sm.loc.trim(), depth + 1);
      childUrls.push(...urls);
      if (childUrls.length >= MAX_SITEMAP_URLS) break;
    }
    return childUrls.slice(0, MAX_SITEMAP_URLS);
  }

  // URL set
  const urlset = (parsed as Record<string, unknown>)?.urlset as
    | Record<string, unknown>
    | undefined;
  if (urlset) {
    const urls = (urlset.url as Array<Record<string, unknown>>) ?? [];
    const entries: SitemapUrl[] = urls
      .map((u) => ({
        loc: String(u.loc ?? "").trim(),
        lastmod: u.lastmod ? String(u.lastmod) : undefined,
        priority: u.priority ? parseFloat(String(u.priority)) : undefined,
      }))
      .filter((u) => u.loc.startsWith("http"));

    // Sort by priority DESC, then lastmod DESC
    entries.sort((a, b) => {
      const pa = a.priority ?? 0.5;
      const pb = b.priority ?? 0.5;
      if (pb !== pa) return pb - pa;
      if (a.lastmod && b.lastmod) return b.lastmod.localeCompare(a.lastmod);
      return 0;
    });

    return entries.slice(0, MAX_SITEMAP_URLS).map((e) => e.loc);
  }

  return [];
}

async function fetchXml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEMAP_FETCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "SEOAuditBot/1.0 (+https://github.com/alexg-svg/seogeoaio)",
        Accept: "application/xml,text/xml,*/*",
      },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Try to auto-discover a sitemap for a given origin. */
export async function discoverSitemap(origin: string): Promise<string | null> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap/`,
  ];
  for (const url of candidates) {
    const xml = await fetchXml(url);
    if (xml && (xml.includes("<urlset") || xml.includes("<sitemapindex"))) {
      return url;
    }
  }
  return null;
}
