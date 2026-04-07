/**
 * runPageRules — evaluates all registered PAGE-scoped rules against a single
 * ParsedPage and returns a PageRuleRunResult with fingerprinted IssueOutputs.
 *
 * Fingerprint formula: SHA-256( auditId + "\x00" + ruleId + "\x00" + url )
 * This is stable across re-runs so callers can use prisma.issue.upsert().
 */

import { createHash } from "crypto";
import type { ParsedPage } from "@/lib/parser/index";
import type {
  PageRule,
  PageRuleContext,
  IssueOutput,
  PageRuleRunResult,
} from "./types";

// ─── Fingerprint helper ───────────────────────────────────────────────────────

function fingerprint(auditId: string, ruleId: string, url: string | null): string {
  return createHash("sha256")
    .update(`${auditId}\x00${ruleId}\x00${url ?? ""}`)
    .digest("hex");
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * @param auditId  - Prisma Audit.id — used only for fingerprint generation.
 * @param page     - Parsed page to evaluate.
 * @param rules    - Array of PageRule objects to run (defaults to PAGE_RULES).
 * @param ctx      - Rule context (isHomepage, optional robots).
 */
export function runPageRules(
  auditId: string,
  page: ParsedPage,
  rules: PageRule[],
  ctx: PageRuleContext
): PageRuleRunResult {
  const issues: IssueOutput[] = [];
  let pass = 0;
  let fail = 0;
  let skip = 0;

  for (const rule of rules) {
    let result;
    try {
      result = rule.evaluate(page, ctx);
    } catch (err) {
      // Never let a single rule crash the whole run.
      console.error(`[runPageRules] Rule ${rule.id} threw:`, err);
      skip++;
      continue;
    }

    switch (result.status) {
      case "pass":
        pass++;
        break;
      case "skip":
        skip++;
        break;
      case "fail":
        fail++;
        issues.push({
          ruleId: result.ruleId,
          ruleName: result.ruleName,
          category: result.category,
          severity: result.severity,
          scope: "PAGE",
          url: page.url,
          detail: result.detail,
          evidence: result.evidence,
          scoreImpact: result.scoreImpact,
          fingerprint: fingerprint(auditId, result.ruleId, page.url),
        });
        break;
    }
  }

  return {
    url: page.url,
    issues,
    counts: { pass, fail, skip },
  };
}
