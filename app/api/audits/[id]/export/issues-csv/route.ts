import { prisma } from "@/lib/db";

export const maxDuration = 60;

const CSV_HEADERS = [
  "rule_id",
  "rule_name",
  "category",
  "severity",
  "scope",
  "url",
  "detail",
  "score_impact",
];

function csvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      // Wrap in quotes if the value contains comma, quote, or newline
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!audit) {
    return new Response("Audit not found", { status: 404 });
  }

  if (audit.status !== "COMPLETE") {
    return new Response(`Audit is not complete (status: ${audit.status})`, {
      status: 409,
    });
  }

  // Stream all issues without joining pages (url is on Issue directly or via page)
  const issues = await prisma.issue.findMany({
    where: { auditId: id },
    orderBy: [{ severity: "asc" }, { scoreImpact: "desc" }],
    include: {
      page: { select: { url: true } },
    },
  });

  const lines: string[] = [csvRow(CSV_HEADERS)];

  for (const issue of issues) {
    lines.push(
      csvRow([
        issue.ruleId,
        issue.ruleName,
        issue.category,
        issue.severity,
        issue.scope,
        issue.page?.url ?? "", // sitewide issues have no page
        issue.detail,
        issue.scoreImpact,
      ])
    );
  }

  const csv = lines.join("\n");
  const filename = `audit-${id}-issues.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
