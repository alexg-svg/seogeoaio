"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  ExternalLink,
  FileText,
  Hash,
  ImageIcon,
  Link2,
  Tag,
  Type,
} from "lucide-react";

import { IssuesList } from "@/components/issues-list";
import { RecommendationCard } from "@/components/recommendation-card";
import { CategoryScoreGrid } from "@/components/category-score-grid";
import { SeverityBadge } from "@/components/severity-badge";
import { ScoreCard } from "@/components/score-card";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AuditDetail, AuditedPage, Recommendation, CategoryScore } from "@/lib/api-types";

// ─── Data fetching ─────────────────────────────────────────────────────────────

interface PageDetailData {
  page: AuditedPage;
  audit: Pick<AuditDetail, "id" | "inputUrl" | "recommendations">;
  categoryScores: CategoryScore[];
  pageRecommendations: Recommendation[];
}

async function loadPageData(auditId: string, pageId: string): Promise<PageDetailData | null> {
  const res = await fetch(`/api/audits/${auditId}`);
  if (!res.ok) return null;
  const audit: AuditDetail = await res.json();

  const page = audit.pages.find((p) => p.id === pageId);
  if (!page) return null;

  // Recommendations that touch this page
  const pageRecommendations = audit.recommendations.filter((r) =>
    r.affectedUrls.includes(page.url)
  );

  // Page-level category scores (from AuditedPage.categoryScores shape)
  const categoryScores: CategoryScore[] = page.categoryScores.map((cs) => ({
    category: cs.category,
    score: cs.score,
    maxScore: 100,
    issueCount: page.issues.filter((i) => i.category === cs.category).length,
  }));

  return {
    page,
    audit: { id: audit.id, inputUrl: audit.inputUrl, recommendations: audit.recommendations },
    categoryScores,
    pageRecommendations,
  };
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function PageDetail() {
  const { id: auditId, pageId } = useParams<{ id: string; pageId: string }>();
  const [data, setData] = useState<PageDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    const result = await loadPageData(auditId, pageId);
    if (!result) setError(true);
    else setData(result);
    setLoading(false);
  }

  useEffect(() => { load(); }, [auditId, pageId]);

  if (loading) {
    return (
      <Shell auditId={auditId} title="Loading…">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell auditId={auditId} title="Page not found">
        <ErrorState message="Could not load this page." onRetry={load} />
      </Shell>
    );
  }

  const { page, categoryScores, pageRecommendations } = data;

  const structuredTypes = extractSchemaTypes(page);

  return (
    <Shell auditId={auditId} title={page.url}>
      <div className="space-y-6">
        {/* Score + status row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ScoreCard
            score={Math.round(page.pageScore ?? 0)}
            label="Page Score"
            size="md"
          />
          <MetaStat
            icon={<FileText className="h-4 w-4" />}
            label="Status"
            value={String(page.statusCode)}
            sub={page.isIndexable ? "Indexable" : "Not indexable"}
            highlight={!page.isIndexable ? "warn" : undefined}
          />
          <MetaStat
            icon={<Hash className="h-4 w-4" />}
            label="Word count"
            value={page.wordCount !== null ? String(page.wordCount) : "—"}
            sub={page.wordCount !== null && page.wordCount < 300 ? "Thin content" : undefined}
            highlight={page.wordCount !== null && page.wordCount < 300 ? "warn" : undefined}
          />
          <MetaStat
            icon={<ImageIcon className="h-4 w-4" />}
            label="Images"
            value={page.imageCount !== null ? String(page.imageCount) : "—"}
            sub={
              page.imagesWithoutAlt
                ? `${page.imagesWithoutAlt} missing alt`
                : "All have alt"
            }
            highlight={page.imagesWithoutAlt ? "warn" : undefined}
          />
        </div>

        {/* Meta panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Page metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <MetaRow label="URL" value={page.url} mono href={page.url} />
              <MetaRow
                label="Title"
                value={page.title ?? <Missing />}
                badge={page.title ? `${page.title.length} chars` : undefined}
                warn={!page.title || page.title.length < 10 || page.title.length > 60}
              />
              <MetaRow
                label="Meta description"
                value={page.metaDescription ?? <Missing />}
                badge={page.metaDescription ? `${page.metaDescription.length} chars` : undefined}
                warn={!page.metaDescription}
              />
              <MetaRow
                label="H1"
                value={page.h1 ?? <Missing />}
                badge={page.h1Count !== 1 ? `${page.h1Count} H1s` : undefined}
                warn={page.h1Count !== 1}
              />
              <MetaRow
                label="Canonical"
                value={page.canonicalUrl ?? <Missing />}
                mono
                warn={!page.canonicalUrl || page.hasCanonicalMismatch}
                badge={page.hasCanonicalMismatch ? "Mismatch" : undefined}
              />
              <MetaRow
                label="Internal links"
                value={page.internalLinkCount !== null ? String(page.internalLinkCount) : "—"}
              />
              <MetaRow
                label="External links"
                value={page.externalLinkCount !== null ? String(page.externalLinkCount) : "—"}
              />
              {structuredTypes.length > 0 && (
                <MetaRow
                  label="Schema types"
                  value={
                    <div className="flex flex-wrap gap-1">
                      {structuredTypes.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  }
                />
              )}
              {page.robotsBlocked && (
                <MetaRow label="Robots" value="Blocked by robots.txt" warn />
              )}
              {page.redirectUrl && (
                <MetaRow
                  label="Redirects to"
                  value={page.redirectUrl}
                  mono
                  badge={`${page.redirectChainLength} hop${page.redirectChainLength !== 1 ? "s" : ""}`}
                />
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Category scores */}
        {categoryScores.length > 0 && (
          <CategoryScoreGrid categoryScores={categoryScores} />
        )}

        {/* Issues */}
        <IssuesList
          issues={page.issues}
          title={`Issues on this page (${page.issues.length})`}
        />

        {/* Recommendations */}
        {pageRecommendations.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Recommendations ({pageRecommendations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pageRecommendations.map((rec, i) => (
                <RecommendationCard key={rec.ruleId} rec={rec} rank={i + 1} />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <EmptyState title="No recommendations" description="No specific recommendations for this page." />
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Shell({
  auditId,
  title,
  children,
}: {
  auditId: string;
  title: string;
  children: React.ReactNode;
}) {
  const shortTitle = title.replace(/^https?:\/\/[^/]+/, "") || "/";
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold tracking-tight">SEO Audit</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl w-full px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/audits/${auditId}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-semibold truncate font-mono">{shortTitle}</h1>
          <a
            href={title.startsWith("http") ? title : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {children}
      </main>
    </div>
  );
}

function MetaStat({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: "warn" | "error";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {sub && (
          <span
            className={
              highlight === "warn"
                ? "text-xs text-yellow-600"
                : highlight === "error"
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {sub}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function MetaRow({
  label,
  value,
  mono,
  href,
  warn,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  href?: string;
  warn?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex gap-4 py-2.5">
      <dt className="w-36 flex-shrink-0 text-xs text-muted-foreground pt-0.5">{label}</dt>
      <dd
        className={`flex-1 text-sm break-all ${mono ? "font-mono text-xs" : ""} ${
          warn ? "text-yellow-700" : ""
        }`}
      >
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1"
          >
            {value}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        ) : (
          value
        )}
        {badge && (
          <span className="ml-2 inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </dd>
    </div>
  );
}

function Missing() {
  return <span className="text-destructive italic">Missing</span>;
}

function extractSchemaTypes(page: AuditedPage): string[] {
  // structuredDataJson is stored on the page record
  // We pull it from the issues evidence or just show a summary from what we have
  const types: string[] = [];
  // The issues list may contain schema-related evidence
  for (const issue of page.issues) {
    if (issue.category === "STRUCTURED_DATA" && issue.evidence) {
      const t = issue.evidence["type"] as string | string[] | undefined;
      if (Array.isArray(t)) types.push(...t);
      else if (typeof t === "string") types.push(t);
    }
  }
  return [...new Set(types)];
}
