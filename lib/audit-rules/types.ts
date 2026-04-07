import type { ParsedPage } from "@/lib/parser/index";
import type { RobotsResult } from "@/lib/crawler/robots";

// ─── Enums (mirrored as string literals to avoid Prisma import in this layer) ─

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type IssueCategory =
  | "TECHNICAL_SEO"
  | "ON_PAGE_SEO"
  | "LOCAL_SEO"
  | "STRUCTURED_DATA"
  | "AEO"
  | "CONTENT";

// ─── Rule result (internal, produced by each rule's evaluate()) ───────────────

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scope: "PAGE" | "SITEWIDE";
  status: "pass" | "fail" | "skip";
  url: string | null;
  detail: string;
  evidence: Record<string, unknown> | null;
  scoreImpact: number;
}

// ─── Issue output (external, ready for persistence / scoring) ─────────────────
//
// Produced by the runners from failing RuleResult objects.
// The fingerprint is stable across re-runs of the same audit so that
// prisma.issue.upsert() can be used safely.

export interface IssueOutput {
  ruleId: string;
  ruleName: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scope: "PAGE" | "SITEWIDE";
  /** Page URL for page-scoped issues; null for sitewide issues. */
  url: string | null;
  detail: string;
  evidence: Record<string, unknown> | null;
  scoreImpact: number;
  /** SHA-256 hex of "auditId\x00ruleId\x00url" for idempotent upserts. */
  fingerprint: string;
}

// ─── Rule contexts ────────────────────────────────────────────────────────────
//
// `robots` is optional so rules can be evaluated without a live crawl context
// (e.g. in unit tests or when called directly via parsePage()).

export interface PageRuleContext {
  isHomepage: boolean;
  robots?: RobotsResult | null;
}

export interface SitewideContext {
  robots?: RobotsResult | null;
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

export interface PageRule {
  id: string;
  name: string;
  category: IssueCategory;
  scope: "PAGE";
  defaultSeverity: IssueSeverity;
  evaluate(page: ParsedPage, ctx: PageRuleContext): RuleResult;
}

export interface SitewideRule {
  id: string;
  name: string;
  category: IssueCategory;
  scope: "SITEWIDE";
  defaultSeverity: IssueSeverity;
  evaluate(pages: ParsedPage[], ctx: SitewideContext): RuleResult[];
}

export type AuditRule = PageRule | SitewideRule;

// ─── Runner result shapes ─────────────────────────────────────────────────────

export interface PageRuleRunResult {
  url: string;
  /** Only contains issues where status === "fail". */
  issues: IssueOutput[];
  counts: {
    pass: number;
    fail: number;
    skip: number;
  };
}

export interface SitewideRunResult {
  issues: IssueOutput[];
}

export interface AuditRunResult {
  pageResults: PageRuleRunResult[];
  sitewideResult: SitewideRunResult;
  /** Convenience: all issues (page + sitewide) in insertion order. */
  allIssues: IssueOutput[];
}
