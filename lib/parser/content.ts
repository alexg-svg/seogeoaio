import type { CheerioAPI } from "cheerio";

export interface ContentResult {
  textContent: string;
  wordCount: number;
  hasOrderedList: boolean;
  hasUnorderedList: boolean;
  hasTable: boolean;
  hasDefinitionList: boolean;
  listItemCount: number;
  // Heuristic signals for AEO/content rules
  hasQuestionHeadings: boolean; // headings ending in "?"
  hasStepHeadings: boolean;     // headings starting with "Step N" or just a digit
  hasDirectAnswerPattern: boolean; // paragraph starting with "X is a…" / "X refers to…"
  hasAuthorByline: boolean;     // simple heuristic
  hasInterstitialOverlay: boolean; // cookie wall / GDPR modal heuristic
}

const QUESTION_HEADING_RE = /\?\s*$/;
const STEP_HEADING_RE = /^\s*(step\s+\d+|^\d+[\.\)]\s)/i;
const DIRECT_ANSWER_RE = /\b(is a|is an|refers to|means|defined as|is defined as)\b/i;
const AUTHOR_RE = /\b(by|written by|author:|posted by)\b/i;
const CONSENT_OVERLAY_RE =
  /\b(cookie|gdpr|consent|privacy policy|accept all)\b/i;

export function parseContent($: CheerioAPI): ContentResult {
  // Remove non-content elements before extracting text
  const $clone = $.root().clone();
  $clone.find("script, style, noscript, svg, nav, header, footer, aside").remove();

  const body = $clone.find("body");
  const textContent = body.text().replace(/\s+/g, " ").trim();
  const words = textContent.split(/\s+/).filter((w) => w.length > 1);
  const wordCount = words.length;

  const hasOrderedList = !!$("ol").length;
  const hasUnorderedList = !!$("ul").length;
  const hasTable = !!$("table").length;
  const hasDefinitionList = !!$("dl").length;
  const listItemCount = $("li").length;

  const headingTexts: string[] = [];
  $("h2, h3").each((_, el) => { headingTexts.push($(el).text().trim()); });

  const hasQuestionHeadings = headingTexts.some((h) =>
    QUESTION_HEADING_RE.test(h)
  );
  const hasStepHeadings = headingTexts.some((h) => STEP_HEADING_RE.test(h));

  let hasDirectAnswerPattern = false;
  $("p").each((_, el) => {
    if (DIRECT_ANSWER_RE.test($(el).text())) {
      hasDirectAnswerPattern = true;
      return false; // break
    }
  });

  let hasAuthorByline = false;
  $("[class*='author'], [itemprop='author'], [rel='author'], .byline").each(
    () => {
      hasAuthorByline = true;
      return false;
    }
  );
  if (!hasAuthorByline) {
    $("p, span, div").each((_, el) => {
      if (AUTHOR_RE.test($(el).text().slice(0, 80))) {
        hasAuthorByline = true;
        return false;
      }
    });
  }

  // Heuristic: a hidden overlay div with consent language = likely interstitial
  let hasInterstitialOverlay = false;
  $("div, section").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const role = $(el).attr("role") ?? "";
    const text = $(el).text().slice(0, 200);
    if (
      (style.includes("fixed") ||
        style.includes("z-index") ||
        role === "dialog") &&
      CONSENT_OVERLAY_RE.test(text)
    ) {
      hasInterstitialOverlay = true;
      return false;
    }
  });

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
