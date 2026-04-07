import type { CheerioAPI } from "cheerio";

const SKIP_SCHEMES = new Set(["mailto:", "tel:", "javascript:", "data:", "ftp:"]);

export interface LinksExtractionResult {
  internalLinks: string[];
  externalLinks: string[];
  internalLinkCount: number;
  externalLinkCount: number;
}

/**
 * Extract and classify all anchor links on the page.
 *
 * - Internal = same origin as pageUrl (after normalisation).
 * - External = different origin.
 * - Skips: fragment-only links, mailto, tel, javascript, data URIs.
 * - Deduplicates within each set.
 * - Resolves relative hrefs against pageUrl.
 */
export function extractLinks(
  $: CheerioAPI,
  pageUrl: string
): LinksExtractionResult {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = "";
  }

  const internal = new Set<string>();
  const external = new Set<string>();

  $("a[href]").each((_, el) => {
    const rawHref = ($(el).attr("href") ?? "").trim();

    if (!rawHref || rawHref.startsWith("#")) return;
    if (SKIP_SCHEMES.has(rawHref.slice(0, rawHref.indexOf(":") + 1))) return;

    let absolute: string;
    try {
      const u = new URL(rawHref, pageUrl);
      u.hash = "";
      absolute = u.href;
    } catch {
      return; // unparseable href
    }

    if (!absolute.startsWith("http")) return;

    const norm = normalise(absolute);

    try {
      if (new URL(absolute).origin === origin) {
        internal.add(norm);
      } else {
        external.add(norm);
      }
    } catch {
      // malformed absolute — skip
    }
  });

  return {
    internalLinks: Array.from(internal),
    externalLinks: Array.from(external),
    internalLinkCount: internal.size,
    externalLinkCount: external.size,
  };
}

/** Strip trailing slash and fragment; lowercase scheme + host. */
function normalise(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}
