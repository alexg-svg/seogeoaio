import { load } from "cheerio";
import { fetchPageWithRetry } from "./fetch-page";
import { extractMeta } from "./extract-meta";
import { extractHeadings } from "./extract-headings";
import { extractLinks } from "./extract-links";
import { extractImages } from "./extract-images";
import { extractSchema } from "./extract-schema";
import { extractText } from "./extract-text";
import { extractLocalSignals } from "./extract-local-signals";
import type {
  ParsedPage,
  FetchedPage,
  AuditedPageCreateShape,
} from "./types";

export type { ParsedPage, FetchedPage, AuditedPageCreateShape };
export type { StructuredDataBlock, LocalSignals, ImageEntry } from "./types";
export { hasSchemaType, getSchemaBlock, getSchemaBlocks, isValidSchemaContext } from "./extract-schema";

// ─── URL normalisation ────────────────────────────────────────────────────────

function normalise(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface ParsePageOptions {
  /** When true, isHomepage is set on the returned object. Default: false. */
  isHomepage?: boolean;
  /**
   * When true, the URL was blocked by robots.txt and HTML was never fetched.
   * The returned ParsedPage will be empty with isIndexable = false.
   * Default: false.
   */
  robotsBlocked?: boolean;
}

/**
 * Fetch a URL and return a fully parsed ParsedPage.
 *
 * This is the primary parser-layer entry point.
 * It handles fetch errors, non-HTML content, and malformed HTML gracefully —
 * always returning a typed ParsedPage rather than throwing.
 *
 * @example
 * const page = await parsePage("https://example.com");
 * console.log(page.title, page.wordCount, page.structuredData);
 */
export async function parsePage(
  url: string,
  options: ParsePageOptions = {}
): Promise<ParsedPage> {
  const { isHomepage = false, robotsBlocked = false } = options;
  const fetchedAt = new Date().toISOString();

  if (robotsBlocked) {
    return emptyPage(url, url, 0, 0, fetchedAt, "Blocked by robots.txt", isHomepage);
  }

  const fetched = await fetchPageWithRetry(url);

  if (!fetched.html || fetched.statusCode === 0) {
    return emptyPage(
      fetched.url,
      url,
      fetched.statusCode,
      fetched.durationMs,
      fetchedAt,
      fetched.error,
      isHomepage
    );
  }

  return parseHtml(fetched, fetchedAt, isHomepage);
}

/**
 * Parse a pre-fetched page (used by the batch crawler to avoid double-fetching).
 * Accepts the shape returned by lib/crawler/fetcher.ts.
 */
export function parseFromFetched(
  fetched: FetchedPage,
  options: ParsePageOptions = {}
): ParsedPage {
  const { isHomepage = false } = options;
  const fetchedAt = new Date().toISOString();

  if (!fetched.html || fetched.statusCode === 0) {
    return emptyPage(
      fetched.url,
      fetched.originalUrl,
      fetched.statusCode,
      fetched.durationMs,
      fetchedAt,
      fetched.error,
      isHomepage
    );
  }

  return parseHtml(fetched, fetchedAt, isHomepage);
}

// ─── Core HTML parsing ────────────────────────────────────────────────────────

function parseHtml(
  fetched: FetchedPage,
  fetchedAt: string,
  isHomepage: boolean
): ParsedPage {
  const $ = load(fetched.html!);

  const meta = extractMeta($, fetched.url);
  const headings = extractHeadings($);
  const links = extractLinks($, fetched.url);
  const images = extractImages($);
  const schema = extractSchema($);
  const text = extractText($);
  const local = extractLocalSignals($);

  const isNon200 = fetched.statusCode < 200 || fetched.statusCode >= 400;
  const isIndexable = !isNon200 && !meta.isNoindex;

  const canonicalMismatch =
    meta.canonicalUrl !== null &&
    normalise(meta.canonicalUrl) !== normalise(fetched.url);

  return {
    // Fetch metadata
    url: fetched.url,
    originalUrl: fetched.originalUrl,
    statusCode: fetched.statusCode,
    redirectChainLength: fetched.redirectCount,
    redirectUrl: fetched.redirectCount > 0 ? fetched.url : null,
    fetchDurationMs: fetched.durationMs,
    fetchedAt,
    error: fetched.error,

    // Indexability
    isIndexable,
    isNoindex: meta.isNoindex,
    isNofollow: meta.isNofollow,
    robotsBlocked: false,

    // Meta
    title: meta.title,
    titleLength: meta.titleLength,
    metaDescription: meta.metaDescription,
    metaDescriptionLength: meta.metaDescriptionLength,
    canonicalUrl: meta.canonicalUrl,
    hasCanonicalMismatch: canonicalMismatch,
    language: meta.language,
    hasViewport: meta.hasViewport,
    metaRobots: meta.metaRobots,
    openGraph: meta.openGraph,
    twitterCard: meta.twitterCard,
    metaTags: meta.metaTags,

    // Headings
    h1: headings.h1,
    h1Count: headings.h1Count,
    headings: headings.headings,
    hasSkippedHeadingLevel: headings.hasSkippedHeadingLevel,

    // Links
    internalLinks: links.internalLinks,
    externalLinks: links.externalLinks,
    internalLinkCount: links.internalLinkCount,
    externalLinkCount: links.externalLinkCount,

    // Images
    images: images.images,
    imageCount: images.imageCount,
    imagesWithoutAlt: images.imagesWithoutAlt,

    // Structured data
    structuredData: schema.blocks,
    hasStructuredDataParseError: schema.hasParseError,

    // Text / content
    textContent: text.textContent,
    wordCount: text.wordCount,
    hasOrderedList: text.hasOrderedList,
    hasUnorderedList: text.hasUnorderedList,
    hasTable: text.hasTable,
    listItemCount: text.listItemCount,
    hasQuestionHeadings: text.hasQuestionHeadings,
    hasStepHeadings: text.hasStepHeadings,
    hasDirectAnswerPattern: text.hasDirectAnswerPattern,
    hasAuthorByline: text.hasAuthorByline,
    hasInterstitialOverlay: text.hasInterstitialOverlay,

    // Local signals
    localSignals: local,

    // Pipeline flags
    isHomepage,
  };
}

// ─── Empty page factory ───────────────────────────────────────────────────────

function emptyPage(
  url: string,
  originalUrl: string,
  statusCode: number,
  fetchDurationMs: number,
  fetchedAt: string,
  error: string | null,
  isHomepage: boolean
): ParsedPage {
  return {
    url,
    originalUrl,
    statusCode,
    redirectChainLength: 0,
    redirectUrl: null,
    fetchDurationMs,
    fetchedAt,
    error,
    isIndexable: false,
    isNoindex: false,
    isNofollow: false,
    robotsBlocked: error?.includes("robots") ?? false,
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonicalUrl: null,
    hasCanonicalMismatch: false,
    language: null,
    hasViewport: false,
    metaRobots: null,
    openGraph: {},
    twitterCard: {},
    metaTags: {},
    h1: null,
    h1Count: 0,
    headings: { h1: [], h2: [], h3: [] },
    hasSkippedHeadingLevel: false,
    internalLinks: [],
    externalLinks: [],
    internalLinkCount: 0,
    externalLinkCount: 0,
    images: [],
    imageCount: 0,
    imagesWithoutAlt: 0,
    structuredData: [],
    hasStructuredDataParseError: false,
    textContent: "",
    wordCount: 0,
    hasOrderedList: false,
    hasUnorderedList: false,
    hasTable: false,
    listItemCount: 0,
    hasQuestionHeadings: false,
    hasStepHeadings: false,
    hasDirectAnswerPattern: false,
    hasAuthorByline: false,
    hasInterstitialOverlay: false,
    localSignals: {
      phones: [],
      streetAddresses: [],
      emails: [],
      hasNapSignals: false,
    },
    isHomepage,
  };
}

// ─── Persistence mapping ──────────────────────────────────────────────────────

/**
 * Map a ParsedPage to the shape expected by Prisma's AuditedPage.create().
 *
 * Pass the auditId returned from prisma.audit.create() as the first argument.
 * This function does not write to the database — it only produces the data shape.
 *
 * @example
 * const shape = toPersistenceShape(auditId, page);
 * await prisma.auditedPage.create({ data: shape });
 */
export function toPersistenceShape(
  auditId: string,
  page: ParsedPage
): AuditedPageCreateShape {
  return {
    auditId,
    url: page.url,
    originalUrl: page.originalUrl || undefined,
    canonicalUrl: page.canonicalUrl,
    statusCode: page.statusCode,
    redirectUrl: page.redirectUrl,
    redirectChainLength: page.redirectChainLength,
    fetchDurationMs: page.fetchDurationMs || null,
    isIndexable: page.isIndexable,
    robotsBlocked: page.robotsBlocked,
    hasCanonicalMismatch: page.hasCanonicalMismatch,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    h1Count: page.h1Count,
    wordCount: page.wordCount,
    internalLinkCount: page.internalLinkCount,
    externalLinkCount: page.externalLinkCount,
    imageCount: page.imageCount,
    imagesWithoutAlt: page.imagesWithoutAlt,
    headingsJson: page.headings,
    metaTagsJson: page.metaTags,
    structuredDataJson: page.structuredData,
    openGraphJson: page.openGraph,
    twitterCardJson: page.twitterCard,
    internalLinksJson: page.internalLinks,
  };
}
