# SEO Audit App — MVP Architecture

## 1. Architecture Summary

The application is a Vercel-hosted Next.js App Router project that accepts a URL
(homepage or sitemap), crawls the target site, evaluates ~45 deterministic audit
rules across 6 categories, scores results, and surfaces prioritised recommendations.

```
Browser
  │
  ├── POST /api/audit/start          ← submit URL, get audit ID
  │         │
  │         └── AuditPipeline.run()
  │               ├── Crawler        (fetch pages, respect robots.txt)
  │               ├── Parser         (extract signals from HTML)
  │               ├── RuleEngine     (evaluate rules per page + sitewide)
  │               ├── ScoringEngine  (compute page + category + site scores)
  │               └── RecommendationEngine (de-dup, rank, persist)
  │
  ├── GET  /api/audit/:id/status     ← poll for completion + partial data
  └── GET  /api/audit/:id/export     ← JSON / CSV download

PostgreSQL (via Prisma)
  └── Audit → AuditedPage → Issue ← Recommendation
                          └── PageCategoryScore
              └── CategoryScore
```

### Layer Responsibilities

| Layer | Location | Responsibility |
|---|---|---|
| Frontend | `app/` | URL input form, progress polling, results dashboard |
| API Routes | `app/api/` | Entry points; orchestrate pipeline, return status |
| Crawler | `lib/audit/crawler/` | Fetch pages, parse sitemaps, discover links |
| Parser | `lib/audit/parser/` | Extract SEO signals from raw HTML |
| Rule Engine | `lib/audit/rules/` | Evaluate one rule at a time; return pass/fail + evidence |
| Scoring Engine | `lib/audit/scoring/` | Weighted score from rule results |
| Recommendation Engine | `lib/audit/recommendations/` | Map rule failures → ranked recommendations |
| DB Layer | `lib/db/` | Prisma client singleton, typed query helpers |
| Export | `app/api/audit/[id]/export/` | Serialize stored audit to JSON or CSV |

### Vercel Constraints and Mitigations

- Serverless function timeout: default 10 s, extended to **300 s** via `export const maxDuration = 300` in route handlers (requires Vercel Pro; document this requirement).
- No persistent background workers in MVP. The crawl runs **synchronously** within the Route Handler.
- Max pages per audit: **50** (hard cap). Sitemaps are truncated; homepage crawls use BFS up to 50.
- Concurrency: **3 parallel fetch slots** to stay under Vercel egress pressure and be polite to targets.
- Database: Neon Postgres (serverless-compatible) or Supabase — both work with Prisma over a connection pool URL.

---

## 2. File and Folder Structure

```
seogeoaio/
├── app/
│   ├── layout.tsx                    # root layout, fonts, providers
│   ├── page.tsx                      # landing page + URL input form
│   ├── audit/
│   │   └── [id]/
│   │       ├── page.tsx              # results dashboard (server component, polls)
│   │       └── loading.tsx           # skeleton while fetching
│   └── api/
│       └── audit/
│           ├── start/
│           │   └── route.ts          # POST: validate input, create Audit, run pipeline
│           └── [id]/
│               ├── status/
│               │   └── route.ts      # GET: audit status + summary data
│               └── export/
│                   └── route.ts      # GET: full JSON or CSV export
│
├── lib/
│   ├── audit/
│   │   ├── pipeline.ts               # orchestrates all layers in order
│   │   ├── crawler/
│   │   │   ├── index.ts              # main crawl entry point
│   │   │   ├── fetcher.ts            # fetch with timeout, retry, UA header
│   │   │   ├── sitemap.ts            # sitemap XML ingestion (incl. sitemap index)
│   │   │   ├── link-discovery.ts     # extract + filter internal links from HTML
│   │   │   └── robots.ts             # fetch + evaluate robots.txt
│   │   ├── parser/
│   │   │   ├── index.ts              # parse raw HTML → ParsedPage
│   │   │   ├── meta.ts               # title, description, OG, Twitter Card, viewport
│   │   │   ├── headings.ts           # heading tree extraction
│   │   │   ├── links.ts              # internal/external link counts + hrefs
│   │   │   ├── images.ts             # img src + alt attributes
│   │   │   ├── structured-data.ts    # JSON-LD extraction + JSON parse
│   │   │   └── content.ts            # word count, text node extraction
│   │   ├── rules/
│   │   │   ├── index.ts              # rule registry; exports ALL_RULES[]
│   │   │   ├── types.ts              # RuleDefinition, RuleResult types
│   │   │   ├── technical.ts          # TECH_001 – TECH_016
│   │   │   ├── on-page.ts            # ONPAGE_001 – ONPAGE_011
│   │   │   ├── local-seo.ts          # LOCAL_001 – LOCAL_007
│   │   │   ├── structured-data.ts    # SD_001 – SD_010
│   │   │   ├── aeo.ts                # AEO_001 – AEO_008
│   │   │   └── cannibalization.ts    # CONTENT_001 – CONTENT_006 (sitewide)
│   │   ├── scoring/
│   │   │   ├── index.ts              # exports computePageScore, computeSiteScore
│   │   │   ├── weights.ts            # category weights + severity impacts
│   │   │   ├── page-score.ts         # per-page category score computation
│   │   │   └── site-score.ts         # aggregate + sitewide-issue adjustment
│   │   └── recommendations/
│   │       ├── index.ts              # buildRecommendations(ruleResults[]) → Recommendation[]
│   │       └── templates.ts          # static recommendation content keyed by ruleId
│   │
│   ├── db/
│   │   └── index.ts                  # Prisma client singleton (with edge-safe pattern)
│   │
│   └── validators/
│       └── audit-input.ts            # Zod schema for POST body
│
├── components/
│   ├── ui/                           # shadcn/ui generated components
│   ├── audit/
│   │   ├── AuditForm.tsx             # URL input, type toggle, submit
│   │   ├── AuditProgress.tsx         # polling spinner + crawl stats
│   │   ├── AuditDashboard.tsx        # top-level results layout
│   │   ├── ScoreRing.tsx             # circular score display
│   │   ├── CategoryScoreGrid.tsx     # 6-category score cards
│   │   ├── IssueTable.tsx            # filterable issue list
│   │   ├── RecommendationList.tsx    # ranked recommendation cards
│   │   └── PageDrawer.tsx            # per-page drill-down side panel
│   └── layout/
│       ├── Header.tsx
│       └── Footer.tsx
│
├── types/
│   └── audit.ts                      # all shared TS interfaces (see section 8)
│
├── prisma/
│   └── schema.prisma                 # full DB schema (see section 3)
│
├── docs/
│   ├── ARCHITECTURE.md               # this document
│   └── RULES.md                      # audit rule inventory (see section 4)
│
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Key Design Decisions

**Why synchronous pipeline (not a job queue)?**
For MVP (≤50 pages, ≤300 s), a job queue adds infrastructure complexity with no
benefit. A simple Postgres row tracking status gives sufficient progress visibility.
If audits exceed 300 s in production, the natural migration path is adding a BullMQ
or Inngest queue in Pass 4+.

**Why Prisma over raw SQL?**
Type safety at the DB layer prevents a class of runtime bugs common in dynamic data
(JSON evidence payloads, nullable fields). Prisma migrations provide a safe schema
evolution path.

**Why cheerio over a headless browser?**
Vercel Serverless cannot run Puppeteer/Playwright without container configuration.
Cheerio parses HTML synchronously and handles the ~95% of pages that render
sufficient content server-side. JavaScript-rendered content is a known limitation
documented in MVP boundaries.

**Why store raw JSON columns (headingsJson, structuredDataJson, etc.)?**
Structured data schemas vary wildly. Storing the raw extract avoids schema migrations
every time a new schema type needs to be evaluated. Rules receive the raw JSON and
interpret it themselves.

**Why a fingerprint column on Issue?**
Enables idempotent re-runs: if an audit is re-triggered, existing issues can be
detected as duplicates before persisting. Also supports future diffing between audit
runs for the same project.
