import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      project: true,
      categoryScores: { orderBy: { category: "asc" } },
      recommendations: { orderBy: { priority: "asc" } },
      pages: {
        orderBy: { pageScore: "asc" },
        include: {
          categoryScores: { orderBy: { category: "asc" } },
          issues: { orderBy: { scoreImpact: "desc" } },
        },
      },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  if (audit.status !== "COMPLETE") {
    return NextResponse.json(
      { error: `Audit is not complete (status: ${audit.status})` },
      { status: 409 }
    );
  }

  const payload = {
    auditId: audit.id,
    status: audit.status,
    inputUrl: audit.inputUrl,
    inputType: audit.inputType,
    startedAt: audit.startedAt,
    completedAt: audit.completedAt,
    overallScore: audit.overallScore,
    pagesCrawled: audit.pagesCrawled,
    pagesSkipped: audit.pagesSkipped,
    crawlDurationMs: audit.crawlDurationMs,
    project: audit.project
      ? { id: audit.project.id, name: audit.project.name, siteUrl: audit.project.siteUrl }
      : null,
    categoryScores: audit.categoryScores.map((cs) => ({
      category: cs.category,
      score: cs.score,
      maxScore: cs.maxScore,
      issueCount: cs.issueCount,
    })),
    recommendations: audit.recommendations.map((r) => ({
      ruleId: r.ruleId,
      title: r.title,
      summary: r.summary,
      whyItMatters: r.whyItMatters,
      implementationSteps: r.implementationSteps,
      exampleFix: r.exampleFix,
      impact: r.impact,
      effort: r.effort,
      priority: r.priority,
      affectedPageCount: r.affectedPageCount,
      totalScoreImpact: r.totalScoreImpact,
      affectedUrls: r.affectedUrls,
    })),
    pages: audit.pages.map((p) => ({
      url: p.url,
      statusCode: p.statusCode,
      isIndexable: p.isIndexable,
      pageScore: p.pageScore,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      wordCount: p.wordCount,
      imageCount: p.imageCount,
      imagesWithoutAlt: p.imagesWithoutAlt,
      canonicalUrl: p.canonicalUrl,
      hasCanonicalMismatch: p.hasCanonicalMismatch,
      categoryScores: p.categoryScores.map((cs) => ({
        category: cs.category,
        score: cs.score,
      })),
      issues: p.issues.map((i) => ({
        ruleId: i.ruleId,
        ruleName: i.ruleName,
        category: i.category,
        severity: i.severity,
        scope: i.scope,
        detail: i.detail,
        scoreImpact: i.scoreImpact,
      })),
    })),
  };

  const filename = `audit-${id}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
