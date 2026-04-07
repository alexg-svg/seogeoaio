import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryScore, IssueCategory } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  TECHNICAL_SEO: "Technical SEO",
  ON_PAGE_SEO: "On-Page SEO",
  LOCAL_SEO: "Local SEO",
  STRUCTURED_DATA: "Structured Data",
  AEO: "AEO / LLM",
  CONTENT: "Content",
};

const CATEGORY_ICONS: Record<IssueCategory, string> = {
  TECHNICAL_SEO: "⚙️",
  ON_PAGE_SEO: "📝",
  LOCAL_SEO: "📍",
  STRUCTURED_DATA: "🔖",
  AEO: "🤖",
  CONTENT: "✍️",
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function progressColor(score: number) {
  if (score >= 80) return "[&>div]:bg-green-500";
  if (score >= 60) return "[&>div]:bg-yellow-500";
  if (score >= 40) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-red-500";
}

interface Props {
  categoryScores: CategoryScore[];
}

export function CategoryScoreGrid({ categoryScores }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Category Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryScores.map((cs) => (
            <div key={cs.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{CATEGORY_ICONS[cs.category]}</span>
                  <span>{CATEGORY_LABELS[cs.category]}</span>
                </div>
                <span className={cn("text-sm font-bold tabular-nums", scoreColor(cs.score))}>
                  {Math.round(cs.score)}
                </span>
              </div>
              <Progress value={cs.score} className={cn("h-2", progressColor(cs.score))} />
              {cs.issueCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {cs.issueCount} issue{cs.issueCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
