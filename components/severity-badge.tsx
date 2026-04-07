import { cn } from "@/lib/utils";
import type { IssueSeverity } from "@/lib/api-types";

const config: Record<IssueSeverity, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-red-100 text-red-800 border-red-200" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-200" },
  MEDIUM: { label: "Medium", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  LOW: { label: "Low", className: "bg-blue-100 text-blue-800 border-blue-200" },
  INFO: { label: "Info", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const { label, className } = config[severity];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  );
}
