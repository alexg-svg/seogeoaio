/**
 * Shared API response types for the frontend.
 * These mirror the shapes returned by the existing API routes.
 */

export type AuditStatus =
  | "PENDING"
  | "CRAWLING"
  | "ANALYZING"
  | "COMPLETE"
  | "FAILED";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type IssueCategory =
  | "TECHNICAL_SEO"
  | "ON_PAGE_SEO"
  | "LOCAL_SEO"
  | "STRUCTURED_DATA"
  | "AEO"
  | "CONTENT";

export interface CategoryScore {
  category: IssueCategory;
  score: number;
  maxScore: number;
  issueCount: number;
}

export interface Issue {
  id: string;
  ruleId: string;
  ruleName: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scope: "PAGE" | "SITEWIDE";
  detail: string;
  scoreImpact: number;
  evidence?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  ruleId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  implementationSteps: string[];
  exampleFix: string | null;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effort: "HIGH" | "MEDIUM" | "LOW";
  priority: number;
  affectedPageCount: number;
  totalScoreImpact: number;
  affectedUrls: string[];
}

export interface AuditedPage {
  id: string;
  url: string;
  statusCode: number;
  isIndexable: boolean;
  pageScore: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  wordCount: number | null;
  internalLinkCount: number | null;
  externalLinkCount: number | null;
  imageCount: number | null;
  imagesWithoutAlt: number | null;
  canonicalUrl: string | null;
  hasCanonicalMismatch: boolean;
  redirectUrl: string | null;
  redirectChainLength: number;
  robotsBlocked: boolean;
  fetchDurationMs: number | null;
  categoryScores: Array<{ category: IssueCategory; score: number }>;
  issues: Issue[];
}

export interface AuditStatusResponse {
  id: string;
  status: AuditStatus;
  inputUrl: string;
  inputType: "HOMEPAGE" | "SITEMAP";
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  pagesCrawled: number;
  pagesSkipped: number;
  discoveredUrlCount: number;
  overallScore: number | null;
  categoryScores: Array<{ category: IssueCategory; score: number; issueCount: number }>;
}

export interface AuditDetail {
  id: string;
  status: AuditStatus;
  inputUrl: string;
  inputType: "HOMEPAGE" | "SITEMAP";
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  overallScore: number | null;
  pagesCrawled: number;
  pagesSkipped: number;
  crawlDurationMs: number | null;
  sitemapUrl: string | null;
  project: { id: string; name: string; siteUrl: string } | null;
  categoryScores: CategoryScore[];
  recommendations: Recommendation[];
  pages: AuditedPage[];
}

export interface CreateAuditResponse {
  auditId: string;
  projectId: string;
  status: AuditStatus;
  inputUrl: string;
  inputType: "HOMEPAGE" | "SITEMAP";
}
