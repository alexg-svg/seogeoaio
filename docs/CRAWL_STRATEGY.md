# Crawl and Parsing Strategy

## Overview

The crawler is a polite, single-domain, depth-limited HTTP crawler.
It runs synchronously within a Vercel Route Handler (max 300 s).
It does NOT use a headless browser — only static HTML fetched via `fetch()`.

---

## Robots.txt Handling

Before any page is fetched, the crawler:
1. Fetches `<origin>/robots.txt`.
2. Parses `Disallow:` and `Allow:` rules for user-agent `*` and `SEOAuditBot`.
3. Stores the robots.txt content for TECH_007 rule evaluation.
4. Blocks crawling of any URL matching a Disallow rule.
5. If robots.txt returns non-200: log as INFO, proceed with crawling (treat as unrestricted).

Crawl-delay from robots.txt is respected up to 2 seconds. Values > 2 s are clamped to 2 s.

---

## Input Mode A: Sitemap Ingestion

```
Input: sitemap URL (provided by user OR auto-discovered at /sitemap.xml)

1. Fetch sitemap URL
2. Detect type:
   a. Sitemap index (<sitemapindex>) → fetch each <loc> recursively (max 3 levels deep)
   b. URL set (<urlset>) → extract all <loc> values
3. Deduplicate URLs (case-insensitive, strip trailing slash, strip fragment)
4. Filter to same domain as the sitemap URL
5. Filter out robots.txt-blocked URLs
6. Sort by <priority> DESC (if present), then by <lastmod> DESC
7. Truncate to MAX_PAGES (50 for MVP)
8. Fetch each URL (with concurrency = 3)
```

Sitemap XML parser: `fast-xml-parser` (zero native dependencies, works in Vercel).

If the sitemap URL returns non-200 or is not valid XML:
- Mark audit with `errorMessage = "Sitemap could not be fetched or parsed"`
- Fall back to homepage-only crawl using the sitemap's origin

---

## Input Mode B: Homepage Crawl with Internal Link Discovery

```
Input: homepage URL

1. Fetch homepage
2. Parse HTML → extract all <a href> values
3. Normalise each href to an absolute URL
4. Filter: same domain only, HTTP/HTTPS only, no #fragment-only links
5. Deduplicate
6. Filter out robots.txt-blocked URLs
7. Add to BFS queue (up to MAX_PAGES - 1 = 49 discovered URLs)
8. Process queue with concurrency = 3
   - For each fetched page: repeat link extraction → add new same-domain URLs to queue
   - Stop when queue is empty OR page count reaches MAX_PAGES
```

BFS depth limit: 3 (avoids crawling deep pagination chains).

---

## Fetcher Behaviour

```typescript
// Per-request config (see lib/audit/crawler/fetcher.ts)
const FETCH_TIMEOUT_MS = 10_000;   // 10 s per page
const MAX_RETRIES = 1;             // 1 retry on network error (not on 4xx/5xx)
const RETRY_DELAY_MS = 1_000;
const USER_AGENT = "SEOAuditBot/1.0 (+https://yourdomain.com/bot)";
const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB; truncate beyond this
```

On fetch failure:
- Network error or timeout → mark page `statusCode = 0`, `isIndexable = false`
- 3xx → follow up to 5 redirects, record `redirectChainLength`
- 4xx/5xx → record status, mark `isIndexable = false`, still evaluate applicable rules

Request headers sent:
```
User-Agent: SEOAuditBot/1.0
Accept: text/html,application/xhtml+xml
Accept-Language: en
Cache-Control: no-cache
```

No cookies are sent. No JavaScript execution. No authentication.

---

## HTML Parsing

Library: `cheerio` (server-side, synchronous, familiar jQuery API).

Parsing happens in `lib/audit/parser/index.ts` which calls sub-parsers:

| Sub-parser | What it extracts |
|---|---|
| `meta.ts` | `<title>`, `<meta name="...">`, `<link rel="canonical">`, `<meta name="robots">`, OG tags, Twitter Card tags, viewport |
| `headings.ts` | All H1–H3 text content (preserving order) |
| `links.ts` | All `<a href>` → normalised absolute URLs; classify internal vs external |
| `images.ts` | All `<img>` → `{ src, alt }` pairs |
| `structured-data.ts` | All `<script type="application/ld+json">` → parsed JSON objects |
| `content.ts` | Stripped text content; word count (split on whitespace, filter stop words for density) |

Response size guard: if `rawHtml.length > 5 MB`, truncate before parsing and log a warning.

---

## Structured Data Extraction

```typescript
// For each <script type="application/ld+json"> on the page:
try {
  const obj = JSON.parse(scriptContent);
  // Handle both single objects and arrays (JSON-LD allows both)
  const blocks = Array.isArray(obj) ? obj : [obj];
  for (const block of blocks) {
    structuredData.push({
      context: block["@context"] ?? "",
      type: block["@type"] ?? "",
      raw: block,
      parseError: null,
    });
  }
} catch (e) {
  structuredData.push({ context: "", type: "", raw: {}, parseError: String(e) });
}
```

Microdata is not parsed in MVP (future work).

---

## Duplicate and Canonical Handling

- URLs are normalised before deduplication: scheme-lowercased, host-lowercased,
  trailing slash stripped, query string preserved, fragment stripped.
- If a page's canonical URL differs from its crawled URL:
  - `hasCanonicalMismatch = true`
  - The canonical URL target is added to the crawl queue (if it's the same domain and not already queued)
  - TECH_004 fires on the original URL
- If two crawled URLs have identical normalised forms: only the first is fetched.

---

## Page Cap and Truncation Behaviour

`MAX_PAGES = 50` is a hard limit. When reached:
- For sitemap mode: remaining sitemap URLs are stored as `pagesSkipped` count.
- For homepage mode: BFS stops when the queue would push count past 50.
- The audit result includes a `truncationWarning` if any pages were skipped.

---

## Concurrency and Rate Limiting

```typescript
// Simple token-bucket concurrency pool (lib/audit/crawler/index.ts)
const CONCURRENCY = 3;

// Process all URLs through a p-limit pool
const limit = pLimit(CONCURRENCY);
const results = await Promise.all(urls.map(url => limit(() => fetchAndParse(url))));
```

Library: `p-limit` (lightweight, no native deps).

Between requests: no artificial delay unless robots.txt specifies `Crawl-delay`.

---

## Failure Handling

| Failure type | Behaviour |
|---|---|
| `robots.txt` non-200 | Treat as unrestricted; log as INFO issue |
| Sitemap non-200 | Log error; fall back to homepage crawl |
| Sitemap invalid XML | Log error; fall back to homepage crawl |
| Page fetch timeout | Mark page `statusCode = 0`; record as skipped |
| Page 4xx/5xx | Record status; evaluate applicable rules; exclude from score average |
| HTML parse error | Record `parseError`; rules that require clean HTML return `skip` |
| JSON-LD parse error | Record `parseError` in `structuredData`; SD_002 fires |
| Pipeline total timeout (>280 s) | Finalise partial results; set status to COMPLETE with `truncationWarning` |

The pipeline wraps the full crawl in a `Promise.race` against a 280 s sentinel
(leaving 20 s buffer before Vercel's 300 s limit).

---

## Vercel-Specific Notes

- Route handler must export `export const maxDuration = 300;` (requires Vercel Pro).
- All fetching uses Node.js native `fetch` (available in Next.js 13.4+ / Node 18+).
- No filesystem writes during crawl (Vercel's serverless filesystem is ephemeral and read-only outside `/tmp`).
- Large HTML is never written to disk; everything is kept in memory within the request.
- If memory pressure is a concern (many large pages), set `MAX_RESPONSE_SIZE_BYTES` lower and truncate HTML before passing to cheerio.
