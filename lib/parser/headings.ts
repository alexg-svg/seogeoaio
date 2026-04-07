import type { CheerioAPI } from "cheerio";

export interface HeadingsResult {
  h1: string[];
  h2: string[];
  h3: string[];
  h1Count: number;
  firstH1: string | null;
  hasSkippedLevel: boolean; // e.g. H1 → H3 with no H2
}

export function parseHeadings($: CheerioAPI): HeadingsResult {
  const extract = (selector: string): string[] =>
    $(selector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

  const h1 = extract("h1");
  const h2 = extract("h2");
  const h3 = extract("h3");

  // Detect skipped heading levels by walking document order
  const headingLevels: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = (el as { tagName: string }).tagName.toLowerCase();
    const level = parseInt(tag[1], 10);
    headingLevels.push(level);
  });

  let hasSkippedLevel = false;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      hasSkippedLevel = true;
      break;
    }
  }

  return {
    h1,
    h2,
    h3,
    h1Count: h1.length,
    firstH1: h1[0] ?? null,
    hasSkippedLevel,
  };
}
