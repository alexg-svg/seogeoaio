/**
 * runSitewideRules — evaluates all registered SITEWIDE-scoped rules against
 * the full array of ParsedPages and returns a SitewideRunResult.
 *
 * Fingerprint formula: SHA-256( auditId + "\x00" + ruleId + "\x00" + url )
 * For sitewide rules that have no per-page URL, url is the empty string.
 */

import { createHash } from "crypto";
import type { ParsedPage } from "@/lib/parser/index";
import type {
  SitewideRule,
  SitewideContext,
  IssueOutput,
  SitewideRunResult,
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
 * @param pages    - All parsed pages in the audit.
 * @param rules    - Array of SitewideRule objects to run.
 * @param ctx      - Sitewide context (optional robots).
 */
export function runSitewideRules(
  auditId: string,
  pages: ParsedPage[],
  rules: SitewideRule[],
  ctx: SitewideContext = {}
): SitewideRunResult {
  const issues: IssueOutput[] = [];

  for (const rule of rules) {
    let results;
    try {
      results = rule.evaluate(pages, ctx);
    } catch (err) {
      console.error(`[runSitewideRules] Rule ${rule.id} threw:`, err);
      continue;
    }

    for (const result of results) {
      if (result.status !== "fail") continue;
      issues.push({
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        category: result.category,
        severity: result.severity,
        scope: "SITEWIDE",
        url: result.url,
        detail: result.detail,
        evidence: result.evidence,
        scoreImpact: result.scoreImpact,
        fingerprint: fingerprint(auditId, result.ruleId, result.url),
      });
    }
  }

  return { issues };
}
