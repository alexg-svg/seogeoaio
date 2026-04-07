import type { RuleResult } from "@/lib/audit-rules/types";
import type { IssueOutput } from "@/lib/audit-rules/types";
import {
  CATEGORY_WEIGHTS,
  ALL_CATEGORIES,
  type CategoryScoreDetail,
  type PageScoreResult,
  type SiteScoreResult,
} from "./types";

export { CATEGORY_WEIGHTS, ALL_CATEGORIES };
export type { CategoryScoreDetail, PageScoreResult, SiteScoreResult };

// ─── Scoring from RuleResult[] (used by tests / legacy paths) ────────────────

/**
 * Compute per-category and overall score for a single page.
 * Accepts the full RuleResult[] (pass + fail + skip) from the rule runner.
 */
export function computePageScore(pageResults: RuleResult[]): PageScoreResult {
  const failedPageRules = pageResults.filter(
    (r) => r.scope === "PAGE" && r.status === "fail"
  );
  return _scoreFromFailures(failedPageRules);
}

/**
 * Compute site-level scores by averaging per-page category scores and then
 * applying sitewide deductions on top.
 * Accepts the full RuleResult[] (pass + fail + skip) for sitewide rules.
 */
export function computeSiteScore(
  pageScores: PageScoreResult[],
  sitewideResults: RuleResult[]
): SiteScoreResult {
  const sitewideIssues = sitewideResults.filter((r) => r.status === "fail");
  return _siteScoreFromAveragedPages(pageScores, sitewideIssues);
}

// ─── Scoring from IssueOutput[] (used by the audit runner) ───────────────────

/**
 * Compute per-category and overall score for a single page from its pre-filtered
 * IssueOutput array (only failures, PAGE scope).
 */
export function computePageScoreFromIssues(
  pageIssues: IssueOutput[]
): PageScoreResult {
  const filtered = pageIssues.filter((i) => i.scope === "PAGE");
  return _scoreFromFailures(filtered);
}

/**
 * Compute site-level scores from per-page PageScoreResult[] and the
 * flat array of sitewide IssueOutput objects.
 */
export function computeSiteScoreFromIssues(
  pageScores: PageScoreResult[],
  sitewideIssues: IssueOutput[]
): SiteScoreResult {
  const filtered = sitewideIssues.filter((i) => i.scope === "SITEWIDE");
  return _siteScoreFromAveragedPages(pageScores, filtered);
}

// ─── Internals ────────────────────────────────────────────────────────────────

type Scorable = Pick<RuleResult | IssueOutput, "ruleId" | "category" | "scoreImpact">;

function _scoreFromFailures(failures: Scorable[]): PageScoreResult {
  const categoryScores: CategoryScoreDetail[] = ALL_CATEGORIES.map((cat) => {
    const catIssues = deduplicateByRuleId(
      failures.filter((r) => r.category === cat)
    );
    const deduction = catIssues.reduce((sum, r) => sum + r.scoreImpact, 0);
    return {
      category: cat,
      score: Math.max(0, 100 - deduction),
      maxScore: 100,
      issueCount: catIssues.length,
      deduction,
    };
  });

  return {
    pageScore: weightedScore(categoryScores),
    categoryScores,
  };
}

function _siteScoreFromAveragedPages(
  pageScores: PageScoreResult[],
  sitewideFailures: Scorable[]
): SiteScoreResult {
  const categoryScores: CategoryScoreDetail[] = ALL_CATEGORIES.map((cat) => {
    const avgPage =
      pageScores.length > 0
        ? pageScores
            .map((ps) => ps.categoryScores.find((c) => c.category === cat)?.score ?? 100)
            .reduce((a, b) => a + b, 0) / pageScores.length
        : 100;

    const catSitewide = deduplicateByRuleId(
      sitewideFailures.filter((r) => r.category === cat)
    );
    const sitewideDeduction = catSitewide.reduce(
      (sum, r) => sum + r.scoreImpact,
      0
    );

    return {
      category: cat,
      score: Math.max(0, avgPage - sitewideDeduction),
      maxScore: 100,
      issueCount: catSitewide.length,
      deduction: sitewideDeduction,
    };
  });

  return {
    overallScore: weightedScore(categoryScores),
    categoryScores,
  };
}

function weightedScore(scores: CategoryScoreDetail[]): number {
  const total = scores.reduce(
    (sum, cs) => sum + cs.score * CATEGORY_WEIGHTS[cs.category],
    0
  );
  return Math.round(total * 10) / 10;
}

function deduplicateByRuleId<T extends { ruleId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((r) => {
    if (seen.has(r.ruleId)) return false;
    seen.add(r.ruleId);
    return true;
  });
}
