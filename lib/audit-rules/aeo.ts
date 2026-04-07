import { pageRule } from "./utils";
import { hasSchemaType, getSchemaBlock } from "@/lib/parser/structured-data";
import type { PageRule } from "./types";

const AEO_001: PageRule = pageRule(
  { id: "AEO_001", name: "Direct Answer Content", category: "AEO", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.hasDirectAnswerPattern && page.wordCount > 200) {
      return {
        status: "fail",
        detail: "Page does not contain definition-style answer patterns (\"X is a…\", \"X refers to…\"). LLMs prefer pages that answer questions in the first paragraph.",
      };
    }
    return { status: "pass" };
  }
);

const AEO_002: PageRule = pageRule(
  { id: "AEO_002", name: "FAQ or Q&A Structure", category: "AEO", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const hasQaStructure =
      page.hasQuestionHeadings ||
      hasSchemaType(page.structuredData, "FAQPage", "QAPage");
    if (!hasQaStructure && page.wordCount > 500) {
      return {
        status: "fail",
        detail: "Page has no question-format headings and no FAQPage/QAPage schema. Q&A format maps directly to how LLMs structure retrieved context for answers.",
      };
    }
    return { status: "pass" };
  }
);

const AEO_003: PageRule = pageRule(
  { id: "AEO_003", name: "Author Entity Identified", category: "AEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    // Only apply to content-heavy pages
    if (page.wordCount < 300) return { status: "skip" };
    const hasAuthorSchema =
      hasSchemaType(page.structuredData, "Article", "BlogPosting", "NewsArticle") &&
      (() => {
        const block = getSchemaBlock(page.structuredData, "Article") ??
          getSchemaBlock(page.structuredData, "BlogPosting");
        return !!(block?.raw as Record<string, unknown>)?.author;
      })();
    if (!hasAuthorSchema && !page.hasAuthorByline) {
      return {
        status: "fail",
        detail: "No author entity identified (no author schema, no byline). LLMs weight author credibility; E-E-A-T requires human attribution.",
      };
    }
    return { status: "pass" };
  }
);

const AEO_004: PageRule = pageRule(
  { id: "AEO_004", name: "Content Freshness Signal", category: "AEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const block =
      getSchemaBlock(page.structuredData, "Article") ??
      getSchemaBlock(page.structuredData, "BlogPosting") ??
      getSchemaBlock(page.structuredData, "NewsArticle");
    if (!block) return { status: "skip" };
    const raw = block.raw as Record<string, unknown>;
    const dateModified = raw.dateModified as string | undefined;
    if (!dateModified) return { status: "skip" }; // SD_009 covers absence

    const modified = new Date(dateModified);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (modified < oneYearAgo) {
      return {
        status: "fail",
        detail: `Article dateModified (${dateModified}) is more than 12 months ago. AI answer engines prefer fresh sources and may deprioritise stale content.`,
        evidence: { dateModified },
      };
    }
    return { status: "pass" };
  }
);

const AEO_005: PageRule = pageRule(
  { id: "AEO_005", name: "Speakable Schema Present", category: "AEO", defaultSeverity: "LOW" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    // Speakable is a property on Article/NewsArticle, not a standalone type
    const block =
      getSchemaBlock(page.structuredData, "Article") ??
      getSchemaBlock(page.structuredData, "NewsArticle");
    if (!block) return { status: "skip" };
    const raw = block.raw as Record<string, unknown>;
    if (!raw.speakable) {
      return {
        status: "fail",
        detail: "Article schema has no speakable property. Speakable markup helps voice assistants and AI summarisers identify the key passage.",
      };
    }
    return { status: "pass" };
  }
);

const AEO_006: PageRule = pageRule(
  { id: "AEO_006", name: "Structured List Content", category: "AEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.wordCount < 200) return { status: "skip" };
    const hasStructuredContent =
      page.hasOrderedList ||
      page.hasUnorderedList ||
      page.hasTable ||
      page.listItemCount >= 3;
    if (!hasStructuredContent) {
      return {
        status: "fail",
        detail: "Page has no structured list content (ordered/unordered lists or tables). Lists and tables are heavily used in LLM context extraction.",
      };
    }
    return { status: "pass" };
  }
);

const AEO_007: PageRule = pageRule(
  { id: "AEO_007", name: "Clear Single Topic Per Page", category: "AEO", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.h1) return { status: "skip" }; // ONPAGE_001 covers this
    const h1TooLong = page.h1.split(/\s+/).length > 12;
    const tooManyH2Topics = page.headings.h2.length > 8;
    if (h1TooLong || tooManyH2Topics) {
      const reasons: string[] = [];
      if (h1TooLong) reasons.push(`H1 is ${page.h1.split(/\s+/).length} words (target ≤12)`);
      if (tooManyH2Topics) reasons.push(`${page.headings.h2.length} H2 topic sections (target ≤8)`);
      return {
        status: "fail",
        detail: `Page may cover too many topics: ${reasons.join("; ")}. AEO rewards topically focused pages — LLMs surface specific answers, not broad overviews.`,
        evidence: { h1WordCount: page.h1.split(/\s+/).length, h2Count: page.headings.h2.length },
      };
    }
    return { status: "pass" };
  }
);

const AEO_008: PageRule = pageRule(
  { id: "AEO_008", name: "No Content-Blocking Interstitial", category: "AEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.hasInterstitialOverlay) {
      return {
        status: "fail",
        detail: "Page appears to have a cookie/consent interstitial overlay. LLMs and AI crawlers cannot bypass interstitials — page content becomes invisible.",
      };
    }
    return { status: "pass" };
  }
);

export const aeoRules: PageRule[] = [
  AEO_001, AEO_002, AEO_003, AEO_004,
  AEO_005, AEO_006, AEO_007, AEO_008,
];
