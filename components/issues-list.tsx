"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/severity-badge";
import { EmptyState } from "@/components/empty-state";
import type { Issue, IssueCategory } from "@/lib/api-types";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  TECHNICAL_SEO: "Technical",
  ON_PAGE_SEO: "On-Page",
  LOCAL_SEO: "Local SEO",
  STRUCTURED_DATA: "Schema",
  AEO: "AEO",
  CONTENT: "Content",
};

interface Props {
  issues: Issue[];
  title?: string;
}

export function IssuesList({ issues, title = "Issues" }: Props) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No issues found" description="This section is clean." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-muted-foreground">
            ({issues.length} issue{issues.length !== 1 ? "s" : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {issues.map((issue, idx) => (
            <div
              key={issue.id ?? `${issue.ruleId}-${idx}`}
              className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-shrink-0 pt-0.5">
                <SeverityBadge severity={issue.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{issue.ruleName}</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {CATEGORY_LABELS[issue.category]}
                  </span>
                  {issue.scope === "SITEWIDE" && (
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      Sitewide
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{issue.detail}</p>
              </div>
              {issue.scoreImpact > 0 && (
                <span className="flex-shrink-0 text-xs font-medium text-destructive tabular-nums">
                  -{issue.scoreImpact}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
