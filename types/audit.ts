// ============================================================
// Shared TypeScript Interfaces — SEO Audit App MVP
// These types define the contracts between every layer of the
// audit pipeline. Import from here; do not define inline.
// ============================================================

// ─── Enums (mirror Prisma enums for use in application code) ─

export type AuditStatus = "PENDING" | "CRAWLING" | "ANALYZING" | "COMPLETE" | "FAILED";
export type AuditInputType = "HOMEPAGE" | "SITEMAP";
export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type IssueCategory =
  | "TECHNICAL_SEO"
  | "ON_PAGE_SEO"
  | "LOCAL_SEO"
  | "STRUCTURED_DATA"
  | "AEO"
  | "CONTENT";
export type IssueScope = "PAGE" | "SITEWIDE";
export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";

// ─── 1. Parsed Page Data ─────────────────────────────────────

/**
 * The output of the Parser layer for a single crawled page.
 * This is the primary input to all PAGE-scoped rules.
 * All fields are nullable/optional because fetch failures or
 * malformed HTML may leave them absent.
 */
export interface ParsedPage {
  // Crawl metadata
  url: string;             // final URL (after redirects)
  originalUrl: string;     // URL as discovered in sitemap or link
  statusCode: number;
  redirectUrl: string | null;
  redirectChainLength: number;
  fetchDurationMs: number;
  fetchedAt: string;       // ISO 8601

  // Indexability
  isIndexable: boolean;    // false if noindex or robots-blocked
  robotsBlocked: boolean;

  // Head signals
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  hasCanonicalMismatch: boolean;

  metaTags: Record<string, string>;  // name/property → content
  openGraph: Record<string, string>; // og:* → content
  twitterCard: Record<string, string>;

  // Body signals
  h1: string | null;       // first H1 text
  h1Count: number;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };

  wordCount: number;
  internalLinks: string[]; // normalised absolute URLs (same domain)
  externalLinks: string[]; // absolute URLs (different domain)
  internalLinkCount: number;
  externalLinkCount: number;

  images: Array<{ src: string; alt: string | null }>;
  imageCount: number;
  imagesWithoutAlt: number;

  // Structured data (array of parsed JSON-LD objects; may be empty)
  structuredData: StructuredDataBlock[];

  // Raw HTML (retained for content-pattern rules; not persisted to DB)
  rawHtml: string;

  // Derived text (stripped HTML; used for word count and content rules)
  textContent: string;
}

/**
 * A single parsed JSON-LD block from the page.
 * @context and @type are extracted for quick rule evaluation.
 */
export interface StructuredDataBlock {
  context: string;        // value of @context
  type: string | string[]; // value of @type
  raw: Record<string, unknown>; // full parsed object
  parseError: string | null;    // set if JSON.parse failed
}

// ─── 2. Rule Definition ──────────────────────────────────────

/**
 * A rule's static metadata. Registered in lib/audit/rules/index.ts.
 * The `evaluate` function is the implementation.
 */
export interface RuleDefinition {
  id: string;                // e.g. "TECH_010"
  name: string;              // human label
  category: IssueCategory;
  scope: IssueScope;
  defaultSeverity: IssueSeverity;
  description: string;       // what the rule checks (one sentence)
  whyItMatters: string;      // ranking/quality rationale

  /**
   * For PAGE rules: called once per page with a single ParsedPage.
   * For SITE rules: called once with all ParsedPage[] after crawl completes.
   * Must be synchronous and deterministic.
   */
  evaluate(
    input: ParsedPage | ParsedPage[]
  ): RuleResult | RuleResult[];
}

/**
 * The outcome of evaluating a single rule against a page (or site).
 * Sitewide rules may return multiple RuleResult items (one per affected page pair).
 */
export interface RuleResult {
  ruleId: string;
  ruleName: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scope: IssueScope;
  result: "pass" | "fail" | "skip";

  // Set when result === "fail"
  detail?: string;       // plain-English description of the specific failure
  evidence?: unknown;    // raw data that triggered the rule

  // The URL this result is attributed to.
  // null for sitewide issues not attributable to a single page.
  url: string | null;
}

// ─── 3. Page Audit Result ────────────────────────────────────

/**
 * The complete audit result for a single page.
 * Produced by the RuleEngine after evaluating all PAGE rules for one URL.
 */
export interface PageAuditResult {
  url: string;
  statusCode: number;
  isIndexable: boolean;
  pageScore: number; // 0–100

  categoryScores: CategoryScoreMap;

  issues: PageIssue[];

  // Summary counts (derived from issues[])
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface PageIssue {
  ruleId: string;
  ruleName: string;
  category: IssueCategory;
  severity: IssueSeverity;
  detail: string;
  evidence: unknown;
  scoreImpact: number;
}

export type CategoryScoreMap = Record<IssueCategory, CategoryScore>;

export interface CategoryScore {
  score: number;    // 0–100
  maxScore: number; // always 100 for MVP
  issueCount: number;
}

// ─── 4. Site Audit Result ────────────────────────────────────

/**
 * The rolled-up result for an entire audit.
 * Produced by the ScoringEngine after all pages are evaluated.
 */
export interface SiteAuditResult {
  auditId: string;
  inputUrl: string;
  inputType: AuditInputType;
  status: AuditStatus;
  startedAt: string;
  completedAt: string | null;

  // Top-level score
  overallScore: number; // 0–100

  // Per-category sitewide scores (includes sitewide issues)
  categoryScores: CategoryScoreMap;

  // Crawl summary
  pagesCrawled: number;
  pagesSkipped: number;
  crawlDurationMs: number | null;

  // Per-page results (sorted by pageScore ASC for triage)
  pages: PageAuditResult[];

  // Prioritised recommendations (sorted by priority ASC)
  recommendations: RecommendationResult[];

  // All sitewide issues (scope = SITEWIDE)
  sitewideIssues: SitewideIssue[];
}

export interface SitewideIssue {
  ruleId: string;
  ruleName: string;
  category: IssueCategory;
  severity: IssueSeverity;
  detail: string;
  evidence: unknown;
  scoreImpact: number;
  affectedUrls: string[]; // URLs involved in the issue
}

// ─── 5. Recommendation ───────────────────────────────────────

/**
 * A ranked, actionable recommendation generated from one or more failing rule results.
 * One Recommendation is generated per failing rule (not per failing page).
 */
export interface RecommendationResult {
  ruleId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  implementationSteps: string[];
  exampleFix: string | null;

  impact: ImpactLevel;
  effort: ImpactLevel;
  priority: number; // lower = more urgent

  // Aggregated blast radius
  affectedPageCount: number;
  affectedUrls: string[]; // up to 10 for display; full set in export
  totalScoreImpact: number;

  // Category and severity of the underlying rule
  category: IssueCategory;
  severity: IssueSeverity;
}

// ─── 6. Export Payload ───────────────────────────────────────

/**
 * Full export payload — the complete audit serialised for download.
 * JSON export: serialise this object directly.
 * CSV export: flatten pages[].issues[] into rows.
 */
export interface AuditExportPayload {
  meta: {
    exportedAt: string;    // ISO 8601
    auditId: string;
    inputUrl: string;
    inputType: AuditInputType;
    auditedAt: string;
    pagesCrawled: number;
    overallScore: number;
    appVersion: string;    // semver of the audit app
  };

  scores: {
    overall: number;
    categories: CategoryScoreMap;
  };

  recommendations: RecommendationResult[];

  sitewideIssues: SitewideIssue[];

  pages: Array<{
    url: string;
    statusCode: number;
    pageScore: number;
    isIndexable: boolean;
    issues: PageIssue[];
    categoryScores: CategoryScoreMap;
  }>;
}

// ─── 7. API Contracts ────────────────────────────────────────

/** POST /api/audit/start request body */
export interface StartAuditRequest {
  url: string;          // homepage or sitemap URL
  inputType: AuditInputType;
}

/** POST /api/audit/start response */
export interface StartAuditResponse {
  auditId: string;
  status: AuditStatus;
}

/** GET /api/audit/:id/status response */
export interface AuditStatusResponse {
  auditId: string;
  status: AuditStatus;
  overallScore: number | null;
  pagesCrawled: number;
  pagesSkipped: number;
  errorMessage: string | null;
  completedAt: string | null;

  // Partial results (populated once status = COMPLETE)
  categoryScores: CategoryScoreMap | null;
  topRecommendations: RecommendationResult[] | null; // top 5
}

// ─── 8. Scoring Weights (exported for transparency) ──────────

/**
 * The canonical weight definitions used by the scoring engine.
 * Exported here so the UI can display "this category counts for X%".
 */
export const CATEGORY_WEIGHTS: Record<IssueCategory, number> = {
  TECHNICAL_SEO: 0.30,
  ON_PAGE_SEO: 0.25,
  STRUCTURED_DATA: 0.15,
  CONTENT: 0.15,
  AEO: 0.10,
  LOCAL_SEO: 0.05,
};

export const SEVERITY_SCORE_IMPACT: Record<IssueSeverity, number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
  INFO: 0,
};

/**
 * Priority weights used to compute Recommendation.priority.
 * Higher number = higher urgency weighting.
 */
export const SEVERITY_PRIORITY_WEIGHT: Record<IssueSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export const IMPACT_PRIORITY_WEIGHT: Record<ImpactLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const EFFORT_PRIORITY_WEIGHT: Record<ImpactLevel, number> = {
  LOW: 3,   // low effort = high desirability = weight up
  MEDIUM: 2,
  HIGH: 1,
};
