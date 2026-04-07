import { pageRule, sitewideRule, tokenise, jaccardSimilarity } from "./utils";
import type { PageRule, SitewideRule } from "./types";

// ─── Page-Scoped Technical Rules ──────────────────────────────

const TECH_001: PageRule = pageRule(
  {
    id: "TECH_001",
    name: "HTTPS Enforcement",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    if (!page.url.startsWith("https://")) {
      return { status: "fail", detail: `Page is served over HTTP. URL: ${page.url}`, evidence: { url: page.url } };
    }
    return { status: "pass" };
  }
);

const TECH_002: PageRule = pageRule(
  {
    id: "TECH_002",
    name: "Canonical Tag Present",
    category: "TECHNICAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.canonicalUrl) {
      return { status: "fail", detail: "No <link rel=\"canonical\"> tag found." };
    }
    return { status: "pass" };
  }
);

const TECH_003: PageRule = pageRule(
  {
    id: "TECH_003",
    name: "Canonical Mismatch",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    if (!page.isIndexable || !page.canonicalUrl) return { status: "skip" };
    if (page.hasCanonicalMismatch) {
      return {
        status: "fail",
        detail: `Canonical (${page.canonicalUrl}) differs from page URL (${page.url}). Google may index the canonical instead.`,
        evidence: { pageUrl: page.url, canonicalUrl: page.canonicalUrl },
      };
    }
    return { status: "pass" };
  }
);

const TECH_004: PageRule = pageRule(
  {
    id: "TECH_004",
    name: "Noindex Detected",
    category: "TECHNICAL_SEO",
    defaultSeverity: "CRITICAL",
  },
  (page) => {
    if (page.isNoindex) {
      const robotsValue = page.metaTags["robots"] ?? "(unknown)";
      return {
        status: "fail",
        detail: `Page has noindex directive: "${robotsValue}". This page will not be indexed by Google.`,
        evidence: { robots: robotsValue },
      };
    }
    return { status: "pass" };
  }
);

const TECH_005: PageRule = pageRule(
  {
    id: "TECH_005",
    name: "HTTP Status Non-200",
    category: "TECHNICAL_SEO",
    defaultSeverity: "CRITICAL",
  },
  (page) => {
    if (page.statusCode !== 200 && page.statusCode !== 0) {
      return {
        status: "fail",
        detail: `Page returned HTTP ${page.statusCode}. Non-200 pages are not indexed.`,
        evidence: { statusCode: page.statusCode },
      };
    }
    if (page.statusCode === 0) {
      return {
        status: "fail",
        detail: `Page could not be fetched: ${page.error ?? "unknown error"}.`,
        evidence: { error: page.error },
      };
    }
    return { status: "pass" };
  }
);

const TECH_006: PageRule = pageRule(
  {
    id: "TECH_006",
    name: "Redirect Chain",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    if (page.redirectChainLength > 1) {
      return {
        status: "fail",
        detail: `Page goes through ${page.redirectChainLength} redirects. Each hop wastes crawl budget and loses link equity.`,
        evidence: { redirectChainLength: page.redirectChainLength, finalUrl: page.redirectUrl },
      };
    }
    return { status: "pass" };
  }
);

const TECH_007: PageRule = pageRule(
  {
    id: "TECH_007",
    name: "Missing Title Tag",
    category: "TECHNICAL_SEO",
    defaultSeverity: "CRITICAL",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.title || page.title.trim() === "") {
      return { status: "fail", detail: "Page has no <title> tag. Title is the strongest on-page ranking signal." };
    }
    return { status: "pass" };
  }
);

const TECH_008: PageRule = pageRule(
  {
    id: "TECH_008",
    name: "Title Tag Length",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    if (!page.isIndexable || !page.title) return { status: "skip" };
    const len = page.title.length;
    if (len < 10) {
      return {
        status: "fail",
        detail: `Title is too short (${len} chars, minimum 10). Too-short titles provide no ranking signal.`,
        evidence: { length: len, title: page.title },
      };
    }
    if (len > 60) {
      return {
        status: "fail",
        detail: `Title is ${len} characters (limit: 60). Google will truncate it in search results.`,
        evidence: { length: len, title: page.title },
      };
    }
    return { status: "pass" };
  }
);

const TECH_009: PageRule = pageRule(
  {
    id: "TECH_009",
    name: "Meta Description Length",
    category: "TECHNICAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.metaDescription) return { status: "skip" }; // ONPAGE_006 covers absence
    const len = page.metaDescription.length;
    if (len < 50) {
      return {
        status: "fail",
        detail: `Meta description is too short (${len} chars, minimum 50). Provide a complete description.`,
        evidence: { length: len },
      };
    }
    if (len > 160) {
      return {
        status: "fail",
        detail: `Meta description is ${len} characters (limit: 160). Google will truncate it.`,
        evidence: { length: len, excerpt: page.metaDescription.slice(0, 80) + "…" },
      };
    }
    return { status: "pass" };
  }
);

const TECH_010: PageRule = pageRule(
  {
    id: "TECH_010",
    name: "Viewport Meta Tag",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.hasViewport) {
      return { status: "fail", detail: "Missing <meta name=\"viewport\"> tag. Required for mobile-friendly classification." };
    }
    return { status: "pass" };
  }
);

const TECH_011: PageRule = pageRule(
  {
    id: "TECH_011",
    name: "Image Alt Text Coverage",
    category: "TECHNICAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (page) => {
    if (page.imageCount === 0) return { status: "skip" };
    const ratio = page.imagesWithoutAlt / page.imageCount;
    if (ratio > 0.2) {
      return {
        status: "fail",
        detail: `${page.imagesWithoutAlt} of ${page.imageCount} images (${Math.round(ratio * 100)}%) are missing alt attributes.`,
        evidence: { missingAlt: page.imagesWithoutAlt, total: page.imageCount },
      };
    }
    return { status: "pass" };
  }
);

// ─── Sitewide Technical Rules ─────────────────────────────────

const TECH_012: SitewideRule = sitewideRule(
  {
    id: "TECH_012",
    name: "Robots.txt Accessible",
    category: "TECHNICAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (pages, ctx) => {
    if (!ctx.robots.accessible) {
      return [{ url: null, detail: "robots.txt returned a non-200 response. Google cannot crawl efficiently without it." }];
    }
    return [];
  }
);

const TECH_013: SitewideRule = sitewideRule(
  {
    id: "TECH_013",
    name: "Sitemap Declared in Robots.txt",
    category: "TECHNICAL_SEO",
    defaultSeverity: "LOW",
  },
  (pages, ctx) => {
    if (ctx.robots.accessible && !ctx.robots.hasSitemapDirective) {
      return [{ url: null, detail: "robots.txt does not include a Sitemap: directive. Add it to help search engines discover all URLs." }];
    }
    return [];
  }
);

const TECH_014: SitewideRule = sitewideRule(
  {
    id: "TECH_014",
    name: "Duplicate Title Tags",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (pages) => {
    const titleMap = new Map<string, string[]>();
    for (const page of pages) {
      if (!page.isIndexable || !page.title) continue;
      const key = page.title.trim().toLowerCase();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(page.url);
    }
    const findings: Array<{ url: null; detail: string; evidence: Record<string, unknown> }> = [];
    for (const [title, urls] of titleMap) {
      if (urls.length > 1) {
        findings.push({
          url: null,
          detail: `${urls.length} pages share the same title: "${title.slice(0, 60)}${title.length > 60 ? "…" : ""}"`,
          evidence: { title, urls },
        });
      }
    }
    return findings;
  }
);

const TECH_015: SitewideRule = sitewideRule(
  {
    id: "TECH_015",
    name: "Duplicate Meta Descriptions",
    category: "TECHNICAL_SEO",
    defaultSeverity: "MEDIUM",
  },
  (pages) => {
    const descMap = new Map<string, string[]>();
    for (const page of pages) {
      if (!page.isIndexable || !page.metaDescription) continue;
      const key = page.metaDescription.trim().toLowerCase();
      if (!descMap.has(key)) descMap.set(key, []);
      descMap.get(key)!.push(page.url);
    }
    const findings: Array<{ url: null; detail: string; evidence: Record<string, unknown> }> = [];
    for (const [desc, urls] of descMap) {
      if (urls.length > 1) {
        findings.push({
          url: null,
          detail: `${urls.length} pages share the same meta description: "${desc.slice(0, 80)}…"`,
          evidence: { description: desc, urls },
        });
      }
    }
    return findings;
  }
);

export const technicalRules: Array<PageRule | SitewideRule> = [
  TECH_001, TECH_002, TECH_003, TECH_004, TECH_005,
  TECH_006, TECH_007, TECH_008, TECH_009, TECH_010,
  TECH_011, TECH_012, TECH_013, TECH_014, TECH_015,
];
