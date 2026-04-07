"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";

import { AuditStatusCard } from "@/components/audit-status-card";
import { ScoreCard } from "@/components/score-card";
import { CategoryScoreGrid } from "@/components/category-score-grid";
import { QuickWins } from "@/components/quick-wins";
import { TopFixes } from "@/components/top-fixes";
import { IssuesList } from "@/components/issues-list";
import { PagesTable } from "@/components/pages-table";
import { DashboardFilters, type FilterState } from "@/components/dashboard-filters";
import { ExportButtons } from "@/components/export-buttons";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { AuditDetail, Issue } from "@/lib/api-types";

const DEFAULT_FILTERS: FilterState = {
  search: "",
  severity: "ALL",
  category: "ALL",
  scope: "ALL",
};

export default function AuditDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  async function loadAudit() {
    setFetchError(false);
    try {
      const res = await fetch(`/api/audits/${id}`);
      if (!res.ok) { setFetchError(true); return; }
      const data: AuditDetail = await res.json();
      setAudit(data);
      setIsComplete(data.status === "COMPLETE" || data.status === "FAILED");
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAudit(); }, [id]);

  // All issues flat list
  const allIssues: Issue[] = useMemo(() => {
    if (!audit) return [];
    return audit.pages.flatMap((p) => p.issues ?? []);
  }, [audit]);

  // Filtered issues for the issues tab
  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      if (filters.severity !== "ALL" && issue.severity !== filters.severity) return false;
      if (filters.category !== "ALL" && issue.category !== filters.category) return false;
      if (filters.scope !== "ALL" && issue.scope !== filters.scope) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!issue.ruleName.toLowerCase().includes(q) && !issue.detail.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allIssues, filters]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <div className="mx-auto max-w-5xl w-full px-4 py-8">
          <div className="max-w-lg mx-auto">
            <AuditStatusCard
              auditId={id}
              onComplete={() => {
                setIsComplete(true);
                loadAudit();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (fetchError || !audit) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <div className="mx-auto max-w-5xl w-full px-4 py-16">
          <ErrorState message="Could not load audit." onRetry={loadAudit} />
        </div>
      </div>
    );
  }

  const isRunning = audit.status !== "COMPLETE" && audit.status !== "FAILED";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Nav />

      <main className="mx-auto max-w-6xl w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-lg font-bold truncate">{audit.inputUrl}</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              {audit.pagesCrawled} pages crawled
              {audit.crawlDurationMs && ` · ${(audit.crawlDurationMs / 1000).toFixed(1)}s`}
              {audit.completedAt && ` · ${new Date(audit.completedAt).toLocaleString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-6 sm:ml-0">
            {isComplete && <ExportButtons auditId={id} />}
            <Button variant="outline" size="sm" onClick={loadAudit} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status card while running */}
        {isRunning && (
          <div className="max-w-lg">
            <AuditStatusCard
              auditId={id}
              onComplete={() => { setIsComplete(true); loadAudit(); }}
            />
          </div>
        )}

        {/* Results only when complete */}
        {audit.status === "COMPLETE" && (
          <>
            {/* Scores row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ScoreCard score={Math.round(audit.overallScore ?? 0)} label="Overall Score" size="lg" />
              <div className="md:col-span-3">
                <CategoryScoreGrid categoryScores={audit.categoryScores} />
              </div>
            </div>

            {/* Quick wins */}
            <QuickWins recommendations={audit.recommendations} />

            {/* Tabs */}
            <Tabs defaultValue="recommendations">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="recommendations">
                  Recommendations ({audit.recommendations.length})
                </TabsTrigger>
                <TabsTrigger value="issues">
                  Issues ({allIssues.length})
                </TabsTrigger>
                <TabsTrigger value="pages">
                  Pages ({audit.pages.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recommendations">
                <TopFixes recommendations={audit.recommendations} />
              </TabsContent>

              <TabsContent value="issues" className="space-y-4">
                <DashboardFilters filters={filters} onChange={setFilters} />
                <IssuesList issues={filteredIssues} title={`Issues (${filteredIssues.length})`} />
              </TabsContent>

              <TabsContent value="pages">
                <PagesTable pages={audit.pages} auditId={id} />
              </TabsContent>
            </Tabs>
          </>
        )}

        {audit.status === "FAILED" && (
          <ErrorState
            title="Audit failed"
            message={audit.errorMessage ?? "An unexpected error occurred."}
            onRetry={() => router.push("/")}
          />
        )}
      </main>
    </div>
  );
}

function Nav() {
  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight">SEO Audit</span>
        </Link>
      </div>
    </header>
  );
}
