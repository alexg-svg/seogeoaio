import type {
  RuleResult,
  IssueCategory,
  IssueSeverity,
  PageRule,
  SitewideRule,
} from "./types";

export const SEVERITY_SCORE_IMPACT: Record<IssueSeverity, number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
  INFO: 0,
};

type RuleMeta = {
  id: string;
  name: string;
  category: IssueCategory;
  defaultSeverity: IssueSeverity;
  scope: "PAGE" | "SITEWIDE";
};

function makeResult(
  meta: RuleMeta,
  status: "pass" | "fail" | "skip",
  url: string | null,
  detail = "",
  evidence: Record<string, unknown> | null = null
): RuleResult {
  return {
    ruleId: meta.id,
    ruleName: meta.name,
    category: meta.category,
    severity: meta.defaultSeverity,
    scope: meta.scope,
    status,
    url,
    detail,
    evidence,
    scoreImpact:
      status === "fail" ? SEVERITY_SCORE_IMPACT[meta.defaultSeverity] : 0,
  };
}

/** Helpers exported for use inside rule evaluate() functions. */
export const pass = (meta: RuleMeta, url: string | null): RuleResult =>
  makeResult(meta, "pass", url);

export const fail = (
  meta: RuleMeta,
  url: string | null,
  detail: string,
  evidence: Record<string, unknown> | null = null
): RuleResult => makeResult(meta, "fail", url, detail, evidence);

export const skip = (meta: RuleMeta, url: string | null): RuleResult =>
  makeResult(meta, "skip", url);

/**
 * Factory that builds a PageRule object.
 * The evaluate callback returns only { status, detail?, evidence? } and
 * the factory wraps it into a full RuleResult — reducing boilerplate.
 */
export function pageRule(
  meta: Omit<PageRule, "evaluate" | "scope">,
  evaluateFn: (
    page: import("@/lib/parser/index").ParsedPage,
    ctx: import("./types").PageRuleContext
  ) => { status: "pass" | "fail" | "skip"; detail?: string; evidence?: Record<string, unknown> }
): PageRule {
  const fullMeta: RuleMeta = { ...meta, scope: "PAGE" };
  return {
    ...fullMeta,
    scope: "PAGE",
    evaluate(page, ctx) {
      const r = evaluateFn(page, ctx);
      return makeResult(fullMeta, r.status, page.url, r.detail ?? "", r.evidence ?? null);
    },
  };
}

/**
 * Factory that builds a SitewideRule object.
 * The evaluate callback returns an array of minimal result objects.
 */
export function sitewideRule(
  meta: Omit<SitewideRule, "evaluate" | "scope">,
  evaluateFn: (
    pages: import("@/lib/parser/index").ParsedPage[],
    ctx: import("./types").SitewideContext
  ) => Array<{ url: string | null; detail: string; evidence?: Record<string, unknown> }>
): SitewideRule {
  const fullMeta: RuleMeta = { ...meta, scope: "SITEWIDE" };
  return {
    ...fullMeta,
    scope: "SITEWIDE",
    evaluate(pages, ctx) {
      const findings = evaluateFn(pages, ctx);
      if (findings.length === 0) {
        return [makeResult(fullMeta, "pass", null)];
      }
      return findings.map((f) =>
        makeResult(fullMeta, "fail", f.url, f.detail, f.evidence ?? null)
      );
    },
  };
}

/** Tokenise a string into lowercase meaningful words (strips punctuation). */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Jaccard similarity between two token sets. */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
