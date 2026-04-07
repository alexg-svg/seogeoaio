import type { CheerioAPI } from "cheerio";
import { normaliseUrl, isSameOrigin } from "@/lib/validators/audit-input";

export interface LinksResult {
  internalLinks: string[];
  externalLinks: string[];
  internalLinkCount: number;
  externalLinkCount: number;
}

export function parseLinks($: CheerioAPI, pageUrl: string): LinksResult {
  const internalSet = new Set<string>();
  const externalSet = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = ($( el).attr("href") ?? "").trim();
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      return;
    }

    let absolute: string;
    try {
      const u = new URL(href, pageUrl);
      u.hash = "";
      absolute = u.href;
    } catch {
      return;
    }

    if (!absolute.startsWith("http")) return;

    const norm = normaliseUrl(absolute);
    if (isSameOrigin(absolute, pageUrl)) {
      internalSet.add(norm);
    } else {
      externalSet.add(norm);
    }
  });

  return {
    internalLinks: Array.from(internalSet),
    externalLinks: Array.from(externalSet),
    internalLinkCount: internalSet.size,
    externalLinkCount: externalSet.size,
  };
}
