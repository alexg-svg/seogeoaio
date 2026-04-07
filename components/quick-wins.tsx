import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationCard } from "@/components/recommendation-card";
import type { Recommendation } from "@/lib/api-types";

interface Props {
  recommendations: Recommendation[];
}

/**
 * Quick wins: HIGH impact + LOW effort, sorted by totalScoreImpact desc.
 */
export function QuickWins({ recommendations }: Props) {
  const wins = recommendations
    .filter((r) => r.impact === "HIGH" && r.effort === "LOW")
    .sort((a, b) => b.totalScoreImpact - a.totalScoreImpact)
    .slice(0, 5);

  if (wins.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Quick Wins
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            High impact · Low effort
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {wins.map((rec, i) => (
          <RecommendationCard key={rec.ruleId} rec={rec} rank={i + 1} />
        ))}
      </CardContent>
    </Card>
  );
}
