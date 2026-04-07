/**
 * Audit runner orchestration.
 *
 * runAudit(auditId) is the single entry point for the full pipeline:
 *   1. Load audit from DB
 *   2. Crawl pages
 *   3. Parse pages
 *   4. Run page + sitewide rules
 *   5. Compute scores
 *   6. Generate recommendations
 *   7. Persist results
 *   8. Mark audit complete
 *
 * The function never throws — errors are caught, persisted, and the audit is
 * marked FAILED. Designed to run inside a Next.js after() callback or an
 * explicit API trigger, well within Vercel's 300 s limit.
 */

import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/crawler/index";
import { parseFromFetched } from "@/lib/parser/index";
import type { FetchedPage } from "@/lib/parser/types";
import type { RawPage } from "@/lib/crawler/index";
import { PAGE_RULES, SITEWIDE_RULES } from "@/lib/audit-rules/index";
import { runPageRules } from "@/lib/audit-rules/run-page-rules";
import { runSitewideRules } from "@/lib/audit-rules/run-sitewide-rules";
import {
  computePageScoreFromIssues,
  computeSiteScoreFromIssues,
} from "@/lib/scoring/index";
import { generateRecommendations } from "@/lib/recommendations/index";
import {
  persistPageResults,
  persistSitewideIssues,
  persistSiteCategoryScores,
  persistRecommendations,
  markAuditAnalyzing,
  markAuditComplete,
  markAuditFailed,
} from "./persist-results";
import type { IssueOutput } from "@/lib/audit-rules/types";
import type { PageScoreResult } from "@/lib/scoring/types";
import type { ParsedPage } from "@/lib/parser/index";
import type { PagePersistEntry } from "./persist-results";

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runAudit(auditId: string): Promise<void> {
  let inputUrl = "";
  let inputType: "HOMEPAGE" | "SITEMAP" = "HOMEPAGE";

  try {
    // 1. Load audit
    const audit = await prisma.audit.findUniqueOrThrow({
      where: { id: auditId },
      select: { id: true, inputUrl: true, inputType: true, status: true },
    });

    inputUrl = audit.inputUrl;
    inputType = audit.inputType as "HOMEPAGE" | "SITEMAP";

    // If already complete or failed, do not re-run
    if (audit.status === "COMPLETE" || audit.status === "FAILED") return;

    // 2. Update status → CRAWLING
    await prisma.audit.update({
      where: { id: auditId },
      data: { status: "CRAWLING" },
    });

    // 3. Crawl
    const crawlResult = await crawlSite({ url: inputUrl, inputType });

    // 4. Update status → ANALYZING
    await markAuditAnalyzing(auditId);

    // 5. Determine the origin for homepage detection
    let origin: string;
    try {
      origin = new URL(inputUrl).origin;
    } catch {
      origin = inputUrl;
    }

    // 6. Parse pages and run page rules
    const entries: PagePersistEntry[] = [];
    const allParsedPages: ParsedPage[] = [];
    const allPageIssues: IssueOutput[] = [];
    const pageScores: PageScoreResult[] = [];

    for (const rawPage of crawlResult.pages) {
      const fetched = rawPageToFetchedPage(rawPage);
      const isHomepage = isHomeUrl(rawPage.finalUrl || rawPage.url, origin);

      const parsed = parseFromFetched(fetched, { isHomepage, robotsBlocked: rawPage.robotsBlocked });
      allParsedPages.push(parsed);

      const pageResult = runPageRules(auditId, parsed, PAGE_RULES, {
        isHomepage,
        robots: crawlResult.robots,
      });

      const pageScore = computePageScoreFromIssues(pageResult.issues);
      pageScores.push(pageScore);

      entries.push({ page: parsed, pageScore, issues: pageResult.issues });
      allPageIssues.push(...pageResult.issues);
    }

    // 7. Run sitewide rules
    const sitewideResult = runSitewideRules(
      auditId,
      allParsedPages,
      SITEWIDE_RULES,
      { robots: crawlResult.robots }
    );

    // 8. Compute overall site score
    const siteScore = computeSiteScoreFromIssues(pageScores, sitewideResult.issues);

    // 9. Generate recommendations from all issues
    const allIssues: IssueOutput[] = [
      ...allPageIssues,
      ...sitewideResult.issues,
    ];
    const recommendations = generateRecommendations(auditId, allIssues);

    // 10. Persist everything
    const urlToPageId = await persistPageResults(auditId, entries);
    await persistSitewideIssues(auditId, urlToPageId, sitewideResult.issues);
    await persistSiteCategoryScores(auditId, siteScore);
    await persistRecommendations(recommendations);

    // 11. Mark complete
    await markAuditComplete(
      auditId,
      siteScore.overallScore,
      crawlResult.pages.length,
      crawlResult.pagesSkipped,
      crawlResult.crawlDurationMs
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runAudit] Audit ${auditId} failed:`, message);
    await markAuditFailed(auditId, message).catch(() => {
      // Swallow DB errors in the error handler
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert the crawler's RawPage shape to the parser's FetchedPage shape.
 * They share the same data but use slightly different field names.
 */
function rawPageToFetchedPage(raw: RawPage): FetchedPage {
  return {
    url: raw.finalUrl || raw.url,
    originalUrl: raw.originalUrl,
    statusCode: raw.statusCode,
    redirectCount: raw.redirectChainLength,
    contentType: "text/html", // not tracked by the crawler; assume HTML
    html: raw.html,
    durationMs: raw.fetchDurationMs,
    error: raw.error,
  };
}

function isHomeUrl(url: string, origin: string): boolean {
  try {
    const u = new URL(url);
    const o = new URL(origin);
    if (u.host !== o.host) return false;
    return u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}
