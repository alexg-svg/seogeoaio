import type { RuleResult, IssueCategory } from "@/lib/audit-rules/types";
import { SEVERITY_SCORE_IMPACT } from "@/lib/audit-rules/utils";

// Weights must sum to 1.0
export const CATEGORY_WEIGHTS: Record<IssueCategory, number> = {
  TECHNICAL_SEO: 0.30,
  ON_PAGE_SEO: 0.25,
  STRUCTURED_DATA: 0.15,
  CONTENT: 0.15,
  AEO: 0.10,
  LOCAL_SEO: 0.05,
};

export const ALL_CATEGORIES: IssueCategory[] = [
  "TECHNICAL_SEO",
  "ON_PAGE_SEO",
  "LOCAL_SEO",
  "STRUCTURED_DATA",
  "AEO",
  "CONTENT",
];

export interface CategoryScoreDetail {
  category: IssueCategory;
  score: number;       // 0–100
  maxScore: number;    // always 100
  issueCount: number;
  deduction: number;
}

export interface PageScoreResult {
  pageScore: number;
  categoryScores: CategoryScoreDetail[];
}

export interface SiteScoreResult {
  overallScore: number;
  categoryScores: CategoryScoreDetail[];
}

/**
 * Compute scores for a single page from its PAGE-scoped rule results.
 * Sitewide rules are excluded — they only affect the site-level category score.
 */
export function computePageScore(pageResults: RuleResult[]): PageScoreResult {
  const pageIssues = pageResults.filter(
    (r) => r.scope === "PAGE" && r.status === "fail"
  );

  const categoryScores: CategoryScoreDetail[] = ALL_CATEGORIES.map((cat) => {
    const catIssues = pageIssues.filter((r) => r.category === cat);
    // One deduction per rule (ruleId) — prevent duplicate counting if a rule
    // somehow fires twice for the same page
    const uniqueByRule = deduplicateByRuleId(catIssues);
    const deduction = uniqueByRule.reduce((sum, r) => sum + r.scoreImpact, 0);
    const score = Math.max(0, 100 - deduction);
    return {
      category: cat,
      score,
      maxScore: 100,
      issueCount: uniqueByRule.length,
      deduction,
    };
  });

  const pageScore = computeWeightedScore(categoryScores);
  return { pageScore, categoryScores };
}

/**
 * Compute site-level scores by:
 * 1. Averaging page category scores across all indexable pages.
 * 2. Applying sitewide issue deductions on top.
 */
export function computeSiteScore(
  pageScores: PageScoreResult[],
  sitewideResults: RuleResult[]
): SiteScoreResult {
  const sitewideIssues = sitewideResults.filter((r) => r.status === "fail");

  const categoryScores: CategoryScoreDetail[] = ALL_CATEGORIES.map((cat) => {
    // Average page scores for this category (indexable pages only, represented
    // by having a pageScore entry)
    const catPageScores = pageScores.map(
      (ps) => ps.categoryScores.find((c) => c.category === cat)?.score ?? 100
    );
    const avgPageScore =
      catPageScores.length > 0
        ? catPageScores.reduce((a, b) => a + b, 0) / catPageScores.length
        : 100;

    // Apply sitewide deductions once (deduped by ruleId)
    const catSitewideIssues = deduplicateByRuleId(
      sitewideIssues.filter((r) => r.category === cat)
    );
    const sitewideDeduction = catSitewideIssues.reduce(
      (sum, r) => sum + r.scoreImpact,
      0
    );

    const score = Math.max(0, avgPageScore - sitewideDeduction);
    return {
      category: cat,
      score,
      maxScore: 100,
      issueCount: catSitewideIssues.length,
      deduction: sitewideDeduction,
    };
  });

  const overallScore = computeWeightedScore(categoryScores);
  return { overallScore, categoryScores };
}

function computeWeightedScore(scores: CategoryScoreDetail[]): number {
  const total = scores.reduce(
    (sum, cs) => sum + cs.score * CATEGORY_WEIGHTS[cs.category],
    0
  );
  return Math.round(total * 10) / 10; // round to 1 decimal
}

function deduplicateByRuleId(results: RuleResult[]): RuleResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.ruleId)) return false;
    seen.add(r.ruleId);
    return true;
  });
}
