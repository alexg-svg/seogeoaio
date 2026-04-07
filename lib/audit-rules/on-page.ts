import { pageRule, tokenise, jaccardSimilarity } from "./utils";
import type { PageRule } from "./types";

const ONPAGE_001: PageRule = pageRule(
  { id: "ONPAGE_001", name: "H1 Present", category: "ON_PAGE_SEO", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.h1Count === 0) {
      return { status: "fail", detail: "Page has no <h1> tag. H1 is the primary topic signal for a page." };
    }
    return { status: "pass" };
  }
);

const ONPAGE_002: PageRule = pageRule(
  { id: "ONPAGE_002", name: "Multiple H1 Tags", category: "ON_PAGE_SEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.h1Count > 1) {
      return {
        status: "fail",
        detail: `Page has ${page.h1Count} <h1> tags. Multiple H1s dilute the topical signal.`,
        evidence: { h1s: page.headings.h1, count: page.h1Count },
      };
    }
    return { status: "pass" };
  }
);

const ONPAGE_003: PageRule = pageRule(
  { id: "ONPAGE_003", name: "H1 and Title Alignment", category: "ON_PAGE_SEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable || !page.title || !page.h1) return { status: "skip" };
    const titleTokens = tokenise(page.title);
    const h1Tokens = tokenise(page.h1);
    const sim = jaccardSimilarity(titleTokens, h1Tokens);
    if (sim < 0.25) {
      return {
        status: "fail",
        detail: `H1 and title share little keyword overlap (${Math.round(sim * 100)}% similarity). Misalignment suggests unclear topic focus.`,
        evidence: { title: page.title, h1: page.h1, jaccardSimilarity: sim },
      };
    }
    return { status: "pass" };
  }
);

const ONPAGE_004: PageRule = pageRule(
  { id: "ONPAGE_004", name: "Heading Hierarchy", category: "ON_PAGE_SEO", defaultSeverity: "LOW" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.hasSkippedHeadingLevel) {
      return { status: "fail", detail: "Heading levels are skipped (e.g. H1 → H3 without H2). This harms accessibility and content structure signals." };
    }
    return { status: "pass" };
  }
);

const ONPAGE_005: PageRule = pageRule(
  { id: "ONPAGE_005", name: "Thin Content", category: "ON_PAGE_SEO", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.wordCount < 300) {
      return {
        status: "fail",
        detail: `Page body has ${page.wordCount} words (minimum 300). Thin content may be demoted or ignored by Google.`,
        evidence: { wordCount: page.wordCount },
      };
    }
    return { status: "pass" };
  }
);

const ONPAGE_006: PageRule = pageRule(
  { id: "ONPAGE_006", name: "Meta Description Present", category: "ON_PAGE_SEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.metaDescription) {
      return { status: "fail", detail: "No meta description found. Google will choose arbitrary page text as the SERP snippet." };
    }
    return { status: "pass" };
  }
);

const ONPAGE_007: PageRule = pageRule(
  { id: "ONPAGE_007", name: "Open Graph Tags Present", category: "ON_PAGE_SEO", defaultSeverity: "LOW" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const hasOg =
      !!page.openGraph["og:title"] &&
      !!page.openGraph["og:description"] &&
      !!page.openGraph["og:image"];
    if (!hasOg) {
      const missing = [
        !page.openGraph["og:title"] ? "og:title" : null,
        !page.openGraph["og:description"] ? "og:description" : null,
        !page.openGraph["og:image"] ? "og:image" : null,
      ].filter(Boolean);
      return {
        status: "fail",
        detail: `Missing Open Graph tags: ${missing.join(", ")}. OG tags control social share appearance.`,
        evidence: { missing },
      };
    }
    return { status: "pass" };
  }
);

const ONPAGE_008: PageRule = pageRule(
  { id: "ONPAGE_008", name: "Twitter Card Tags Present", category: "ON_PAGE_SEO", defaultSeverity: "LOW" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.twitterCard["twitter:card"] || !page.twitterCard["twitter:title"]) {
      return { status: "fail", detail: "Missing twitter:card or twitter:title meta tags. These control appearance when shared on X/Twitter." };
    }
    return { status: "pass" };
  }
);

const ONPAGE_009: PageRule = pageRule(
  { id: "ONPAGE_009", name: "Internal Link Count", category: "ON_PAGE_SEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable || page.isHomepage) return { status: "skip" };
    if (page.internalLinkCount < 2) {
      return {
        status: "fail",
        detail: `Page has only ${page.internalLinkCount} internal link(s). At least 2 internal links help distribute PageRank and aid crawl depth.`,
        evidence: { internalLinkCount: page.internalLinkCount },
      };
    }
    return { status: "pass" };
  }
);

const ONPAGE_010: PageRule = pageRule(
  { id: "ONPAGE_010", name: "High Volume Images Without Alt", category: "ON_PAGE_SEO", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable || page.imageCount === 0) return { status: "skip" };
    if (page.imagesWithoutAlt > 5) {
      return {
        status: "fail",
        detail: `${page.imagesWithoutAlt} images are missing alt text (threshold: 5). This signals low-quality markup and misses image-search traffic.`,
        evidence: { imagesWithoutAlt: page.imagesWithoutAlt, imageCount: page.imageCount },
      };
    }
    return { status: "pass" };
  }
);

const ONPAGE_011: PageRule = pageRule(
  { id: "ONPAGE_011", name: "Title Too Short or Generic", category: "ON_PAGE_SEO", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable || !page.title) return { status: "skip" };
    if (page.title.length < 20) {
      return {
        status: "fail",
        detail: `Title "${page.title}" is very short (${page.title.length} chars). Short titles are often rewritten by Google and provide weak ranking signals.`,
        evidence: { title: page.title, length: page.title.length },
      };
    }
    return { status: "pass" };
  }
);

export const onPageRules: PageRule[] = [
  ONPAGE_001, ONPAGE_002, ONPAGE_003, ONPAGE_004,
  ONPAGE_005, ONPAGE_006, ONPAGE_007, ONPAGE_008,
  ONPAGE_009, ONPAGE_010, ONPAGE_011,
];
