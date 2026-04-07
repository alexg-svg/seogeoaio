/**
 * Persistence helpers for audit results.
 *
 * All functions write to the database via Prisma and are idempotent — they
 * can be called multiple times for the same audit without creating duplicates.
 * Issues use fingerprint-based upserts; pages use (auditId, url) uniqueness;
 * recommendations use (auditId, ruleId) uniqueness.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ParsedPage } from "@/lib/parser/index";
import type { IssueOutput } from "@/lib/audit-rules/types";
import type { PageScoreResult, SiteScoreResult } from "@/lib/scoring/types";
import type { RecommendationInput } from "@/lib/recommendations/index";

// ─── Pages ────────────────────────────────────────────────────────────────────

export interface PagePersistEntry {
  page: ParsedPage;
  pageScore: PageScoreResult;
  issues: IssueOutput[];
}

/**
 * Upsert AuditedPage rows, their per-category PageCategoryScore rows, and
 * all page-scoped Issue rows.
 *
 * @returns Map of page URL → AuditedPage.id (needed to link sitewide issues).
 */
export async function persistPageResults(
  auditId: string,
  entries: PagePersistEntry[]
): Promise<Map<string, string>> {
  const urlToPageId = new Map<string, string>();

  for (const { page, pageScore, issues } of entries) {
    // 1. Upsert the AuditedPage row
    const auditedPage = await prisma.auditedPage.upsert({
      where: { auditId_url: { auditId, url: page.url } },
      create: {
        auditId,
        url: page.url,
        originalUrl: page.originalUrl || null,
        canonicalUrl: page.canonicalUrl,
        statusCode: page.statusCode,
        redirectUrl: page.redirectUrl,
        redirectChainLength: page.redirectChainLength,
        fetchDurationMs: page.fetchDurationMs || null,
        isIndexable: page.isIndexable,
        robotsBlocked: page.robotsBlocked,
        hasCanonicalMismatch: page.hasCanonicalMismatch,
        title: page.title,
        metaDescription: page.metaDescription,
        h1: page.h1,
        h1Count: page.h1Count,
        wordCount: page.wordCount,
        internalLinkCount: page.internalLinkCount,
        externalLinkCount: page.externalLinkCount,
        imageCount: page.imageCount,
        imagesWithoutAlt: page.imagesWithoutAlt,
        pageScore: pageScore.pageScore,
        headingsJson: page.headings as object,
        metaTagsJson: page.metaTags as object,
        structuredDataJson: page.structuredData as object[],
        openGraphJson: page.openGraph as object,
        twitterCardJson: page.twitterCard as object,
        internalLinksJson: page.internalLinks,
      },
      update: {
        canonicalUrl: page.canonicalUrl,
        statusCode: page.statusCode,
        redirectUrl: page.redirectUrl,
        redirectChainLength: page.redirectChainLength,
        fetchDurationMs: page.fetchDurationMs || null,
        isIndexable: page.isIndexable,
        robotsBlocked: page.robotsBlocked,
        hasCanonicalMismatch: page.hasCanonicalMismatch,
        title: page.title,
        metaDescription: page.metaDescription,
        h1: page.h1,
        h1Count: page.h1Count,
        wordCount: page.wordCount,
        internalLinkCount: page.internalLinkCount,
        externalLinkCount: page.externalLinkCount,
        imageCount: page.imageCount,
        imagesWithoutAlt: page.imagesWithoutAlt,
        pageScore: pageScore.pageScore,
        headingsJson: page.headings as object,
        metaTagsJson: page.metaTags as object,
        structuredDataJson: page.structuredData as object[],
        openGraphJson: page.openGraph as object,
        twitterCardJson: page.twitterCard as object,
        internalLinksJson: page.internalLinks,
      },
    });

    urlToPageId.set(page.url, auditedPage.id);

    // 2. Upsert per-page category scores
    for (const cs of pageScore.categoryScores) {
      await prisma.pageCategoryScore.upsert({
        where: { pageId_category: { pageId: auditedPage.id, category: cs.category } },
        create: {
          pageId: auditedPage.id,
          category: cs.category,
          score: cs.score,
          maxScore: cs.maxScore,
        },
        update: { score: cs.score },
      });
    }

    // 3. Insert page-scoped issues (skip duplicates by fingerprint)
    if (issues.length > 0) {
      const pageIssues = issues.filter((i) => i.scope === "PAGE");
      await prisma.issue.createMany({
        data: pageIssues.map((issue) => ({
          auditId,
          pageId: auditedPage.id,
          ruleId: issue.ruleId,
          ruleName: issue.ruleName,
          category: issue.category,
          severity: issue.severity,
          scope: issue.scope,
          detail: issue.detail,
          evidence: issue.evidence !== null
            ? (issue.evidence as unknown as Prisma.InputJsonValue)
            : undefined,
          scoreImpact: issue.scoreImpact,
          fingerprint: issue.fingerprint,
        })),
        skipDuplicates: true,
      });
    }
  }

  return urlToPageId;
}

// ─── Sitewide issues ──────────────────────────────────────────────────────────

/**
 * Persist sitewide Issue rows. For issues with a URL, link to the
 * corresponding AuditedPage via the url→id map. For URL-less sitewide issues,
 * pageId is left null.
 */
export async function persistSitewideIssues(
  auditId: string,
  urlToPageId: Map<string, string>,
  sitewideIssues: IssueOutput[]
): Promise<void> {
  if (sitewideIssues.length === 0) return;

  await prisma.issue.createMany({
    data: sitewideIssues.map((issue) => ({
      auditId,
      pageId: issue.url ? (urlToPageId.get(issue.url) ?? null) : null,
      ruleId: issue.ruleId,
      ruleName: issue.ruleName,
      category: issue.category,
      severity: issue.severity,
      scope: issue.scope,
      detail: issue.detail,
      evidence: issue.evidence !== null
          ? (issue.evidence as unknown as Prisma.InputJsonValue)
          : undefined,
      scoreImpact: issue.scoreImpact,
      fingerprint: issue.fingerprint,
    })),
    skipDuplicates: true,
  });
}

// ─── Sitewide category scores ─────────────────────────────────────────────────

export async function persistSiteCategoryScores(
  auditId: string,
  siteScore: SiteScoreResult
): Promise<void> {
  for (const cs of siteScore.categoryScores) {
    await prisma.categoryScore.upsert({
      where: { auditId_category: { auditId, category: cs.category } },
      create: {
        auditId,
        category: cs.category,
        score: cs.score,
        maxScore: cs.maxScore,
        issueCount: cs.issueCount,
      },
      update: {
        score: cs.score,
        issueCount: cs.issueCount,
      },
    });
  }
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export async function persistRecommendations(
  recommendations: RecommendationInput[]
): Promise<void> {
  for (const rec of recommendations) {
    await prisma.recommendation.upsert({
      where: { auditId_ruleId: { auditId: rec.auditId, ruleId: rec.ruleId } },
      create: {
        auditId: rec.auditId,
        ruleId: rec.ruleId,
        title: rec.title,
        summary: rec.summary,
        whyItMatters: rec.whyItMatters,
        implementationSteps: rec.implementationSteps,
        exampleFix: rec.exampleFix,
        impact: rec.impact,
        effort: rec.effort,
        priority: rec.priority,
        affectedPageCount: rec.affectedPageCount,
        totalScoreImpact: rec.totalScoreImpact,
        affectedUrls: rec.affectedUrls,
      },
      update: {
        affectedPageCount: rec.affectedPageCount,
        totalScoreImpact: rec.totalScoreImpact,
        affectedUrls: rec.affectedUrls,
        priority: rec.priority,
      },
    });
  }
}

// ─── Audit status updates ─────────────────────────────────────────────────────

export async function markAuditAnalyzing(auditId: string): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: "ANALYZING" },
  });
}

export async function markAuditComplete(
  auditId: string,
  overallScore: number,
  pagesCrawled: number,
  pagesSkipped: number,
  crawlDurationMs: number
): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: "COMPLETE",
      overallScore,
      pagesCrawled,
      pagesSkipped,
      crawlDurationMs,
      completedAt: new Date(),
    },
  });
}

export async function markAuditFailed(
  auditId: string,
  errorMessage: string
): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: "FAILED",
      errorMessage,
      completedAt: new Date(),
    },
  });
}
