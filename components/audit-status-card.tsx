"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AuditStatus, AuditStatusResponse } from "@/lib/api-types";

const STATUS_PROGRESS: Record<AuditStatus, number> = {
  PENDING: 10,
  CRAWLING: 35,
  ANALYZING: 70,
  COMPLETE: 100,
  FAILED: 100,
};

const STATUS_LABEL: Record<AuditStatus, string> = {
  PENDING: "Queued — waiting to start",
  CRAWLING: "Crawling pages…",
  ANALYZING: "Running audit rules…",
  COMPLETE: "Audit complete",
  FAILED: "Audit failed",
};

interface Props {
  auditId: string;
  onComplete?: (data: AuditStatusResponse) => void;
}

export function AuditStatusCard({ auditId, onComplete }: Props) {
  const [status, setStatus] = useState<AuditStatusResponse | null>(null);
  const [error, setError] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/audits/${auditId}?view=status`);
      if (!res.ok) { setError(true); return; }
      const data: AuditStatusResponse = await res.json();
      setStatus(data);
      if (data.status === "COMPLETE" || data.status === "FAILED") {
        onComplete?.(data);
      }
    } catch {
      setError(true);
    }
  }, [auditId, onComplete]);

  useEffect(() => {
    poll();
    const interval = setInterval(() => {
      if (status?.status === "COMPLETE" || status?.status === "FAILED") {
        clearInterval(interval);
        return;
      }
      poll();
    }, 3000);
    return () => clearInterval(interval);
  }, [poll, status?.status]);

  const currentStatus = status?.status ?? "PENDING";
  const progress = STATUS_PROGRESS[currentStatus];
  const isTerminal = currentStatus === "COMPLETE" || currentStatus === "FAILED";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {currentStatus === "COMPLETE" ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : currentStatus === "FAILED" ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : error ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
          {error ? "Could not load status" : STATUS_LABEL[currentStatus]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress
          value={progress}
          className={currentStatus === "FAILED" ? "[&>div]:bg-destructive" : ""}
        />

        {status && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="URL" value={status.inputUrl} mono />
            <Stat label="Type" value={status.inputType} />
            {status.discoveredUrlCount > 0 && (
              <Stat label="URLs found" value={String(status.discoveredUrlCount)} />
            )}
            {status.pagesCrawled > 0 && (
              <Stat label="Pages crawled" value={String(status.pagesCrawled)} />
            )}
            {status.overallScore !== null && (
              <Stat label="Score" value={`${status.overallScore}/100`} />
            )}
          </div>
        )}

        {status?.status === "FAILED" && status.errorMessage && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {status.errorMessage}
          </p>
        )}

        {!isTerminal && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Refreshing every 3 seconds…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
