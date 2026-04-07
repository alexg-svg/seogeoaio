import type { FetchedPage } from "./types";

const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB — large enough for any real page
const USER_AGENT =
  "SEOAuditBot/1.0 (+https://github.com/alexg-svg/seogeoaio)";

/**
 * Fetch a single URL for HTML parsing.
 *
 * - Follows redirects (native fetch, up to 20 hops).
 * - Enforces a hard 10 s timeout via AbortController.
 * - Truncates responses over 5 MB (still useful for <head> parsing).
 * - Returns a typed FetchedPage — never throws.
 */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let finalUrl = url;
  let redirectCount = 0;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
    });

    clearTimeout(timer);

    finalUrl = response.url || url;
    // Native fetch collapses the chain — count only if URL changed
    if (finalUrl !== url) redirectCount = 1;

    const contentType = response.headers.get("content-type") ?? "";

    if (!isHtmlContentType(contentType)) {
      return {
        url: finalUrl,
        originalUrl: url,
        statusCode: response.status,
        redirectCount,
        contentType,
        html: null,
        durationMs: Date.now() - start,
        error: `Skipped — non-HTML content type: ${contentType}`,
      };
    }

    const html = await readBodyWithLimit(response);

    return {
      url: finalUrl,
      originalUrl: url,
      statusCode: response.status,
      redirectCount,
      contentType,
      html,
      durationMs: Date.now() - start,
      error: null,
    };
  } catch (err: unknown) {
    clearTimeout(timer);

    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));

    return {
      url: finalUrl,
      originalUrl: url,
      statusCode: 0,
      redirectCount,
      contentType: "",
      html: null,
      durationMs: Date.now() - start,
      error: isAbort ? `Timed out after ${TIMEOUT_MS}ms` : String(err),
    };
  }
}

/**
 * Read the response body up to MAX_BODY_BYTES.
 * Returns the decoded string; may be truncated on very large pages.
 */
async function readBodyWithLimit(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const remaining = MAX_BODY_BYTES - total;
    if (value.byteLength >= remaining) {
      chunks.push(value.slice(0, remaining));
      // Cancel the stream rather than letting it drain
      await reader.cancel("size limit").catch(() => {});
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function isHtmlContentType(ct: string): boolean {
  return ct.includes("text/html") || ct.includes("application/xhtml");
}

/**
 * Fetch with one retry on network errors (not on 4xx/5xx — those are real).
 */
export async function fetchPageWithRetry(url: string): Promise<FetchedPage> {
  const first = await fetchPage(url);
  if (first.statusCode === 0 && first.error) {
    await new Promise((r) => setTimeout(r, 1_000));
    return fetchPage(url);
  }
  return first;
}
