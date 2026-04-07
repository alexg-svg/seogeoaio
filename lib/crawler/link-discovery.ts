import { load } from "cheerio";
import { normaliseUrl, isSameOrigin } from "@/lib/validators/audit-input";

/**
 * Extract all internal links from an HTML page.
 * Returns normalised absolute URLs on the same origin as baseUrl.
 * Filters out: fragments-only, mailto, tel, javascript, non-HTTP schemes.
 */
export function extractInternalLinks(
  html: string,
  baseUrl: string
): string[] {
  const $ = load(html);
  const origin = (() => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return "";
    }
  })();

  const found = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const trimmed = href.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:") ||
      trimmed.startsWith("javascript:")
    ) {
      return;
    }

    let absolute: string;
    try {
      absolute = new URL(trimmed, baseUrl).href;
    } catch {
      return;
    }

    // Strip fragment
    try {
      const u = new URL(absolute);
      u.hash = "";
      absolute = u.href;
    } catch {
      return;
    }

    if (!absolute.startsWith("http")) return;
    if (!isSameOrigin(absolute, baseUrl)) return;

    found.add(normaliseUrl(absolute));
  });

  return Array.from(found);
}
