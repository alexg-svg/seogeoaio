import type { CheerioAPI } from "cheerio";
import type { HeadingTree } from "./types";

export interface HeadingsExtractionResult {
  headings: HeadingTree;
  h1: string | null;
  h1Count: number;
  hasSkippedHeadingLevel: boolean;
}

/**
 * Extract heading text from H1–H6 and detect structural issues.
 *
 * hasSkippedHeadingLevel is true when any adjacent heading pair jumps more
 * than one level (e.g. H1 → H3 without H2), which harms accessibility and
 * content-structure signals.
 */
export function extractHeadings($: CheerioAPI): HeadingsExtractionResult {
  const extract = (selector: string): string[] =>
    $(selector)
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

  const h1 = extract("h1");
  const h2 = extract("h2");
  const h3 = extract("h3");

  // Walk headings H1–H6 in document order to detect level skips
  const levels: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const n = parseInt(tag.slice(1), 10);
    if (!isNaN(n)) levels.push(n);
  });

  let hasSkippedHeadingLevel = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      hasSkippedHeadingLevel = true;
      break;
    }
  }

  return {
    headings: { h1, h2, h3 },
    h1: h1[0] ?? null,
    h1Count: h1.length,
    hasSkippedHeadingLevel,
  };
}
