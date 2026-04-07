# Implementation Roadmap

## Pass 2 — Backend and Audit Engine

Goal: A working, testable audit pipeline accessible via API routes.
No UI beyond raw JSON responses.

### 2.1 Project Bootstrap
- [ ] `npx create-next-app@latest` with TypeScript, Tailwind, App Router
- [ ] Install dependencies:
  - `prisma`, `@prisma/client`
  - `cheerio`
  - `fast-xml-parser`
  - `p-limit`
  - `zod`
  - `crypto` (built-in, for fingerprint hashing)
- [ ] Configure `prisma/schema.prisma` (already designed in this repo)
- [ ] Run `prisma migrate dev --name init`
- [ ] Create `lib/db/index.ts` Prisma singleton (with global caching for Next.js hot reload)
- [ ] Set up `.env.local` with `DATABASE_URL`

### 2.2 Crawl Layer (`lib/audit/crawler/`)
- [ ] `fetcher.ts`: `fetchPage(url) → { html, statusCode, headers, finalUrl, redirectChain, durationMs }`
  - AbortController timeout (10 s)
  - Follow redirects (max 5), record chain length
  - Truncate response at 5 MB
  - Set User-Agent header
- [ ] `robots.ts`: `fetchRobots(origin) → RobotsResult`
  - Parse Disallow/Allow rules for `*` and `SEOAuditBot`
  - Extract `Sitemap:` entries
  - Handle Crawl-delay (clamp to 2 s)
  - `isBlocked(url, robotsResult) → boolean`
- [ ] `sitemap.ts`: `fetchSitemap(url) → string[]`
  - Detect sitemap index vs URL set
  - Recursive fetch for index (max 3 levels)
  - Extract and normalise `<loc>` values
  - Limit to 50 URLs
- [ ] `link-discovery.ts`: `extractInternalLinks(html, baseUrl) → string[]`
  - Use cheerio to find all `<a href>`
  - Normalise to absolute URLs
  - Filter: same origin, HTTP/HTTPS only, no fragments-only
- [ ] `index.ts`: `crawlSite(input: StartAuditRequest) → CrawlResult`
  - Branches on HOMEPAGE vs SITEMAP input
  - BFS with depth limit 3 for homepage mode
  - p-limit concurrency pool (3)
  - 280 s overall timeout guard
  - Returns `{ pages: RawPage[], pagesSkipped, crawlDurationMs }`

### 2.3 Parser Layer (`lib/audit/parser/`)
- [ ] `meta.ts`: extract title, meta tags, canonical, noindex, OG, Twitter Card, viewport
- [ ] `headings.ts`: extract H1/H2/H3 arrays in document order
- [ ] `links.ts`: classify internal vs external, count each
- [ ] `images.ts`: extract `{ src, alt }` pairs, count missing alt
- [ ] `structured-data.ts`: extract and parse all JSON-LD blocks
- [ ] `content.ts`: strip HTML tags, count words (split on whitespace)
- [ ] `index.ts`: `parsePage(raw: RawPage) → ParsedPage`
  - Calls all sub-parsers
  - Computes `isIndexable`, `hasCanonicalMismatch`

### 2.4 Rule Engine (`lib/audit/rules/`)
- [ ] `types.ts`: `RuleDefinition`, `RuleResult` types (already in `types/audit.ts`)
- [ ] `index.ts`: `ALL_RULES: RuleDefinition[]` registry
- [ ] Implement all PAGE rules (one function per rule):
  - `technical.ts`: TECH_001–TECH_016 (skip TECH_013/014 here; those are sitewide)
  - `on-page.ts`: ONPAGE_001–ONPAGE_011
  - `local-seo.ts`: LOCAL_001–LOCAL_007 (homepage-only rules must check `isHomepage` flag)
  - `structured-data.ts`: SD_001–SD_010
  - `aeo.ts`: AEO_001–AEO_008
- [ ] Implement SITE rules (receive `ParsedPage[]`):
  - `cannibalization.ts`: CONTENT_001–CONTENT_006
  - Sitewide technical rules: TECH_013, TECH_014
- [ ] `runPageRules(page: ParsedPage, isHomepage: boolean) → RuleResult[]`
- [ ] `runSiterules(pages: ParsedPage[]) → RuleResult[]`
- [ ] Fingerprint generation: `sha256(auditId + ruleId + (url || "sitewide"))`

### 2.5 Scoring Engine (`lib/audit/scoring/`)
- [ ] `weights.ts`: export `CATEGORY_WEIGHTS`, `SEVERITY_SCORE_IMPACT`
- [ ] `page-score.ts`: `computePageScore(pageResults: RuleResult[]) → { pageScore, categoryScores }`
- [ ] `site-score.ts`: `computeSiteScore(allPageScores, sitewideResults) → { overallScore, categoryScores }`
- [ ] Anti-inflation guards: one issue per (rule, page); category floor 0; exclude non-indexable pages

### 2.6 Recommendation Engine (`lib/audit/recommendations/`)
- [ ] `templates.ts`: static `Record<ruleId, RecommendationTemplate>` for all 45 rules
  - Each template: `{ title, summary, whyItMatters, implementationSteps, exampleFix, impact, effort }`
- [ ] `index.ts`: `buildRecommendations(ruleResults: RuleResult[]) → RecommendationResult[]`
  - Group results by ruleId
  - Merge page-level results into one recommendation per rule
  - Compute `priority` formula
  - Sort by priority ASC

### 2.7 Pipeline (`lib/audit/pipeline.ts`)
- [ ] `runAuditPipeline(auditId: string) → void`
  - Update `Audit.status` to CRAWLING
  - Run crawl → get `CrawlResult`
  - Parse each page → `ParsedPage[]`
  - Update status to ANALYZING
  - Run page rules on each page
  - Run sitewide rules on `ParsedPage[]`
  - Compute scores
  - Build recommendations
  - Persist: `AuditedPage`, `Issue`, `Recommendation`, `CategoryScore`, `PageCategoryScore`
  - Update `Audit.status` to COMPLETE + `overallScore`, `completedAt`
  - On any unhandled error: set status to FAILED + `errorMessage`

### 2.8 API Routes
- [ ] `POST /api/audit/start`
  - Validate request body with Zod (`lib/validators/audit-input.ts`)
  - Create `Audit` record → get `auditId`
  - Call `runAuditPipeline(auditId)` (awaited, synchronous for MVP)
  - Return `{ auditId, status }`
  - Export `maxDuration = 300`
- [ ] `GET /api/audit/:id/status`
  - Fetch `Audit` + `CategoryScore[]` + top-5 `Recommendation[]`
  - Return `AuditStatusResponse`
- [ ] `GET /api/audit/:id/export`
  - Accept `?format=json|csv` query param
  - JSON: serialise full `AuditExportPayload`
  - CSV: flatten `AuditedPage[].Issue[]` into rows

### 2.9 Validation
- [ ] Zod schema for `StartAuditRequest`: URL format, inputType enum
- [ ] URL normalisation: ensure scheme, no trailing params that break crawl

### 2.10 Testing Targets (Pass 2)
- Unit tests for each rule in isolation (happy path + failure path)
- Unit tests for scoring functions
- Unit tests for recommendation priority sort
- Integration test: crawl a known static HTML fixture, check expected issues

---

## Pass 3 — Frontend Dashboard and Exports

Goal: A polished, production-ready UI on top of the working backend.

### 3.1 Landing Page (`app/page.tsx`)
- URL input field with placeholder examples
- Toggle: Homepage URL / Sitemap URL
- Submit button → POST to `/api/audit/start` → redirect to `/audit/:id`
- Client-side validation with Zod + react-hook-form
- Minimal hero copy explaining what the tool does

### 3.2 Progress Page (`app/audit/[id]/page.tsx`)
- Server Component initial load (check if already complete)
- Client Component polling `GET /api/audit/:id/status` every 3 s while status ≠ COMPLETE | FAILED
- Show: crawl progress bar, pages crawled count, current status label
- On FAILED: show error message with retry option
- On COMPLETE: render dashboard

### 3.3 Results Dashboard (`components/audit/AuditDashboard.tsx`)
Layout:
```
[ Overall Score Ring ]   [ Category Score Grid (6 cards) ]

[ Tabs: Recommendations | Issues | Pages ]

Tab: Recommendations
  → RecommendationList — sorted cards with impact/effort badges

Tab: Issues
  → IssueTable — filterable by category + severity
                  columns: rule, page, severity, detail, score impact

Tab: Pages
  → DataTable of all pages sorted by pageScore ASC
    → Click row → PageDrawer side panel with per-page issues
```

### 3.4 Component Checklist
- [ ] `ScoreRing.tsx`: SVG circle, animated fill, colour coded (red/yellow/green)
- [ ] `CategoryScoreGrid.tsx`: 6 score cards with label, score, issue count
- [ ] `RecommendationList.tsx`: sorted cards; each shows title, summary, impact badge, effort badge, affected page count, expand for steps
- [ ] `IssueTable.tsx`: shadcn/ui DataTable; filter sidebar by category + severity; sort by scoreImpact DESC
- [ ] `PageDrawer.tsx`: shadcn/ui Sheet; per-page score, per-page category scores, per-page issues table
- [ ] `AuditProgress.tsx`: progress spinner + stats during crawl
- [ ] `AuditForm.tsx`: URL input + type toggle + submit

### 3.5 Export UI
- Download JSON button → `window.open(/api/audit/:id/export?format=json)`
- Download CSV button → `window.open(/api/audit/:id/export?format=csv)`

### 3.6 Error States
- Invalid URL input (client-side)
- Audit not found (404 page)
- Audit failed (show errorMessage + retry button)
- Empty audit result (all pages blocked by robots.txt)

### 3.7 Deployment
- [ ] Vercel project setup with environment variables (`DATABASE_URL`, etc.)
- [ ] Confirm `maxDuration = 300` is supported on selected Vercel plan
- [ ] `prisma generate` in build step (`package.json` `build` script)
- [ ] Neon or Supabase connection pool URL (not direct URL) for serverless compatibility
- [ ] Smoke test full flow on Vercel preview deploy

---

## Future Passes (Post-MVP Reference)

| Pass | Scope |
|---|---|
| Pass 4 | User auth (NextAuth.js), Project model, audit history |
| Pass 5 | Scheduled/recurring audits (Vercel Cron + queue) |
| Pass 6 | PDF export (Puppeteer on a separate long-running service or external API) |
| Pass 7 | Google Search Console integration (OAuth + property data) |
| Pass 8 | Core Web Vitals via CrUX API (free, no PageSpeed needed) |
| Pass 9 | AI-enhanced recommendations (Claude API for per-site contextualised advice) |
| Pass 10 | Multi-project dashboard, team sharing, white-label export |
