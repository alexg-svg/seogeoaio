"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IssueSeverity, IssueCategory } from "@/lib/api-types";

export interface FilterState {
  search: string;
  severity: IssueSeverity | "ALL";
  category: IssueCategory | "ALL";
  scope: "ALL" | "PAGE" | "SITEWIDE";
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function DashboardFilters({ filters, onChange }: Props) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.severity !== "ALL" ||
    filters.category !== "ALL" ||
    filters.scope !== "ALL";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search issues…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Select
        value={filters.severity}
        onValueChange={(v) => onChange({ ...filters, severity: v as FilterState["severity"] })}
      >
        <SelectTrigger className="w-36 h-8 text-sm">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All severities</SelectItem>
          <SelectItem value="CRITICAL">Critical</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="LOW">Low</SelectItem>
          <SelectItem value="INFO">Info</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.category}
        onValueChange={(v) => onChange({ ...filters, category: v as FilterState["category"] })}
      >
        <SelectTrigger className="w-44 h-8 text-sm">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All categories</SelectItem>
          <SelectItem value="TECHNICAL_SEO">Technical SEO</SelectItem>
          <SelectItem value="ON_PAGE_SEO">On-Page SEO</SelectItem>
          <SelectItem value="LOCAL_SEO">Local SEO</SelectItem>
          <SelectItem value="STRUCTURED_DATA">Structured Data</SelectItem>
          <SelectItem value="AEO">AEO / LLM</SelectItem>
          <SelectItem value="CONTENT">Content</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.scope}
        onValueChange={(v) => onChange({ ...filters, scope: v as FilterState["scope"] })}
      >
        <SelectTrigger className="w-32 h-8 text-sm">
          <SelectValue placeholder="Scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All scopes</SelectItem>
          <SelectItem value="PAGE">Page</SelectItem>
          <SelectItem value="SITEWIDE">Sitewide</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange({ search: "", severity: "ALL", category: "ALL", scope: "ALL" })}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
