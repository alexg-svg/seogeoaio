import { prisma } from "@/lib/db";

export const maxDuration = 60;

const CSV_HEADERS = [
  "url",
  "status_code",
  "is_indexable",
  "page_score",
  "title",
  "title_length",
  "meta_description",
  "h1",
  "word_count",
  "internal_links",
  "external_links",
  "image_count",
  "images_without_alt",
  "canonical_url",
  "has_canonical_mismatch",
  "issue_count",
];

function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v == null) return "";
      const s = String(v);
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

  const pages = await prisma.auditedPage.findMany({
    where: { auditId: id },
    orderBy: { pageScore: "asc" },
    include: {
      _count: { select: { issues: true } },
    },
  });

  const lines: string[] = [csvRow(CSV_HEADERS)];

  for (const p of pages) {
    lines.push(
      csvRow([
        p.url,
        p.statusCode,
        p.isIndexable,
        p.pageScore ?? "",
        p.title ?? "",
        p.title ? p.title.length : "",
        p.metaDescription ?? "",
        p.h1 ?? "",
        p.wordCount ?? "",
        p.internalLinkCount ?? "",
        p.externalLinkCount ?? "",
        p.imageCount ?? "",
        p.imagesWithoutAlt ?? "",
        p.canonicalUrl ?? "",
        p.hasCanonicalMismatch,
        p._count.issues,
      ])
    );
  }

  const csv = lines.join("\n");
  const filename = `audit-${id}-pages.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
