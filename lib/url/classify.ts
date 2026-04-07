export type UrlType = "SITEMAP" | "HOMEPAGE";

// Paths that strongly indicate a sitemap without fetching
const SITEMAP_PATH_RE =
  /sitemap|sitemap_index|urlset|sitemaps/i;

const SITEMAP_EXT_RE = /\.(xml|xml\.gz)(\?.*)?$/i;

/**
 * Classify a URL as SITEMAP or HOMEPAGE using path heuristics only.
 * Fast — no network call required.
 *
 * Sitemap signals:
 *   - path ends in .xml or .xml.gz
 *   - path segment contains "sitemap"
 */
export function classifyUrlHeuristic(url: string): UrlType {
  try {
    const { pathname } = new URL(url);
    if (SITEMAP_EXT_RE.test(pathname) || SITEMAP_PATH_RE.test(pathname)) {
      return "SITEMAP";
    }
    return "HOMEPAGE";
  } catch {
    return "HOMEPAGE";
  }
}

/**
 * Probe the URL with a lightweight HEAD request to inspect Content-Type.
 * Falls back to heuristic if the request fails or times out.
 *
 * Resolves in < 5 s; safe to await before creating the audit record.
 */
export async function classifyUrlByProbe(url: string): Promise<UrlType> {
  // Fast heuristic path — skip the network hop when the URL is obvious
  const heuristic = classifyUrlHeuristic(url);
  if (heuristic === "SITEMAP") return "SITEMAP";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "SEOAuditBot/1.0 (+https://github.com/alexg-svg/seogeoaio)",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("xml")) return "SITEMAP";
    return "HOMEPAGE";
  } catch {
    clearTimeout(timer);
    return heuristic;
  }
}

/**
 * Return the normalised origin for a URL, e.g. "https://example.com".
 * Never includes a trailing slash.
 */
export function extractSiteUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

/**
 * Return a human-readable site name from a URL (the hostname without www.).
 */
export function extractSiteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Strip trailing slash, hash, and normalise scheme + host to lowercase.
 * Mirrors the normaliseUrl function in lib/validators but exported here
 * so URL utilities are co-located.
 */
export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // Lowercase scheme and host (already lowercase in URL spec, but be explicit)
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch {
    return raw;
  }
}

/**
 * Return true if two URLs belong to the same origin.
 */
export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * Deduplicate an array of URLs after normalisation.
 * Preserves original insertion order (first occurrence wins).
 */
export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const norm = normaliseUrl(url);
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}
