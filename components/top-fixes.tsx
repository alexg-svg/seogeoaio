import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationCard } from "@/components/recommendation-card";
import type { Recommendation } from "@/lib/api-types";

interface Props {
  recommendations: Recommendation[];
}

/**
 * Top fixes: sorted by priority (ascending = most important first).
 */
export function TopFixes({ recommendations }: Props) {
  const top = [...recommendations].sort((a, b) => a.priority - b.priority).slice(0, 8);

  if (top.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Top Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {top.map((rec, i) => (
          <RecommendationCard key={rec.ruleId} rec={rec} rank={i + 1} />
        ))}
      </CardContent>
    </Card>
  );
}
