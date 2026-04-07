"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  auditId: string;
}

export function ExportButtons({ auditId }: Props) {
  function download(path: string) {
    const a = document.createElement("a");
    a.href = `/api/audits/${auditId}/${path}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => download("export/json")}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export JSON
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => download("export/issues-csv")}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Issues CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => download("export/pages-csv")}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Pages CSV
      </Button>
    </div>
  );
}
