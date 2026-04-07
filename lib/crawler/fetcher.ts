export interface FetchResult {
  html: string | null;
  statusCode: number;
  finalUrl: string;
  redirectChainLength: number;
  fetchDurationMs: number;
  contentType: string;
  error: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const USER_AGENT =
  "SEOAuditBot/1.0 (+https://github.com/alexg-svg/seogeoaio)";

/**
 * Fetch a single URL, following redirects and enforcing a hard timeout.
 * Returns a FetchResult regardless of success — never throws.
 */
export async function fetchPage(url: string): Promise<FetchResult> {
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let finalUrl = url;
  let redirectChainLength = 0;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
    });

    clearTimeout(timer);

    finalUrl = response.url ?? url;
    // Count redirects by comparing original vs final URL (native fetch collapses them)
    if (finalUrl !== url) redirectChainLength = 1;

    const contentType = response.headers.get("content-type") ?? "";

    // Only parse HTML-like content
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return {
        html: null,
        statusCode: response.status,
        finalUrl,
        redirectChainLength,
        fetchDurationMs: Date.now() - start,
        contentType,
        error: `Non-HTML content type: ${contentType}`,
      };
    }

    // Read body with size guard
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        html: null,
        statusCode: response.status,
        finalUrl,
        redirectChainLength,
        fetchDurationMs: Date.now() - start,
        contentType,
        error: "No response body",
      };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        // Truncate — still useful for meta/head parsing
        chunks.push(value.slice(0, MAX_BODY_BYTES - (totalBytes - value.byteLength)));
        break;
      }
      chunks.push(value);
    }

    const html = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.byteLength + chunk.byteLength);
        merged.set(acc, 0);
        merged.set(chunk, acc.byteLength);
        return merged;
      }, new Uint8Array(0))
    );

    return {
      html,
      statusCode: response.status,
      finalUrl,
      redirectChainLength,
      fetchDurationMs: Date.now() - start,
      contentType,
      error: null,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout =
      err instanceof Error && err.name === "AbortError";
    return {
      html: null,
      statusCode: 0,
      finalUrl,
      redirectChainLength,
      fetchDurationMs: Date.now() - start,
      contentType: "",
      error: isTimeout ? "Request timed out" : String(err),
    };
  }
}

/**
 * Fetch a URL and retry once on network error (not on 4xx/5xx).
 */
export async function fetchWithRetry(url: string): Promise<FetchResult> {
  const result = await fetchPage(url);
  if (result.statusCode === 0 && result.error) {
    // One retry after a short pause
    await new Promise((r) => setTimeout(r, 1_000));
    return fetchPage(url);
  }
  return result;
}
