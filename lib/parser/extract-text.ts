import type { CheerioAPI } from "cheerio";

export interface TextExtractionResult {
  textContent: string; // stripped body text, whitespace normalised
  wordCount: number;
  // Structural content signals
  hasOrderedList: boolean;
  hasUnorderedList: boolean;
  hasTable: boolean;
  hasDefinitionList: boolean;
  listItemCount: number;
  // Heuristic content signals used by AEO / content rules
  hasQuestionHeadings: boolean;   // any H2/H3 ending with "?"
  hasStepHeadings: boolean;       // any H2/H3 starting "Step N" or "N."
  hasDirectAnswerPattern: boolean; // first-paragraph "X is a…" definitions
  hasAuthorByline: boolean;       // visible byline or author attribute
  hasInterstitialOverlay: boolean; // cookie wall / GDPR modal heuristic
}

const RE_QUESTION_HEADING = /\?\s*$/;
const RE_STEP_HEADING = /^\s*(step\s+\d+|\d+[.)]\s)/i;
const RE_DIRECT_ANSWER = /\b(is a|is an|refers to|means|defined as|is defined as)\b/i;
const RE_AUTHOR = /\b(by|written by|author[:\s]|posted by)\b/i;
const RE_CONSENT = /\b(cookie policy|accept cookies|gdpr|privacy preferences|accept all)\b/i;

// Tags whose text should not count toward readable word count
const NOISE_SELECTORS =
  "script, style, noscript, svg, nav, header, footer, aside, [aria-hidden='true']";

/**
 * Extract readable text and content-quality signals from the page body.
 *
 * Operates on the live Cheerio instance — does NOT mutate it (clones for
 * text extraction so the caller's $ is unchanged).
 */
export function extractText($: CheerioAPI): TextExtractionResult {
  // ── Readable body text ────────────────────────────────────────────────────
  // Clone to avoid mutating the caller's tree
  const $body = $.load($.html())("body");
  $body.find(NOISE_SELECTORS).remove();
  const textContent = $body.text().replace(/\s+/g, " ").trim();

  // Word count: split on whitespace, ignore single-char tokens
  const wordCount = textContent
    .split(/\s+/)
    .filter((w) => w.length > 1).length;

  // ── Structural elements ───────────────────────────────────────────────────
  const hasOrderedList = $("ol").length > 0;
  const hasUnorderedList = $("ul").length > 0;
  const hasTable = $("table").length > 0;
  const hasDefinitionList = $("dl").length > 0;
  const listItemCount = $("li").length;

  // ── Heading content signals ───────────────────────────────────────────────
  const headingTexts: string[] = [];
  $("h2, h3").each((_, el) => {
    headingTexts.push($(el).text().replace(/\s+/g, " ").trim());
  });

  const hasQuestionHeadings = headingTexts.some((h) =>
    RE_QUESTION_HEADING.test(h)
  );
  const hasStepHeadings = headingTexts.some((h) => RE_STEP_HEADING.test(h));

  // ── Direct answer pattern (first-paragraph definitions) ──────────────────
  let hasDirectAnswerPattern = false;
  $("p").each((_, el) => {
    if (RE_DIRECT_ANSWER.test($(el).text())) {
      hasDirectAnswerPattern = true;
      return false as unknown as void;
    }
  });

  // ── Author byline ─────────────────────────────────────────────────────────
  let hasAuthorByline = false;

  // Schema attribute markers
  $(
    "[itemprop='author'], [class*='author'], [rel='author'], .byline, [data-author]"
  ).each(() => {
    hasAuthorByline = true;
    return false as unknown as void;
  });

  if (!hasAuthorByline) {
    // Text-pattern fallback — only inspect short elements to avoid false positives
    $("p, span, small").each((_, el) => {
      const text = $(el).text().slice(0, 100);
      if (RE_AUTHOR.test(text)) {
        hasAuthorByline = true;
        return false as unknown as void;
      }
    });
  }

  // ── Interstitial / consent overlay heuristic ─────────────────────────────
  let hasInterstitialOverlay = false;
  $("div[role='dialog'], div[aria-modal='true']").each((_, el) => {
    if (RE_CONSENT.test($(el).text().slice(0, 300))) {
      hasInterstitialOverlay = true;
      return false as unknown as void;
    }
  });

  if (!hasInterstitialOverlay) {
    $("div, section").each((_, el) => {
      const style = $(el).attr("style") ?? "";
      const text = $(el).text().slice(0, 300);
      if (
        (style.includes("position:fixed") ||
          style.includes("position: fixed") ||
          ($(el).attr("role") ?? "") === "dialog") &&
        RE_CONSENT.test(text)
      ) {
        hasInterstitialOverlay = true;
        return false as unknown as void;
      }
    });
  }

  return {
    textContent,
    wordCount,
    hasOrderedList,
    hasUnorderedList,
    hasTable,
    hasDefinitionList,
    listItemCount,
    hasQuestionHeadings,
    hasStepHeadings,
    hasDirectAnswerPattern,
    hasAuthorByline,
    hasInterstitialOverlay,
  };
}
