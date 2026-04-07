import { prisma } from "@/lib/db";
import { fetchSitemapUrls, discoverSitemap } from "@/lib/crawler/sitemap";
import {
  classifyUrlByProbe,
  classifyUrlHeuristic,
  deduplicateUrls,
  extractSiteName,
  extractSiteUrl,
  normaliseUrl,
} from "@/lib/url/classify";
import { startAuditSchema } from "@/lib/validators/audit-input";
import type { AuditInputType } from "@prisma/client";

// Hard cap on pages per audit (matches ARCHITECTURE.md)
const MAX_PAGES = 50;

// ─── Input types ─────────────────────────────────────────────────────────────

export interface IntakeInput {
  url: string;
  // If omitted, we auto-detect via heuristic + optional HEAD probe
  inputType?: "HOMEPAGE" | "SITEMAP";
}

export interface IntakeResult {
  auditId: string;
  projectId: string;
  status: string;
  inputUrl: string;
  inputType: AuditInputType;
  discoveredUrlCount: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate + normalise + classify the submitted URL, then create the
 * Project (upserted by siteUrl) and Audit (PENDING) records.
 *
 * This function is fast — no page fetching happens here.
 * URL discovery runs later (see discoverUrlsBackground).
 */
export async function createAudit(raw: IntakeInput): Promise<IntakeResult> {
  // 1. Validate with Zod. Determine inputType before validating so we can
  //    pass the right enum value.
  const detectedType =
    raw.inputType ?? classifyUrlHeuristic(raw.url);

  const parsed = startAuditSchema.parse({
    url: raw.url,
    inputType: raw.inputType ?? detectedType,
  });

  const normUrl = normaliseUrl(parsed.url);
  const siteUrl = extractSiteUrl(normUrl);
  const siteName = extractSiteName(normUrl);

  // 2. Upsert Project by unique siteUrl.
  const project = await prisma.project.upsert({
    where: { siteUrl },
    update: { updatedAt: new Date() },
    create: { name: siteName, siteUrl },
  });

  // 3. Create Audit in PENDING state.
  const audit = await prisma.audit.create({
    data: {
      projectId: project.id,
      inputUrl: normUrl,
      inputType: parsed.inputType,
      status: "PENDING",
    },
  });

  return {
    auditId: audit.id,
    projectId: project.id,
    status: audit.status,
    inputUrl: audit.inputUrl,
    inputType: audit.inputType,
    discoveredUrlCount: 0,
  };
}

/**
 * Background phase 1: discover and count the URLs that will be audited.
 *
 * For SITEMAP input: fetch the sitemap and count URLs (capped at MAX_PAGES).
 * For HOMEPAGE input: attempt to discover a sitemap; fall back to 1 (the homepage).
 *
 * Sets audit.status = CRAWLING while running, then resets to PENDING so the
 * full pipeline (Pass 2B) can pick it up.
 *
 * This function is designed to be called inside a Next.js `after()` callback
 * so it runs after the HTTP response is returned to the client.
 *
 * It never throws — errors are written to audit.errorMessage.
 */
export async function discoverUrlsBackground(
  auditId: string,
  inputUrl: string,
  inputType: "HOMEPAGE" | "SITEMAP"
): Promise<void> {
  try {
    await prisma.audit.update({
      where: { id: auditId },
      data: { status: "CRAWLING" },
    });

    const siteUrl = extractSiteUrl(inputUrl);
    let sitemapUrl: string | null = null;
    let urls: string[] = [];

    if (inputType === "SITEMAP") {
      sitemapUrl = inputUrl;
      urls = await fetchSitemapUrls(inputUrl);
    } else {
      // Best-effort sitemap discovery for informational purposes
      sitemapUrl = await discoverSitemap(siteUrl);
      if (sitemapUrl) {
        urls = await fetchSitemapUrls(sitemapUrl);
      }
      // Always include the homepage itself
      urls = deduplicateUrls([normaliseUrl(inputUrl), ...urls]);
    }

    const capped = deduplicateUrls(urls).slice(0, MAX_PAGES);

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        sitemapUrl,
        discoveredUrlCount: capped.length,
        // Reset to PENDING so the full pipeline can run
        status: "PENDING",
      },
    });
  } catch (err) {
    await prisma.audit
      .update({
        where: { id: auditId },
        data: {
          status: "FAILED",
          errorMessage: `URL discovery failed: ${String(err)}`,
          completedAt: new Date(),
        },
      })
      .catch(() => {
        // Swallow DB errors in the error handler — nothing useful to do
      });
  }
}

/**
 * Auto-detect inputType via a HEAD probe if the caller did not specify it.
 * This is slightly slower than classifyUrlHeuristic (one network hop).
 * Use before createAudit() if you want the most accurate classification.
 */
export async function detectInputType(
  url: string
): Promise<"HOMEPAGE" | "SITEMAP"> {
  return classifyUrlByProbe(url);
}

// ─── Query helpers (used by API routes) ──────────────────────────────────────

export async function getAuditById(id: string) {
  return prisma.audit.findUnique({
    where: { id },
    include: {
      project: true,
      categoryScores: { orderBy: { category: "asc" } },
      recommendations: { orderBy: { priority: "asc" }, take: 20 },
      pages: {
        orderBy: { pageScore: "asc" },
        take: 50,
        include: {
          categoryScores: true,
          issues: {
            orderBy: { scoreImpact: "desc" },
            take: 20,
          },
        },
      },
    },
  });
}

export async function getAuditStatus(id: string) {
  return prisma.audit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      inputUrl: true,
      inputType: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      pagesCrawled: true,
      pagesSkipped: true,
      discoveredUrlCount: true,
      overallScore: true,
      categoryScores: {
        select: { category: true, score: true, issueCount: true },
      },
    },
  });
}

export async function listAuditsForProject(projectId: string) {
  return prisma.audit.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      inputUrl: true,
      inputType: true,
      startedAt: true,
      completedAt: true,
      overallScore: true,
      pagesCrawled: true,
      discoveredUrlCount: true,
    },
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { audits: true } },
      audits: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, status: true, overallScore: true, startedAt: true },
      },
    },
  });
}
