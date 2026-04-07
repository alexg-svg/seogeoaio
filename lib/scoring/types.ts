import type { IssueCategory } from "@/lib/audit-rules/types";

/** Category weights. Must sum to 1.0. */
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
  /** 0–100. Higher is better. */
  score: number;
  maxScore: number; // always 100
  issueCount: number;
  /** Total points subtracted from 100. */
  deduction: number;
}

export interface PageScoreResult {
  /** 0–100 weighted across categories. */
  pageScore: number;
  categoryScores: CategoryScoreDetail[];
}

export interface SiteScoreResult {
  /** 0–100 weighted overall. */
  overallScore: number;
  categoryScores: CategoryScoreDetail[];
}
