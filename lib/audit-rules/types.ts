import type { ParsedPage } from "@/lib/parser/index";
import type { RobotsResult } from "@/lib/crawler/robots";

// Mirror DB enums as TypeScript string literals
export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type IssueCategory =
  | "TECHNICAL_SEO"
  | "ON_PAGE_SEO"
  | "LOCAL_SEO"
  | "STRUCTURED_DATA"
  | "AEO"
  | "CONTENT";

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

export interface PageRuleContext {
  isHomepage: boolean;
  robots: RobotsResult;
}

export interface SitewideContext {
  robots: RobotsResult;
}

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
