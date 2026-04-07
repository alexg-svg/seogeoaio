/**
 * Pass 2C — MVP page rules.
 *
 * 14 rules covering the most impactful on-page and local SEO signals.
 * All rules use the pageRule() factory from utils.ts and read only from
 * the ParsedPage type — no I/O, no side effects.
 */

import { pageRule } from "../utils";
import type { PageRule } from "../types";

// ─── TITLE ───────────────────────────────────────────────────────────────────

const missingTitle: PageRule = pageRule(
  {
    id: "BASIC_PAGE_001",
    name: "Missing title tag",
    category: "TECHNICAL_SEO",
    defaultSeverity: "CRITICAL",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.title || page.title.trim() === "") {
      return { status: "fail", detail: "Page has no <title> tag." };
    }
    return { status: "pass" };
  }
);

const titleTooShort: PageRule = pageRule(
  {
    id: "BASIC_PAGE_002",
    name: "Title too short",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.title) return { status: "skip" }; // covered by BASIC_PAGE_001
    if (page.titleLength < 10) {
      return {
        status: "fail",
        detail: `Title is only ${page.titleLength} characters (minimum recommended: 10).`,
        evidence: { title: page.title, titleLength: page.titleLength },
      };
    }
    return { status: "pass" };
  }
);

const titleTooLong: PageRule = pageRule(
  {
    id: "BASIC_PAGE_003",
    name: "Title too long",
    category: "ON_PAGE_SEO",
    defaultSeverity: "LOW",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.title) return { status: "skip" };
    if (page.titleLength > 60) {
      return {
        status: "fail",
        detail: `Title is ${page.titleLength} characters — may be truncated in SERPs (recommended: ≤60).`,
        evidence: { title: page.title, titleLength: page.titleLength },
      };
    }
    return { status: "pass" };
  }
);

// ─── META DESCRIPTION ─────────────────────────────────────────────────────────

const missingMetaDescription: PageRule = pageRule(
  {
    id: "BASIC_PAGE_004",
    name: "Missing meta description",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.metaDescription || page.metaDescription.trim() === "") {
      return { status: "fail", detail: "Page has no meta description." };
    }
    return { status: "pass" };
  }
);

// ─── HEADINGS ─────────────────────────────────────────────────────────────────

const missingH1: PageRule = pageRule(
  {
    id: "BASIC_PAGE_005",
    name: "Missing H1",
    category: "ON_PAGE_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.h1Count === 0) {
      return { status: "fail", detail: "Page has no H1 heading." };
    }
    return { status: "pass" };
  }
);

const multipleH1s: PageRule = pageRule(
  {
    id: "BASIC_PAGE_006",
    name: "Multiple H1 headings",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.h1Count > 1) {
      return {
        status: "fail",
        detail: `Page has ${page.h1Count} H1 headings — only one is recommended.`,
        evidence: { h1Count: page.h1Count, h1Texts: page.headings.h1 },
      };
    }
    return { status: "pass" };
  }
);

const weakHeadingStructure: PageRule = pageRule(
  {
    id: "BASIC_PAGE_007",
    name: "Weak heading structure",
    category: "ON_PAGE_SEO",
    defaultSeverity: "LOW",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.wordCount < 300) return { status: "skip" }; // short pages don't need subheadings
    const hasSubheadings =
      page.headings.h2.length > 0 || page.headings.h3.length > 0;
    if (!hasSubheadings) {
      return {
        status: "fail",
        detail: "Page has no H2 or H3 subheadings despite having substantial content.",
        evidence: { wordCount: page.wordCount },
      };
    }
    return { status: "pass" };
  }
);

// ─── CANONICAL ────────────────────────────────────────────────────────────────

const missingCanonical: PageRule = pageRule(
  {
    id: "BASIC_PAGE_008",
    name: "Missing canonical tag",
    category: "TECHNICAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.canonicalUrl) {
      return {
        status: "fail",
        detail: "Page has no <link rel=\"canonical\"> tag.",
      };
    }
    return { status: "pass" };
  }
);

// ─── NOINDEX ──────────────────────────────────────────────────────────────────

const noindexPresent: PageRule = pageRule(
  {
    id: "BASIC_PAGE_009",
    name: "Noindex directive present",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    // Flag pages explicitly marked noindex — could be unintentional on important pages.
    if (page.isNoindex) {
      return {
        status: "fail",
        detail: `Page has a noindex directive (meta robots: "${page.metaRobots ?? "noindex"}"). It will not appear in search results.`,
        evidence: { metaRobots: page.metaRobots },
      };
    }
    return { status: "pass" };
  }
);

// ─── CONTENT ──────────────────────────────────────────────────────────────────

const thinContent: PageRule = pageRule(
  {
    id: "BASIC_PAGE_010",
    name: "Thin content",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.wordCount < 300) {
      return {
        status: "fail",
        detail: `Page has only ${page.wordCount} words (recommended minimum: 300).`,
        evidence: { wordCount: page.wordCount },
      };
    }
    return { status: "pass" };
  }
);

const weakIntro: PageRule = pageRule(
  {
    id: "BASIC_PAGE_011",
    name: "Weak intro — no direct answer pattern",
    category: "AEO",
    defaultSeverity: "LOW",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.wordCount < 100) return { status: "skip" }; // too short to evaluate
    if (!page.hasDirectAnswerPattern) {
      return {
        status: "fail",
        detail:
          "The page does not contain a clear direct-answer pattern in the opening content — a concise answer in the first ~150 words improves AEO / featured-snippet eligibility.",
      };
    }
    return { status: "pass" };
  }
);

const noQuestionHeadings: PageRule = pageRule(
  {
    id: "BASIC_PAGE_012",
    name: "No question-style headings",
    category: "AEO",
    defaultSeverity: "INFO",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.wordCount < 200) return { status: "skip" };
    if (!page.hasQuestionHeadings) {
      return {
        status: "fail",
        detail:
          "Page has no question-style headings (H2/H3 starting with Who/What/Why/How/When/Where/Is/Can/Does). Adding these improves AEO and FAQ snippet eligibility.",
      };
    }
    return { status: "pass" };
  }
);

// ─── IMAGES ───────────────────────────────────────────────────────────────────

const imagesMissingAlt: PageRule = pageRule(
  {
    id: "BASIC_PAGE_013",
    name: "Images missing alt text",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.imageCount === 0) return { status: "skip" };
    if (page.imagesWithoutAlt > 0) {
      const pct = Math.round((page.imagesWithoutAlt / page.imageCount) * 100);
      return {
        status: "fail",
        detail: `${page.imagesWithoutAlt} of ${page.imageCount} images (${pct}%) are missing the alt attribute.`,
        evidence: {
          imagesWithoutAlt: page.imagesWithoutAlt,
          imageCount: page.imageCount,
        },
      };
    }
    return { status: "pass" };
  }
);

// ─── LOCAL SEO ────────────────────────────────────────────────────────────────

const missingLocalSignals: PageRule = pageRule(
  {
    id: "BASIC_PAGE_014",
    name: "Missing local signals (NAP)",
    category: "LOCAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page, ctx) => {
    // Only check the homepage unless explicitly evaluating a contact page.
    if (!ctx.isHomepage) return { status: "skip" };
    if (!page.localSignals.hasNapSignals) {
      return {
        status: "fail",
        detail:
          "Homepage has no detectable NAP signals (phone number, street address, or email). These are important for local SEO.",
        evidence: {
          phones: page.localSignals.phones,
          streetAddresses: page.localSignals.streetAddresses,
          emails: page.localSignals.emails,
        },
      };
    }
    return { status: "pass" };
  }
);

const missingLocalBusinessSchema: PageRule = pageRule(
  {
    id: "BASIC_PAGE_015",
    name: "Missing LocalBusiness schema",
    category: "LOCAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page, ctx) => {
    if (!ctx.isHomepage) return { status: "skip" };
    const hasLocalBusiness = page.structuredData.some((block) => {
      const types = Array.isArray(block.type) ? block.type : [block.type];
      return types.some(
        (t) =>
          typeof t === "string" &&
          (t === "LocalBusiness" ||
            t.endsWith("LocalBusiness") ||
            // Subtypes like Restaurant, MedicalBusiness, etc.
            [
              "Restaurant",
              "Store",
              "LegalService",
              "MedicalBusiness",
              "HealthAndBeautyBusiness",
              "HomeAndConstructionBusiness",
              "SportsActivityLocation",
              "FoodEstablishment",
              "AutoDealer",
              "Hotel",
            ].includes(t))
      );
    });
    if (!hasLocalBusiness) {
      return {
        status: "fail",
        detail:
          "Homepage has no LocalBusiness (or subtype) JSON-LD schema. This is a strong local SEO ranking signal.",
      };
    }
    return { status: "pass" };
  }
);

// ─── Exports ──────────────────────────────────────────────────────────────────

export const basicPageRules: PageRule[] = [
  missingTitle,
  titleTooShort,
  titleTooLong,
  missingMetaDescription,
  missingH1,
  multipleH1s,
  weakHeadingStructure,
  missingCanonical,
  noindexPresent,
  thinContent,
  weakIntro,
  noQuestionHeadings,
  imagesMissingAlt,
  missingLocalSignals,
  missingLocalBusinessSchema,
];
