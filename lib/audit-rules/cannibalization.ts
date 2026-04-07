import { sitewideRule, tokenise, jaccardSimilarity } from "./utils";
import type { SitewideRule } from "./types";

const CONTENT_001: SitewideRule = sitewideRule(
  { id: "CONTENT_001", name: "Title Cannibalization", category: "CONTENT", defaultSeverity: "HIGH" },
  (pages) => {
    const indexable = pages.filter((p) => p.isIndexable && p.title);
    const findings: Array<{ url: null; detail: string; evidence: Record<string, unknown> }> = [];

    for (let i = 0; i < indexable.length; i++) {
      for (let j = i + 1; j < indexable.length; j++) {
        const a = indexable[i];
        const b = indexable[j];
        const sim = jaccardSimilarity(tokenise(a.title!), tokenise(b.title!));
        if (sim >= 0.7) {
          findings.push({
            url: null,
            detail: `Title cannibalization detected between "${a.title}" and "${b.title}" (${Math.round(sim * 100)}% similarity). Both pages may compete for the same query.`,
            evidence: {
              urlA: a.url,
              urlB: b.url,
              titleA: a.title,
              titleB: b.title,
              similarity: sim,
            },
          });
        }
      }
    }
    // Cap at 10 findings to avoid noise
    return findings.slice(0, 10);
  }
);

const CONTENT_002: SitewideRule = sitewideRule(
  { id: "CONTENT_002", name: "URL Similarity Pairs", category: "CONTENT", defaultSeverity: "MEDIUM" },
  (pages) => {
    const urls = pages.map((p) => p.url);
    const findings: Array<{ url: null; detail: string; evidence: Record<string, unknown> }> = [];

    for (let i = 0; i < urls.length; i++) {
      for (let j = i + 1; j < urls.length; j++) {
        const a = urls[i].replace(/\/+$/, "").toLowerCase();
        const b = urls[j].replace(/\/+$/, "").toLowerCase();
        // Check if URLs differ only in trailing "s", "-2", or numeric suffix
        const normaliseSlug = (u: string) => u.replace(/s$/, "").replace(/-\d+$/, "").replace(/\/$/, "");
        if (normaliseSlug(a) === normaliseSlug(b) && a !== b) {
          findings.push({
            url: null,
            detail: `Near-duplicate URLs detected: "${urls[i]}" and "${urls[j]}". This usually indicates an accidental duplicate or orphaned variant page.`,
            evidence: { urlA: urls[i], urlB: urls[j] },
          });
        }
      }
    }
    return findings.slice(0, 10);
  }
);

const CONTENT_003: SitewideRule = sitewideRule(
  { id: "CONTENT_003", name: "Orphaned Pages", category: "CONTENT", defaultSeverity: "MEDIUM" },
  (pages) => {
    // Build a set of all URLs that appear as internal links on other pages
    const linkedUrls = new Set<string>();
    for (const page of pages) {
      for (const link of page.internalLinks) {
        linkedUrls.add(link);
      }
    }

    const orphans = pages.filter(
      (p) =>
        !p.isHomepage &&
        p.isIndexable &&
        !linkedUrls.has(p.url)
    );

    return orphans.slice(0, 10).map((p) => ({
      url: null as null,
      detail: `"${p.url}" appears to be an orphaned page — no internal links from other crawled pages point to it. Orphaned pages receive no PageRank distribution.`,
      evidence: { orphanUrl: p.url },
    }));
  }
);

const CONTENT_004: SitewideRule = sitewideRule(
  { id: "CONTENT_004", name: "H1 Cannibalization", category: "CONTENT", defaultSeverity: "HIGH" },
  (pages) => {
    const h1Map = new Map<string, string[]>();
    for (const page of pages) {
      if (!page.isIndexable || !page.h1) continue;
      const key = page.h1.trim().toLowerCase();
      if (!h1Map.has(key)) h1Map.set(key, []);
      h1Map.get(key)!.push(page.url);
    }
    const findings: Array<{ url: null; detail: string; evidence: Record<string, unknown> }> = [];
    for (const [h1, urls] of h1Map) {
      if (urls.length > 1) {
        findings.push({
          url: null,
          detail: `${urls.length} pages share the same H1: "${h1.slice(0, 60)}". Identical H1s are a strong cannibalization signal.`,
          evidence: { h1, urls },
        });
      }
    }
    return findings.slice(0, 10);
  }
);

const CONTENT_005: SitewideRule = sitewideRule(
  { id: "CONTENT_005", name: "Thin Content Cluster", category: "CONTENT", defaultSeverity: "HIGH" },
  (pages) => {
    const thinPages = pages.filter(
      (p) => p.isIndexable && (p.wordCount ?? 0) < 500 && p.title
    );
    if (thinPages.length < 3) return [];

    // Check if thin pages share keyword overlap in titles
    const thinWithOverlap: typeof thinPages = [];
    for (let i = 0; i < thinPages.length; i++) {
      for (let j = i + 1; j < thinPages.length; j++) {
        const sim = jaccardSimilarity(
          tokenise(thinPages[i].title!),
          tokenise(thinPages[j].title!)
        );
        if (sim >= 0.4) {
          if (!thinWithOverlap.includes(thinPages[i])) thinWithOverlap.push(thinPages[i]);
          if (!thinWithOverlap.includes(thinPages[j])) thinWithOverlap.push(thinPages[j]);
        }
      }
    }

    if (thinWithOverlap.length >= 3) {
      return [
        {
          url: null as null,
          detail: `${thinWithOverlap.length} thin pages (<500 words) share keyword overlap in their titles. This is a Panda-style quality risk — consider consolidating these pages.`,
          evidence: {
            count: thinWithOverlap.length,
            urls: thinWithOverlap.slice(0, 5).map((p) => p.url),
            titles: thinWithOverlap.slice(0, 5).map((p) => p.title),
          },
        },
      ];
    }
    return [];
  }
);

const CONTENT_006: SitewideRule = sitewideRule(
  { id: "CONTENT_006", name: "No Crawlable Pages", category: "CONTENT", defaultSeverity: "CRITICAL" },
  (pages) => {
    const indexableCount = pages.filter((p) => p.isIndexable).length;
    if (indexableCount === 0 && pages.length > 0) {
      return [
        {
          url: null as null,
          detail: `All ${pages.length} crawled pages are non-indexable (blocked by robots.txt, noindex, or error). The site may be entirely invisible to search engines.`,
          evidence: { totalPages: pages.length, indexablePages: 0 },
        },
      ];
    }
    return [];
  }
);

export const cannibalizationRules: SitewideRule[] = [
  CONTENT_001, CONTENT_002, CONTENT_003,
  CONTENT_004, CONTENT_005, CONTENT_006,
];
