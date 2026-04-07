// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface ImageEntry {
  src: string;
  alt: string | null; // null = attribute absent; "" = intentionally empty (decorative)
}

export interface StructuredDataBlock {
  context: string;           // value of @context
  type: string | string[];   // value of @type
  raw: Record<string, unknown>; // full parsed object
  parseError: string | null; // set when JSON.parse failed
}

export interface LocalSignals {
  // Phone numbers found in visible text or schema
  phones: string[];
  // Street address strings matched by pattern
  streetAddresses: string[];
  // Email addresses found in visible text or mailto: hrefs
  emails: string[];
  // True when at least one phone or address was found anywhere on the page
  hasNapSignals: boolean;
}

export interface HeadingTree {
  h1: string[];
  h2: string[];
  h3: string[];
}

// ─── FetchedPage — output of fetch-page.ts ────────────────────────────────────

export interface FetchedPage {
  /** Final URL after all redirects. */
  url: string;
  /** Original requested URL before any redirects. */
  originalUrl: string;
  /** HTTP status code. 0 = network/timeout failure. */
  statusCode: number;
  /** Number of redirects followed (0 = no redirect). */
  redirectCount: number;
  /** Content-Type header value. */
  contentType: string;
  /** Raw HTML string. null if non-HTML, error, or size limit exceeded. */
  html: string | null;
  /** Milliseconds spent on the request. */
  durationMs: number;
  /** Human-readable error description. null on success. */
  error: string | null;
}

// ─── ParsedPage — output of parsePage() ──────────────────────────────────────

export interface ParsedPage {
  // ── Fetch metadata ──────────────────────────────────────────────────────────
  url: string;
  originalUrl: string;
  statusCode: number;
  /** Number of redirects followed (0 = none). */
  redirectChainLength: number;
  /** Final URL after redirects if a redirect occurred, otherwise null. */
  redirectUrl: string | null;
  fetchDurationMs: number;
  fetchedAt: string; // ISO 8601
  /** Human-readable fetch error string. null on success. */
  error: string | null;

  // ── Indexability signals ────────────────────────────────────────────────────
  isIndexable: boolean;
  isNoindex: boolean;
  isNofollow: boolean;
  robotsBlocked: boolean; // set externally via options; false by default

  // ── Head metadata ───────────────────────────────────────────────────────────
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonicalUrl: string | null;
  hasCanonicalMismatch: boolean; // canonical != finalUrl after normalisation
  language: string | null;       // from <html lang="..."> or <meta http-equiv="content-language">
  hasViewport: boolean;
  metaRobots: string | null;     // raw value of <meta name="robots">

  // ── Social / OG ─────────────────────────────────────────────────────────────
  openGraph: Record<string, string>;  // og:* → content
  twitterCard: Record<string, string>; // twitter:* → content

  // ── All raw meta tags (name/property → content) ───────────────────────────
  metaTags: Record<string, string>;

  // ── Headings ────────────────────────────────────────────────────────────────
  h1: string | null;           // first H1 text
  h1Count: number;
  headings: HeadingTree;
  hasSkippedHeadingLevel: boolean;

  // ── Links ───────────────────────────────────────────────────────────────────
  internalLinks: string[];      // normalised absolute URLs, same origin
  externalLinks: string[];      // normalised absolute URLs, different origin
  internalLinkCount: number;
  externalLinkCount: number;

  // ── Images ──────────────────────────────────────────────────────────────────
  images: ImageEntry[];
  imageCount: number;
  imagesWithoutAlt: number; // alt attribute entirely absent (not just empty)

  // ── Structured data ─────────────────────────────────────────────────────────
  structuredData: StructuredDataBlock[];
  hasStructuredDataParseError: boolean;

  // ── Body text / content signals ─────────────────────────────────────────────
  textContent: string;    // stripped body text, whitespace normalised
  wordCount: number;
  hasOrderedList: boolean;
  hasUnorderedList: boolean;
  hasTable: boolean;
  listItemCount: number;
  // Heuristic signals used by AEO rules
  hasQuestionHeadings: boolean;
  hasStepHeadings: boolean;
  hasDirectAnswerPattern: boolean;
  hasAuthorByline: boolean;
  hasInterstitialOverlay: boolean;

  // ── Local SEO signals ───────────────────────────────────────────────────────
  localSignals: LocalSignals;

  // ── Runtime flags (set by caller, not parser) ───────────────────────────────
  isHomepage: boolean;
}

// ─── Persistence mapping shape ────────────────────────────────────────────────
// Matches the Prisma AuditedPage create input — used by toPersistenceShape().

export interface AuditedPageCreateShape {
  auditId: string;
  url: string;
  originalUrl: string | undefined;
  canonicalUrl: string | null;
  statusCode: number;
  redirectUrl: string | null;
  redirectChainLength: number;
  fetchDurationMs: number | null;
  isIndexable: boolean;
  robotsBlocked: boolean;
  hasCanonicalMismatch: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  wordCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  headingsJson: HeadingTree;
  metaTagsJson: Record<string, string>;
  structuredDataJson: StructuredDataBlock[];
  openGraphJson: Record<string, string>;
  twitterCardJson: Record<string, string>;
  internalLinksJson: string[];
}
