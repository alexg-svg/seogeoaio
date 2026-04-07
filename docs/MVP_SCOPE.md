# MVP Scope Boundaries

## In Scope

### Core Features
- URL input form accepting homepage URL or sitemap URL
- Crawling up to 50 pages per audit (static HTML only)
- robots.txt fetching and Disallow enforcement
- Sitemap XML ingestion (including sitemap index)
- BFS internal link discovery for homepage mode
- Full HTML parsing (title, meta, headings, links, images, structured data, text)

### Audit Coverage
- 16 Technical SEO rules (TECH_001–TECH_016)
- 11 On-Page SEO rules (ONPAGE_001–ONPAGE_011)
- 7 Local SEO rules (LOCAL_001–LOCAL_007)
- 10 Structured Data rules (SD_001–SD_010)
- 8 AEO rules (AEO_001–AEO_008)
- 6 Content/Cannibalization rules (CONTENT_001–CONTENT_006)

### Scoring
- Per-page scores
- Per-category site scores
- Weighted overall site score
- Score contribution transparency

### Recommendations
- One recommendation per failing rule (not per failing page)
- Prioritised by severity × impact × effort
- Affected page count and total score impact shown

### Persistence
- All audit results stored in PostgreSQL via Prisma
- Results accessible by audit ID (no auth required in MVP)

### UI
- Landing page with URL input
- Progress page (polling for status updates)
- Results dashboard: overall score, category scores, issue table, recommendations
- Per-page drill-down panel
- Basic filtering by category and severity

### Export
- Full JSON export (`GET /api/audit/:id/export?format=json`)
- CSV export of issues (`GET /api/audit/:id/export?format=csv`)

---

## Explicitly Out of Scope for MVP

| Feature | Reason for deferral |
|---|---|
| User authentication / accounts | Adds auth complexity; audits are shareable by ID |
| Project management (multiple audits per project) | Requires user accounts first |
| Audit history and score comparison over time | Requires projects + auth |
| Lighthouse / Core Web Vitals integration | Requires Lighthouse CI or PageSpeed API; external dependency |
| PageSpeed API calls | Paid API; adds latency and cost |
| Google Search Console integration | OAuth + GSC API; significant scope increase |
| Keyword research / external keyword data | Requires paid data source (Semrush, Ahrefs, etc.) |
| Competitor analysis | Requires crawling third-party sites for comparison |
| JavaScript-rendered page content | Requires headless browser; not Vercel-compatible |
| PDF report generation | Complex; defer to Pass 4+ |
| Email delivery of reports | Requires email service integration |
| Scheduled / recurring audits | Requires cron infrastructure and user accounts |
| AI-generated recommendation copy | LLM calls add latency and cost; rule templates are sufficient |
| Multi-language UI | Internationalisation is a separate workstream |
| Microdata / RDFa structured data parsing | JSON-LD covers 95%+ of use cases |
| Hreflang validation | Complex; requires understanding the full international URL structure |
| Core Web Vitals from real-user data | Requires CrUX API or RUM setup |
| Link equity / PageRank simulation | Requires full site graph; too slow for MVP |
| Mobile vs desktop rendering difference | Requires headless browser |

---

## Scaffolded for Future Versions

These items are designed for in the MVP schema and architecture but not implemented:

| Item | Where scaffolded |
|---|---|
| `Project` model | Not in schema yet; `Audit` is standalone. Add `projectId` FK when projects are built. |
| `User` model | Not in schema; designed to slot in above `Project`. |
| `redirectChainLength` on `AuditedPage` | Stored; TECH_009 rule fires on it. |
| `truncationWarning` flag on `Audit` | Implemented in crawl pipeline when page cap hit. |
| `inputType: SITEMAP` | Both modes implemented from pass 2. |
| Category weight presets by project type | `CATEGORY_WEIGHTS` is exported from `types/audit.ts` but hardcoded for MVP; designed for future override. |
| `appVersion` in export payload | Will track schema and rule set version for export compatibility. |
| Rule severity overrides per project | `RuleDefinition.defaultSeverity` signals the pattern; override table is future work. |
| Sitemap `<priority>` and `<lastmod>` sort | Parsed and used for crawl ordering; not exposed in UI yet. |

---

## Known Limitations to Document for Users

1. **JavaScript-rendered content is not evaluated.** Pages that require JS execution to render meaningful content (e.g. React SPAs without SSR) will appear as thin or nearly empty.

2. **Maximum 50 pages per audit.** Large sites will be truncated; results are a statistical sample.

3. **No real-user performance data.** Scores do not reflect Core Web Vitals, LCP, CLS, or FID.

4. **Local SEO rules fire on homepage only** (LOCAL_001–LOCAL_004, LOCAL_007). Multi-location businesses should audit each location page separately.

5. **AEO rules are heuristic.** LLM citation behaviour is not fully deterministic; these rules represent best-practice signals, not guarantees of AI visibility.

6. **Crawl budget not considered.** The auditor does not evaluate whether Google allocates sufficient crawl budget to the site.
