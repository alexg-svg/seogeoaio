"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreateAuditResponse } from "@/lib/api-types";

export function UrlSubmitForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [inputType, setInputType] = useState<"auto" | "HOMEPAGE" | "SITEMAP">("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          ...(inputType !== "auto" ? { inputType } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create audit");
        return;
      }

      const audit = data as CreateAuditResponse;

      // Trigger the pipeline
      await fetch(`/api/audits/${audit.auditId}`, { method: "POST" });

      router.push(`/audits/${audit.auditId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com or https://example.com/sitemap.xml"
            className="pl-9 h-11 text-base"
          />
        </div>
        <Button type="submit" disabled={loading} className="h-11 px-6">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            "Audit"
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Input type:</span>
        <Select value={inputType} onValueChange={(v) => setInputType(v as typeof inputType)}>
          <SelectTrigger className="w-44 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="HOMEPAGE">Homepage URL</SelectItem>
            <SelectItem value="SITEMAP">Sitemap URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
