"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/api-types";

const IMPACT_CLASS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-gray-100 text-gray-700 border-gray-200",
};

const EFFORT_CLASS: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-red-100 text-red-800 border-red-200",
};

interface Props {
  rec: Recommendation;
  rank?: number;
}

export function RecommendationCard({ rec, rank }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3 p-4">
          {rank !== undefined && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
              {rank}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold">{rec.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{rec.summary}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", IMPACT_CLASS[rec.impact])}>
                Impact: {rec.impact}
              </span>
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", EFFORT_CLASS[rec.effort])}>
                Effort: {rec.effort}
              </span>
              {rec.affectedPageCount > 0 && (
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                  {rec.affectedPageCount} page{rec.affectedPageCount !== 1 ? "s" : ""}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                -{rec.totalScoreImpact.toFixed(0)} pts
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-4 border-t bg-muted/30">
          <div className="space-y-4 pt-4">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Why it matters
              </h5>
              <p className="text-sm">{rec.whyItMatters}</p>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                How to fix
              </h5>
              <ol className="space-y-1">
                {rec.implementationSteps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="mt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {rec.exampleFix && (
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Example fix
                </h5>
                <pre className="text-xs bg-foreground/5 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                  {rec.exampleFix}
                </pre>
              </div>
            )}

            {rec.affectedUrls.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Affected pages ({rec.affectedUrls.length})
                </h5>
                <ul className="space-y-0.5">
                  {rec.affectedUrls.slice(0, 5).map((url) => (
                    <li key={url} className="text-xs font-mono text-muted-foreground truncate">
                      {url}
                    </li>
                  ))}
                  {rec.affectedUrls.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      +{rec.affectedUrls.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
