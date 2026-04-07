/**
 * Pass 2C — MVP sitewide rules.
 *
 * 4 rules that require analysing the full set of crawled pages together.
 * All rules use the sitewideRule() factory from utils.ts.
 */

import { sitewideRule, tokenise, jaccardSimilarity } from "../utils";
import type { SitewideRule } from "../types";

// ─── DUPLICATE TITLES ─────────────────────────────────────────────────────────

const duplicateTitles: SitewideRule = sitewideRule(
  {
    id: "BASIC_SITE_001",
    name: "Duplicate title tags",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (pages) => {
    const seen = new Map<string, string[]>(); // normalised title → [url, ...]

    for (const page of pages) {
      if (!page.isIndexable || !page.title) continue;
      const key = page.title.trim().toLowerCase();
      const existing = seen.get(key) ?? [];
      existing.push(page.url);
      seen.set(key, existing);
    }

    const findings: Array<{ url: string | null; detail: string; evidence?: Record<string, unknown> }> = [];
    for (const [title, urls] of seen) {
      if (urls.length < 2) continue;
      for (const url of urls) {
        findings.push({
          url,
          detail: `Title "${title}" is shared by ${urls.length} pages.`,
          evidence: { duplicateUrls: urls },
        });
      }
    }
    return findings;
  }
);

// ─── DUPLICATE META DESCRIPTIONS ─────────────────────────────────────────────

const duplicateMetaDescriptions: SitewideRule = sitewideRule(
  {
    id: "BASIC_SITE_002",
    name: "Duplicate meta descriptions",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (pages) => {
    const seen = new Map<string, string[]>(); // normalised desc → [url, ...]

    for (const page of pages) {
      if (!page.isIndexable || !page.metaDescription) continue;
      const key = page.metaDescription.trim().toLowerCase();
      const existing = seen.get(key) ?? [];
      existing.push(page.url);
      seen.set(key, existing);
    }

    const findings: Array<{ url: string | null; detail: string; evidence?: Record<string, unknown> }> = [];
    for (const [desc, urls] of seen) {
      if (urls.length < 2) continue;
      const truncated = desc.length > 80 ? desc.slice(0, 80) + "…" : desc;
      for (const url of urls) {
        findings.push({
          url,
          detail: `Meta description "${truncated}" is shared by ${urls.length} pages.`,
          evidence: { duplicateUrls: urls },
        });
      }
    }
    return findings;
  }
);

// ─── TITLE / H1 CANNIBALIZATION ───────────────────────────────────────────────

/**
 * Flags pairs of indexable pages whose titles are very similar (Jaccard ≥ 0.7).
 * Each page in the pair produces one finding so both show up in the report.
 */
const titleCannibalization: SitewideRule = sitewideRule(
  {
    id: "BASIC_SITE_003",
    name: "Similar titles — potential keyword cannibalization",
    category: "ON_PAGE_SEO",
    defaultSeverity: "MEDIUM",
  },
  (pages) => {
    const indexable = pages.filter((p) => p.isIndexable && !!p.title);
    const THRESHOLD = 0.7;
    const reported = new Set<string>();
    const findings: Array<{ url: string | null; detail: string; evidence?: Record<string, unknown> }> = [];

    for (let i = 0; i < indexable.length; i++) {
      for (let j = i + 1; j < indexable.length; j++) {
        const a = indexable[i];
        const b = indexable[j];
        const pairKey = [a.url, b.url].sort().join("\x00");
        if (reported.has(pairKey)) continue;

        const sim = jaccardSimilarity(
          tokenise(a.title!),
          tokenise(b.title!)
        );
        if (sim >= THRESHOLD) {
          reported.add(pairKey);
          const detail = `Title is very similar to "${b.title}" (similarity: ${(sim * 100).toFixed(0)}%) — may cause keyword cannibalization.`;
          findings.push({
            url: a.url,
            detail,
            evidence: { similarUrl: b.url, similarity: sim, titleA: a.title, titleB: b.title },
          });
          findings.push({
            url: b.url,
            detail: `Title is very similar to "${a.title}" (similarity: ${(sim * 100).toFixed(0)}%) — may cause keyword cannibalization.`,
            evidence: { similarUrl: a.url, similarity: sim, titleA: b.title, titleB: a.title },
          });
        }
      }
    }
    return findings;
  }
);

// ─── REPEATED MISSING METADATA ────────────────────────────────────────────────

/**
 * Flags sites where a high proportion of indexable pages are missing both
 * a title and a meta description — indicating a systemic CMS/template issue
 * rather than individual page errors.
 */
const repeatedMissingMetadata: SitewideRule = sitewideRule(
  {
    id: "BASIC_SITE_004",
    name: "Widespread missing metadata",
    category: "TECHNICAL_SEO",
    defaultSeverity: "HIGH",
  },
  (pages) => {
    const indexable = pages.filter((p) => p.isIndexable);
    if (indexable.length < 3) return []; // not enough data to call it systemic

    const missingBoth = indexable.filter((p) => !p.title && !p.metaDescription);
    const missingTitle = indexable.filter((p) => !p.title);
    const missingDesc = indexable.filter((p) => !p.metaDescription);

    const findings: Array<{ url: string | null; detail: string; evidence?: Record<string, unknown> }> = [];

    const THRESHOLD = 0.4; // 40 % of pages

    if (missingBoth.length / indexable.length >= THRESHOLD) {
      findings.push({
        url: null,
        detail:
          `${missingBoth.length} of ${indexable.length} indexable pages (${Math.round((missingBoth.length / indexable.length) * 100)}%) are missing both a title and a meta description — this looks like a template-level issue.`,
        evidence: {
          affectedCount: missingBoth.length,
          totalIndexable: indexable.length,
          sampleUrls: missingBoth.slice(0, 5).map((p) => p.url),
        },
      });
    } else {
      // Check individually at a higher threshold (60 %)
      if (missingTitle.length / indexable.length >= 0.6) {
        findings.push({
          url: null,
          detail:
            `${missingTitle.length} of ${indexable.length} indexable pages (${Math.round((missingTitle.length / indexable.length) * 100)}%) are missing a title tag.`,
          evidence: {
            affectedCount: missingTitle.length,
            totalIndexable: indexable.length,
            sampleUrls: missingTitle.slice(0, 5).map((p) => p.url),
          },
        });
      }
      if (missingDesc.length / indexable.length >= 0.6) {
        findings.push({
          url: null,
          detail:
            `${missingDesc.length} of ${indexable.length} indexable pages (${Math.round((missingDesc.length / indexable.length) * 100)}%) are missing a meta description.`,
          evidence: {
            affectedCount: missingDesc.length,
            totalIndexable: indexable.length,
            sampleUrls: missingDesc.slice(0, 5).map((p) => p.url),
          },
        });
      }
    }

    return findings;
  }
);

// ─── Exports ──────────────────────────────────────────────────────────────────

export const basicSitewideRules: SitewideRule[] = [
  duplicateTitles,
  duplicateMetaDescriptions,
  titleCannibalization,
  repeatedMissingMetadata,
];
