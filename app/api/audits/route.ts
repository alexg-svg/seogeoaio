import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  createAudit,
  discoverUrlsBackground,
  listAuditsForProject,
  listProjects,
} from "@/lib/audit-runner/intake";

// Vercel: allow up to 300 s for this function (Pro plan required for > 60 s)
export const maxDuration = 300;

// ─── POST /api/audits ─────────────────────────────────────────────────────────
// Body: { url: string, inputType?: "HOMEPAGE" | "SITEMAP" }
// Returns: { auditId, projectId, status, inputUrl, inputType }

const createAuditBody = z.object({
  url: z.string().url("Must be a valid URL"),
  // If omitted, the server auto-detects from the URL path
  inputType: z.enum(["HOMEPAGE", "SITEMAP"]).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAuditBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { url, inputType } = parsed.data;

  try {
    const result = await createAudit({ url, inputType });

    // Kick off URL discovery after the response is sent.
    // next/server `after()` runs the callback within the serverless function's
    // remaining time budget — no separate worker needed for MVP.
    after(async () => {
      await discoverUrlsBackground(
        result.auditId,
        result.inputUrl,
        result.inputType
      );
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.flatten().fieldErrors },
        { status: 422 }
      );
    }
    console.error("[POST /api/audits]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── GET /api/audits ──────────────────────────────────────────────────────────
// Query params:
//   ?projectId=xxx   → list audits for a specific project
//   (no params)      → list all projects with latest audit

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  try {
    if (projectId) {
      const audits = await listAuditsForProject(projectId);
      return NextResponse.json({ audits });
    }

    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/audits]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
