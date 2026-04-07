export interface RobotsResult {
  accessible: boolean;
  hasSitemapDirective: boolean;
  sitemapUrls: string[];
  crawlDelayMs: number; // clamped to [0, 2000]
  raw: string;
  disallowedPaths: string[]; // for USER_AGENT * rules
}

const USER_AGENT = "seogeoaibot"; // lowercase for matching

/**
 * Fetch and parse robots.txt for a given origin.
 * Returns a safe default (unrestricted crawl) on failure.
 */
export async function fetchRobots(origin: string): Promise<RobotsResult> {
  const url = `${origin}/robots.txt`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "SEOAuditBot/1.0 (+https://github.com/alexg-svg/seogeoaio)",
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return unrestricted(false, "", []);
    }

    const raw = await response.text();
    return parseRobots(raw);
  } catch {
    clearTimeout(timer);
    return unrestricted(false, "", []);
  }
}

function parseRobots(raw: string): RobotsResult {
  const lines = raw.split(/\r?\n/);
  const sitemapUrls: string[] = [];
  const disallowedPaths: string[] = [];
  let crawlDelayMs = 0;

  // Track whether we're inside a block that applies to our bot
  let inRelevantBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === "user-agent") {
      const ua = value.toLowerCase();
      inRelevantBlock = ua === "*" || ua === USER_AGENT;
      continue;
    }

    if (field === "sitemap") {
      sitemapUrls.push(value);
      continue;
    }

    if (!inRelevantBlock) continue;

    if (field === "disallow" && value) {
      disallowedPaths.push(value);
    } else if (field === "crawl-delay") {
      const seconds = parseFloat(value);
      if (!isNaN(seconds)) {
        crawlDelayMs = Math.min(Math.round(seconds * 1000), 2_000);
      }
    }
  }

  return {
    accessible: true,
    hasSitemapDirective: sitemapUrls.length > 0,
    sitemapUrls,
    crawlDelayMs,
    raw,
    disallowedPaths,
  };
}

/** Check whether a URL's path is disallowed by the parsed robots rules. */
export function isRobotsBlocked(
  url: string,
  robots: RobotsResult
): boolean {
  if (!robots.accessible || robots.disallowedPaths.length === 0) return false;
  try {
    const path = new URL(url).pathname;
    return robots.disallowedPaths.some(
      (d) => d !== "" && path.startsWith(d)
    );
  } catch {
    return false;
  }
}

function unrestricted(
  accessible: boolean,
  raw: string,
  sitemapUrls: string[]
): RobotsResult {
  return {
    accessible,
    hasSitemapDirective: sitemapUrls.length > 0,
    sitemapUrls,
    crawlDelayMs: 0,
    raw,
    disallowedPaths: [],
  };
}
