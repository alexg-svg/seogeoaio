# Audit Rule Inventory — MVP

Rules are deterministic: each rule receives parsed page data (or the full set of
parsed pages for sitewide rules) and returns pass | fail | skip with evidence.
No paid APIs, no probabilistic ML models.

Legend:
- **Scope**: PAGE = evaluated per page; SITE = evaluated once across all pages
- **Severity default**: the severity assigned when the rule fails (can be overridden per project in future)
- **Data required**: fields from the `ParsedPage` interface the rule reads

---

## Category: TECHNICAL_SEO

| ID | Name | What it checks | Why it matters | Severity | Scope | Data required |
|---|---|---|---|---|---|---|
| TECH_001 | HTTPS Enforcement | URL scheme is `https://` | Mixed/insecure content is a confirmed ranking signal | HIGH | PAGE | `url` |
| TECH_002 | Canonical Tag Present | `<link rel="canonical">` exists | Without canonical, duplicate versions of a page may split link equity | MEDIUM | PAGE | `canonicalUrl` |
| TECH_003 | Canonical Self-Reference | Canonical points to the page's own URL | Canonical pointing elsewhere may intentionally exclude this URL from indexing | INFO | PAGE | `url`, `canonicalUrl` |
| TECH_004 | Canonical Mismatch | Canonical URL differs from the crawled URL | A different canonical tells Google to index a different URL; may suppress this page | HIGH | PAGE | `url`, `canonicalUrl` |
| TECH_005 | Noindex Detected | `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` | Noindex pages cannot rank; verify intentionality | CRITICAL | PAGE | `metaTagsJson["robots"]` |
| TECH_006 | Robots.txt Accessible | `GET /robots.txt` returns 200 | Google cannot crawl efficiently without robots.txt | MEDIUM | SITE | crawl metadata |
| TECH_007 | Sitemap Declared in Robots.txt | robots.txt contains `Sitemap:` directive | Helps search engines discover all URLs | LOW | SITE | robots.txt content |
| TECH_008 | HTTP Status Non-200 | Page returns 4xx or 5xx | Non-200 pages are not indexed; broken pages harm UX and crawl budget | CRITICAL | PAGE | `statusCode` |
| TECH_009 | Redirect Chain | Page requires more than 1 redirect to reach | Each redirect hop loses ~15% of link equity; slows crawlers | HIGH | PAGE | `redirectChainLength` |
| TECH_010 | Title Tag Length | `<title>` is 10–60 characters | Titles outside this range are truncated or rewritten by Google | HIGH | PAGE | `title` |
| TECH_011 | Meta Description Length | `<meta name="description">` is 50–160 characters | Truncated descriptions reduce click-through rates | MEDIUM | PAGE | `metaDescription` |
| TECH_012 | Viewport Meta Tag | `<meta name="viewport">` is present | Required for mobile-friendly classification | HIGH | PAGE | `metaTagsJson["viewport"]` |
| TECH_013 | Duplicate Title Tags | Two or more crawled pages share the same `<title>` | Google uses titles to differentiate pages; duplicates cause confusion and cannibalization | HIGH | SITE | `title` across all `AuditedPage` |
| TECH_014 | Duplicate Meta Descriptions | Two or more crawled pages share the same `<meta name="description">` | Low priority but signals templated, low-effort pages | MEDIUM | SITE | `metaDescription` across all pages |
| TECH_015 | Image Alt Text Coverage | ≥80% of images have non-empty `alt` attributes | Alt text is the primary accessibility and image-search ranking signal | MEDIUM | PAGE | `imageCount`, `imagesWithoutAlt` |
| TECH_016 | Missing Title Tag | `<title>` is absent or empty | Title is Google's strongest on-page ranking signal | CRITICAL | PAGE | `title` |

---

## Category: ON_PAGE_SEO

| ID | Name | What it checks | Why it matters | Severity | Scope | Data required |
|---|---|---|---|---|---|---|
| ONPAGE_001 | H1 Present | Page has exactly one `<h1>` | H1 is the primary topic signal for a page | HIGH | PAGE | `h1Count` |
| ONPAGE_002 | Multiple H1 Tags | Page has more than one `<h1>` | Dilutes topical signal; Google may choose arbitrarily | MEDIUM | PAGE | `h1Count` |
| ONPAGE_003 | H1 and Title Alignment | H1 and title tag share significant word overlap (>50% of meaningful tokens) | Mismatched H1/title suggests unclear topic focus | MEDIUM | PAGE | `title`, `h1` |
| ONPAGE_004 | Heading Hierarchy | No heading level is skipped (e.g. H1 → H3 with no H2) | Broken hierarchy harms accessibility and content structure signals | LOW | PAGE | `headingsJson` |
| ONPAGE_005 | Thin Content | Page body has fewer than 300 words | Thin content is a documented quality issue; Google may demote or ignore | HIGH | PAGE | `wordCount` |
| ONPAGE_006 | Meta Description Present | `<meta name="description">` exists and is non-empty | Controls SERP snippet; missing = Google chooses arbitrary text | MEDIUM | PAGE | `metaDescription` |
| ONPAGE_007 | Open Graph Tags Present | `og:title`, `og:description`, `og:image` all present | Required for rich social shares; also used by some LLMs for page summaries | LOW | PAGE | `openGraphJson` |
| ONPAGE_008 | Twitter Card Tags Present | `twitter:card` and `twitter:title` present | Controls appearance when shared on X/Twitter | LOW | PAGE | `twitterCardJson` |
| ONPAGE_009 | Internal Link Count | Page has at least 2 outbound internal links | Internal links distribute PageRank and aid crawl depth | MEDIUM | PAGE | `internalLinkCount` |
| ONPAGE_010 | Image Count with No Alt (High Volume) | Page has >5 images without alt text | Signals low-quality content markup; misses image-search traffic | HIGH | PAGE | `imagesWithoutAlt` |
| ONPAGE_011 | Title Missing Brand or Keyword Signal | Title contains only generic terms or is fewer than 20 chars | Very short titles are often rewritten; no keyword = no ranking signal | MEDIUM | PAGE | `title` |

---

## Category: LOCAL_SEO

| ID | Name | What it checks | Why it matters | Severity | Scope | Data required |
|---|---|---|---|---|---|---|
| LOCAL_001 | LocalBusiness Schema Present | Any `LocalBusiness` (or subtype) JSON-LD block exists on homepage | Fundamental local entity signal; required for Google Business Profile alignment | HIGH | PAGE | `structuredDataJson` (homepage only) |
| LOCAL_002 | NAP in Structured Data | `LocalBusiness` schema contains `name`, `address` (with `streetAddress`), and `telephone` | NAP consistency is the primary local ranking factor | HIGH | PAGE | `structuredDataJson` |
| LOCAL_003 | GeoCoordinates Present | `LocalBusiness.geo` contains `latitude` and `longitude` | Precise geo-targeting improves map pack eligibility | MEDIUM | PAGE | `structuredDataJson` |
| LOCAL_004 | Opening Hours Present | `LocalBusiness.openingHoursSpecification` or `openingHours` present | Opening hours shown in Knowledge Panel and local SERPs | MEDIUM | PAGE | `structuredDataJson` |
| LOCAL_005 | Contact Page Detected | Site has a page with "contact" in URL or title containing address/phone heuristics | Signals a legitimate local business; required for E-E-A-T | MEDIUM | SITE | all page `url`, `title` |
| LOCAL_006 | Local Business Schema on Non-Homepage | LocalBusiness schema appears only on homepage, not on location pages | Multi-location businesses need schema per location page | LOW | SITE | `structuredDataJson` across pages |
| LOCAL_007 | aggregateRating Present | `LocalBusiness` schema includes `aggregateRating` with `ratingValue` and `ratingCount` | Star ratings displayed in SERPs increase CTR significantly | LOW | PAGE | `structuredDataJson` |

---

## Category: STRUCTURED_DATA

| ID | Name | What it checks | Why it matters | Severity | Scope | Data required |
|---|---|---|---|---|---|---|
| SD_001 | JSON-LD Present | At least one `<script type="application/ld+json">` block exists | JSON-LD is Google's preferred structured data format | MEDIUM | PAGE | `structuredDataJson` |
| SD_002 | JSON-LD Parses Without Error | All JSON-LD blocks are valid JSON | Invalid JSON is silently ignored by Google; implementation effort is wasted | HIGH | PAGE | raw JSON-LD strings |
| SD_003 | WebSite Schema on Homepage | Homepage contains `WebSite` schema with `url` and `name` | Enables Sitelinks Searchbox and confirms site identity | MEDIUM | PAGE | `structuredDataJson` (homepage) |
| SD_004 | Organization Schema on Homepage | Homepage contains `Organization` with `name`, `url`, `logo` | Core E-E-A-T entity signal; used in Knowledge Panel | HIGH | PAGE | `structuredDataJson` (homepage) |
| SD_005 | BreadcrumbList on Interior Pages | Non-homepage pages contain `BreadcrumbList` schema | Breadcrumbs appear in SERPs; improve CTR and hierarchy understanding | MEDIUM | PAGE | `structuredDataJson`, `url` |
| SD_006 | FAQPage Schema Where FAQ Content Detected | Pages with 3+ question-format headings (H2/H3 ending in `?`) lack `FAQPage` schema | FAQ rich results increase SERP real estate dramatically | HIGH | PAGE | `headingsJson`, `structuredDataJson` |
| SD_007 | Article/BlogPosting on Blog Pages | Pages with `/blog/` or `/news/` in URL lack `Article` or `BlogPosting` schema | Article schema enables Google Top Stories and article rich results | MEDIUM | PAGE | `url`, `structuredDataJson` |
| SD_008 | HowTo Schema Where Step Content Detected | Pages with numbered-list headings (H2/H3 starting with digit or "Step") lack `HowTo` schema | HowTo rich results show steps directly in SERPs | MEDIUM | PAGE | `headingsJson`, `structuredDataJson` |
| SD_009 | datePublished and dateModified Present | `Article`/`BlogPosting` schema lacks `datePublished` or `dateModified` | Freshness signals influence article ranking; required for Top Stories | MEDIUM | PAGE | `structuredDataJson` |
| SD_010 | Schema @context is schema.org | JSON-LD blocks use `"@context": "https://schema.org"` | Incorrect context causes Google to ignore the block | HIGH | PAGE | `structuredDataJson` |

---

## Category: AEO (Answer Engine Optimisation)

AEO rules target visibility in AI-powered answer engines (ChatGPT, Perplexity, Google AI Overviews, Bing Copilot). All rules are heuristic and deterministic — no LLM calls required.

| ID | Name | What it checks | Why it matters | Severity | Scope | Data required |
|---|---|---|---|---|---|---|
| AEO_001 | Direct Answer Content Detected | Page body contains definition-style patterns: "X is a…", "X refers to…", or starts a paragraph with the topic term | LLMs preferentially cite pages that answer questions in the first sentence | HIGH | PAGE | extracted text content |
| AEO_002 | FAQPage or Q&A Structure Present | Page has question-format headings with answer paragraphs beneath them | Q&A format maps directly to how LLMs structure retrieved context | HIGH | PAGE | `headingsJson`, `structuredDataJson` |
| AEO_003 | Author Entity Identified | Page contains a visible byline or `author` in Article schema with a `Person` type | LLMs weight author credibility; E-E-A-T requires human attribution | MEDIUM | PAGE | `structuredDataJson`, text content |
| AEO_004 | dateModified is Recent | `Article.dateModified` is within the last 12 months | AI answer engines prefer fresh sources; stale content is deprioritised | MEDIUM | PAGE | `structuredDataJson` |
| AEO_005 | Speakable Schema Present | Page contains `speakable` property in schema (SpeakableSpecification) | Explicit speakable markup helps voice assistants and AI summarisers identify the key passage | LOW | PAGE | `structuredDataJson` |
| AEO_006 | Structured List Content | Page body contains `<ul>` or `<ol>` with ≥3 items, or a `<table>` | Lists and tables are heavily used in LLM context extraction; scannable content ranks higher | MEDIUM | PAGE | HTML structure (parser) |
| AEO_007 | Clear Single Topic Per Page | H1 is present, ≤10 words, and the page has ≤2 distinct top-level H2 topic clusters | AEO rewards topically focused pages; LLMs surface specific answers not broad overviews | HIGH | PAGE | `h1`, `headingsJson` |
| AEO_008 | No Interstitials Blocking Content | Page does not trigger a cookie wall or GDPR modal at the HTML level (heuristic: presence of overlay-style hidden content with consent-related text) | LLMs and AI crawlers cannot bypass interstitials; content becomes invisible | MEDIUM | PAGE | HTML structure |

---

## Category: CONTENT (Quality & Cannibalization)

All rules in this category are SITEWIDE (evaluated across all crawled pages together).

| ID | Name | What it checks | Why it matters | Severity | Scope | Data required |
|---|---|---|---|---|---|---|
| CONTENT_001 | Title Cannibalization | ≥2 pages have titles that share ≥70% of meaningful token overlap | Multiple pages competing for the same query split signals and reduce overall ranking power | HIGH | SITE | `title` across all pages |
| CONTENT_002 | URL Similarity Pairs | ≥2 page URLs differ only in trailing `s`, `-2`, or similar suffixes (e.g. `/service` and `/services`) | Usually indicates accidental duplicate or orphaned variant page | MEDIUM | SITE | `url` across all pages |
| CONTENT_003 | Orphaned Pages | Page has no inbound internal links from any other crawled page (excluding homepage) | Orphaned pages receive no PageRank distribution; likely invisible to crawlers | MEDIUM | SITE | `internalLinksJson` across all pages |
| CONTENT_004 | H1 Cannibalization | ≥2 pages share the same H1 text exactly | Identical H1s across pages are a strong cannibalization signal | HIGH | SITE | `h1` across all pages |
| CONTENT_005 | Thin Content Cluster | ≥3 pages each have <500 words and share keyword overlap in their titles | Thin page clusters are a Panda-style quality risk; consider consolidating | HIGH | SITE | `wordCount`, `title` across pages |
| CONTENT_006 | No Crawlable Pages Discovered | After respecting robots.txt and noindex rules, fewer than 1 page is indexable | The site may be entirely blocked from indexing | CRITICAL | SITE | all `AuditedPage.isIndexable` |

---

## Rule Evaluation Notes

1. **Skip logic**: Rules that require data not present on a page type should return `{ result: "skip" }` rather than `fail`. Example: LOCAL_001 only fires on the homepage.

2. **Evidence format**: Each failing rule should include structured evidence in the `evidence` JSON field. Example for TECH_010: `{ "actual": 87, "limit": 60, "value": "Buy Premium Widget Packages Online | Best Price Guaranteed | Free Shipping..." }`.

3. **Sitewide rule timing**: CONTENT and TECH_013/TECH_014 rules run after all pages are crawled and parsed, receiving the full `ParsedPage[]` array as input.

4. **Determinism**: Rules must return the same result for the same input. No randomness, no external API calls at evaluation time.
