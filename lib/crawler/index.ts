import type { StartAuditInput } from "@/lib/validators/audit-input";
import { normaliseUrl, isSameOrigin } from "@/lib/validators/audit-input";
import { fetchWithRetry } from "./fetcher";
import { fetchRobots, isRobotsBlocked, type RobotsResult } from "./robots";
import { fetchSitemapUrls, discoverSitemap } from "./sitemap";
import { extractInternalLinks } from "./link-discovery";

const MAX_PAGES = 50;
const CONCURRENCY = 3;
const BFS_MAX_DEPTH = 3;
const PIPELINE_TIMEOUT_MS = 270_000; // 270 s — leaves buffer before Vercel's 300 s limit

export interface RawPage {
  url: string;
  originalUrl: string;
  html: string | null;
  statusCode: number;
  finalUrl: string;
  redirectChainLength: number;
  fetchDurationMs: number;
  error: string | null;
  robotsBlocked: boolean;
}

export interface CrawlResult {
  pages: RawPage[];
  pagesSkipped: number;
  robots: RobotsResult;
  crawlDurationMs: number;
  truncated: boolean;
}

/**
 * Main crawl entry point. Dispatches to sitemap or BFS homepage crawl.
 * Wraps the entire crawl in a timeout guard.
 */
export async function crawlSite(input: StartAuditInput): Promise<CrawlResult> {
  const start = Date.now();

  const origin = (() => {
    try {
      return new URL(input.url).origin;
    } catch {
      return input.url;
    }
  })();

  const robots = await fetchRobots(origin);

  let urlsToCrawl: string[];

  if (input.inputType === "SITEMAP") {
    urlsToCrawl = await fetchSitemapUrls(input.url);
    if (urlsToCrawl.length === 0) {
      // Sitemap failed — fall back to BFS from the sitemap's origin
      urlsToCrawl = [origin + "/"];
    }
  } else {
    urlsToCrawl = [normaliseUrl(input.url)];
  }

  const result = await withTimeout(
    crawlUrls(urlsToCrawl, robots, origin, input.inputType === "HOMEPAGE"),
    PIPELINE_TIMEOUT_MS
  );

  return {
    ...result,
    robots,
    crawlDurationMs: Date.now() - start,
  };
}

async function crawlUrls(
  seedUrls: string[],
  robots: RobotsResult,
  origin: string,
  discoverLinks: boolean
): Promise<Omit<CrawlResult, "robots" | "crawlDurationMs">> {
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = seedUrls.map((u) => ({
    url: normaliseUrl(u),
    depth: 0,
  }));
  const pages: RawPage[] = [];
  let pagesSkipped = 0;
  let truncated = false;

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    // Drain up to CONCURRENCY items from the queue at once
    const batch = queue.splice(0, CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async ({ url, depth }) => {
        const norm = normaliseUrl(url);

        if (visited.has(norm)) return null;
        visited.add(norm);

        // robots.txt block check
        if (isRobotsBlocked(norm, robots)) {
          pagesSkipped++;
          return {
            rawPage: {
              url: norm,
              originalUrl: url,
              html: null,
              statusCode: 0,
              finalUrl: norm,
              redirectChainLength: 0,
              fetchDurationMs: 0,
              error: "Blocked by robots.txt",
              robotsBlocked: true,
            } satisfies RawPage,
            discoveredLinks: [] as string[],
            depth,
          };
        }

        const fetched = await fetchWithRetry(norm);
        const rawPage: RawPage = {
          url: norm,
          originalUrl: url,
          html: fetched.html,
          statusCode: fetched.statusCode,
          finalUrl: normaliseUrl(fetched.finalUrl),
          redirectChainLength: fetched.redirectChainLength,
          fetchDurationMs: fetched.fetchDurationMs,
          error: fetched.error,
          robotsBlocked: false,
        };

        let discoveredLinks: string[] = [];
        if (discoverLinks && fetched.html && depth < BFS_MAX_DEPTH) {
          discoveredLinks = extractInternalLinks(fetched.html, norm);
        }

        return { rawPage, discoveredLinks, depth };
      })
    );

    for (const item of batchResults) {
      if (!item) continue;
      pages.push(item.rawPage);

      if (discoverLinks && item.discoveredLinks.length > 0) {
        for (const link of item.discoveredLinks) {
          const norm = normaliseUrl(link);
          if (
            !visited.has(norm) &&
            isSameOrigin(norm, origin) &&
            pages.length + queue.length < MAX_PAGES
          ) {
            queue.push({ url: norm, depth: item.depth + 1 });
          }
        }
      }
    }
  }

  if (queue.length > 0) {
    pagesSkipped += queue.length;
    truncated = true;
  }

  return { pages, pagesSkipped, truncated };
}

/** Race a promise against a timeout. Resolves partial result on timeout. */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Crawl timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}
