"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ExternalLink, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { AuditedPage } from "@/lib/api-types";

type SortKey = "pageScore" | "wordCount" | "issueCount" | "url";
type SortDir = "asc" | "desc";

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

interface Props {
  pages: AuditedPage[];
  auditId: string;
}

export function PagesTable({ pages, auditId }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("pageScore");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "url" ? "asc" : "asc");
    }
  }

  const sorted = [...pages].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    if (sortKey === "pageScore") {
      va = a.pageScore ?? 999;
      vb = b.pageScore ?? 999;
    } else if (sortKey === "wordCount") {
      va = a.wordCount ?? 0;
      vb = b.wordCount ?? 0;
    } else if (sortKey === "issueCount") {
      va = a.issues?.length ?? 0;
      vb = b.issues?.length ?? 0;
    } else if (sortKey === "url") {
      va = a.url;
      vb = b.url;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="No pages crawled" description="Pages will appear here once the audit is complete." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Pages
          <span className="text-xs font-normal text-muted-foreground">({pages.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">
                <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-xs" onClick={() => handleSort("url")}>
                  URL <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-center p-3 font-medium">
                <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-xs" onClick={() => handleSort("pageScore")}>
                  Score <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-center p-3 text-xs font-medium">Status</th>
              <th className="text-center p-3 font-medium">
                <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-xs" onClick={() => handleSort("wordCount")}>
                  Words <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="text-center p-3 font-medium">
                <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-xs" onClick={() => handleSort("issueCount")}>
                  Issues <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((page) => (
              <tr key={page.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 max-w-xs">
                  <div className="truncate font-mono text-xs text-foreground" title={page.url}>
                    {page.url.replace(/^https?:\/\/[^/]+/, "")}
                  </div>
                  {page.title && (
                    <div className="text-xs text-muted-foreground truncate">{page.title}</div>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className={cn("font-bold tabular-nums text-base", scoreColor(page.pageScore))}>
                    {page.pageScore !== null ? Math.round(page.pageScore) : "—"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {!page.isIndexable ? (
                    <span title="Not indexable"><XCircle className="h-4 w-4 text-muted-foreground mx-auto" /></span>
                  ) : page.issues?.length > 0 ? (
                    <span title="Has issues"><AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" /></span>
                  ) : (
                    <span title="No issues"><CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /></span>
                  )}
                </td>
                <td className="p-3 text-center text-xs text-muted-foreground tabular-nums">
                  {page.wordCount ?? "—"}
                </td>
                <td className="p-3 text-center">
                  {(page.issues?.length ?? 0) > 0 ? (
                    <span className="text-xs font-medium text-destructive">{page.issues.length}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">0</span>
                  )}
                </td>
                <td className="p-3">
                  <Link href={`/audits/${auditId}/pages/${page.id}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
