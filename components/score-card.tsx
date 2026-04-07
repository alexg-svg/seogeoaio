import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function scoreRingColor(score: number) {
  if (score >= 80) return "stroke-green-500";
  if (score >= 60) return "stroke-yellow-500";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-red-500";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs work";
  if (score >= 40) return "Poor";
  return "Critical";
}

interface ScoreCardProps {
  score: number;
  label?: string;
  subtitle?: string;
  size?: "lg" | "md";
}

export function ScoreCard({ score, label = "Overall Score", subtitle, size = "lg" }: ScoreCardProps) {
  const radius = size === "lg" ? 52 : 36;
  const strokeWidth = size === "lg" ? 8 : 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;

  return (
    <Card>
      <CardContent className={cn("flex flex-col items-center justify-center", size === "lg" ? "py-8" : "py-5")}>
        <div className="relative" style={{ width: svgSize, height: svgSize }}>
          <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-secondary"
            />
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={scoreRingColor(score)}
              transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-bold leading-none", scoreColor(score), size === "lg" ? "text-4xl" : "text-2xl")}>
              {score}
            </span>
            <span className="text-xs text-muted-foreground mt-1">/100</span>
          </div>
        </div>
        <p className={cn("font-semibold mt-3", size === "lg" ? "text-base" : "text-sm")}>{label}</p>
        <p className={cn("text-muted-foreground mt-0.5", size === "lg" ? "text-sm" : "text-xs")}>
          {subtitle ?? scoreLabel(score)}
        </p>
      </CardContent>
    </Card>
  );
}
