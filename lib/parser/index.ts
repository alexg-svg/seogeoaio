import { load } from "cheerio";
import { normaliseUrl } from "@/lib/validators/audit-input";
import type { RawPage } from "@/lib/crawler/index";
import { parseMeta } from "./meta";
import { parseHeadings } from "./headings";
import { parseLinks } from "./links";
import { parseImages } from "./images";
import { parseStructuredData } from "./structured-data";
import { parseContent } from "./content";

export interface ParsedPage {
  // Crawl metadata
  url: string;
  originalUrl: string;
  statusCode: number;
  redirectUrl: string | null;
  redirectChainLength: number;
  fetchDurationMs: number;
  fetchedAt: string;
  error: string | null;

  // Indexability
  isIndexable: boolean;
  robotsBlocked: boolean;
  isNoindex: boolean;

  // Meta
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  hasCanonicalMismatch: boolean;
  metaTags: Record<string, string>;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  hasViewport: boolean;

  // Headings
  h1: string | null;
  h1Count: number;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  hasSkippedHeadingLevel: boolean;

  // Links
  internalLinks: string[];
  externalLinks: string[];
  internalLinkCount: number;
  externalLinkCount: number;

  // Images
  images: Array<{ src: string; alt: string | null }>;
  imageCount: number;
  imagesWithoutAlt: number;

  // Structured data
  structuredData: import("./structured-data").StructuredDataBlock[];
  hasStructuredDataParseError: boolean;

  // Content
  textContent: string;
  wordCount: number;
  hasOrderedList: boolean;
  hasUnorderedList: boolean;
  hasTable: boolean;
  listItemCount: number;
  hasQuestionHeadings: boolean;
  hasStepHeadings: boolean;
  hasDirectAnswerPattern: boolean;
  hasAuthorByline: boolean;
  hasInterstitialOverlay: boolean;

  // Pipeline flags (set by audit runner, not parser)
  isHomepage: boolean;
}

/**
 * Parse a raw crawled page into a structured ParsedPage.
 * Returns a minimal ParsedPage for error/non-HTML cases.
 */
export function parsePage(raw: RawPage, homepageUrl: string): ParsedPage {
  const fetchedAt = new Date().toISOString();
  const isHomepage =
    normaliseUrl(raw.url) === normaliseUrl(homepageUrl) ||
    normaliseUrl(raw.finalUrl) === normaliseUrl(homepageUrl);

  const base: Omit<
    ParsedPage,
    | "title"
    | "metaDescription"
    | "canonicalUrl"
    | "hasCanonicalMismatch"
    | "metaTags"
    | "openGraph"
    | "twitterCard"
    | "hasViewport"
    | "h1"
    | "h1Count"
    | "headings"
    | "hasSkippedHeadingLevel"
    | "internalLinks"
    | "externalLinks"
    | "internalLinkCount"
    | "externalLinkCount"
    | "images"
    | "imageCount"
    | "imagesWithoutAlt"
    | "structuredData"
    | "hasStructuredDataParseError"
    | "textContent"
    | "wordCount"
    | "hasOrderedList"
    | "hasUnorderedList"
    | "hasTable"
    | "listItemCount"
    | "hasQuestionHeadings"
    | "hasStepHeadings"
    | "hasDirectAnswerPattern"
    | "hasAuthorByline"
    | "hasInterstitialOverlay"
    | "isNoindex"
  > = {
    url: raw.url,
    originalUrl: raw.originalUrl,
    statusCode: raw.statusCode,
    redirectUrl: raw.redirectChainLength > 0 ? raw.finalUrl : null,
    redirectChainLength: raw.redirectChainLength,
    fetchDurationMs: raw.fetchDurationMs,
    fetchedAt,
    error: raw.error,
    isIndexable: false, // set after parsing
    robotsBlocked: raw.robotsBlocked,
    isHomepage,
  };

  // Can't parse non-HTML or error pages
  if (!raw.html || raw.robotsBlocked || raw.statusCode === 0) {
    return {
      ...base,
      isIndexable: false,
      isNoindex: false,
      title: null,
      metaDescription: null,
      canonicalUrl: null,
      hasCanonicalMismatch: false,
      metaTags: {},
      openGraph: {},
      twitterCard: {},
      hasViewport: false,
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
    };
  }

  const $ = load(raw.html);
  const meta = parseMeta($, raw.finalUrl);
  const headings = parseHeadings($);
  const links = parseLinks($, raw.finalUrl);
  const images = parseImages($);
  const sd = parseStructuredData($);
  const content = parseContent($);

  const isNon200 = raw.statusCode < 200 || raw.statusCode >= 400;
  const isIndexable = !isNon200 && !raw.robotsBlocked && !meta.isNoindex;

  const canonicalMismatch =
    meta.canonicalUrl !== null &&
    normaliseUrl(meta.canonicalUrl) !== normaliseUrl(raw.finalUrl);

  return {
    ...base,
    isIndexable,
    isNoindex: meta.isNoindex,
    title: meta.title,
    metaDescription: meta.metaDescription,
    canonicalUrl: meta.canonicalUrl,
    hasCanonicalMismatch: canonicalMismatch,
    metaTags: meta.metaTags,
    openGraph: meta.openGraph,
    twitterCard: meta.twitterCard,
    hasViewport: meta.hasViewport,
    h1: headings.firstH1,
    h1Count: headings.h1Count,
    headings: { h1: headings.h1, h2: headings.h2, h3: headings.h3 },
    hasSkippedHeadingLevel: headings.hasSkippedLevel,
    internalLinks: links.internalLinks,
    externalLinks: links.externalLinks,
    internalLinkCount: links.internalLinkCount,
    externalLinkCount: links.externalLinkCount,
    images: images.images,
    imageCount: images.imageCount,
    imagesWithoutAlt: images.imagesWithoutAlt,
    structuredData: sd.blocks,
    hasStructuredDataParseError: sd.hasParseError,
    textContent: content.textContent,
    wordCount: content.wordCount,
    hasOrderedList: content.hasOrderedList,
    hasUnorderedList: content.hasUnorderedList,
    hasTable: content.hasTable,
    listItemCount: content.listItemCount,
    hasQuestionHeadings: content.hasQuestionHeadings,
    hasStepHeadings: content.hasStepHeadings,
    hasDirectAnswerPattern: content.hasDirectAnswerPattern,
    hasAuthorByline: content.hasAuthorByline,
    hasInterstitialOverlay: content.hasInterstitialOverlay,
  };
}
