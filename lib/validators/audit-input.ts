import { z } from "zod";

export const startAuditSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      "URL must start with http:// or https://"
    ),
  inputType: z.enum(["HOMEPAGE", "SITEMAP"]),
});

export type StartAuditInput = z.infer<typeof startAuditSchema>;

/** Normalise a URL: lowercase scheme+host, strip trailing slash, strip fragment. */
export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch {
    return raw;
  }
}

/** Return true if the URL is on the same origin as the base. */
export function isSameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}
