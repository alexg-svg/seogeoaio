import { NextRequest, NextResponse } from "next/server";
import { getAuditById, getAuditStatus } from "@/lib/audit-runner/intake";

// ─── GET /api/audits/[id] ─────────────────────────────────────────────────────
// Query params:
//   ?view=status   → lightweight status-only response (for polling)
//   (default)      → full audit detail

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");

  try {
    if (view === "status") {
      const audit = await getAuditStatus(id);
      if (!audit) {
        return NextResponse.json({ error: "Audit not found" }, { status: 404 });
      }
      return NextResponse.json(audit);
    }

    const audit = await getAuditById(id);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }
    return NextResponse.json(audit);
  } catch (err) {
    console.error(`[GET /api/audits/${id}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
