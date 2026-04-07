import { pageRule } from "./utils";
import {
  hasSchemaType,
  getSchemaBlock,
  isValidSchemaContext,
} from "@/lib/parser/structured-data";
import type { PageRule } from "./types";

const SD_001: PageRule = pageRule(
  { id: "SD_001", name: "JSON-LD Present", category: "STRUCTURED_DATA", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const validBlocks = page.structuredData.filter((b) => !b.parseError);
    if (validBlocks.length === 0) {
      return { status: "fail", detail: "Page has no valid JSON-LD structured data. Structured data enables rich results and improves entity understanding." };
    }
    return { status: "pass" };
  }
);

const SD_002: PageRule = pageRule(
  { id: "SD_002", name: "JSON-LD Parses Without Error", category: "STRUCTURED_DATA", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (page.hasStructuredDataParseError) {
      const errors = page.structuredData
        .filter((b) => b.parseError)
        .map((b) => b.parseError);
      return {
        status: "fail",
        detail: "One or more JSON-LD blocks failed to parse. Invalid JSON is silently ignored by Google — the markup effort is wasted.",
        evidence: { parseErrors: errors },
      };
    }
    return { status: "pass" };
  }
);

const SD_003: PageRule = pageRule(
  { id: "SD_003", name: "WebSite Schema on Homepage", category: "STRUCTURED_DATA", defaultSeverity: "MEDIUM" },
  (page, ctx) => {
    if (!ctx.isHomepage || !page.isIndexable) return { status: "skip" };
    if (!hasSchemaType(page.structuredData, "WebSite")) {
      return { status: "fail", detail: "Homepage is missing WebSite JSON-LD schema. WebSite schema enables Sitelinks Searchbox and confirms site identity to Google." };
    }
    return { status: "pass" };
  }
);

const SD_004: PageRule = pageRule(
  { id: "SD_004", name: "Organization Schema on Homepage", category: "STRUCTURED_DATA", defaultSeverity: "HIGH" },
  (page, ctx) => {
    if (!ctx.isHomepage || !page.isIndexable) return { status: "skip" };
    if (!hasSchemaType(page.structuredData, "Organization", "Corporation", "NGO", "EducationalOrganization")) {
      return { status: "fail", detail: "Homepage is missing Organization JSON-LD schema. Organization schema is a core E-E-A-T entity signal used in Knowledge Panel." };
    }
    const block = getSchemaBlock(page.structuredData, "Organization") ??
      getSchemaBlock(page.structuredData, "Corporation");
    if (block) {
      const raw = block.raw as Record<string, unknown>;
      const missing: string[] = [];
      if (!raw.name) missing.push("name");
      if (!raw.url) missing.push("url");
      if (!raw.logo) missing.push("logo");
      if (missing.length > 0) {
        return {
          status: "fail",
          detail: `Organization schema exists but is missing required fields: ${missing.join(", ")}.`,
          evidence: { missingFields: missing },
        };
      }
    }
    return { status: "pass" };
  }
);

const SD_005: PageRule = pageRule(
  { id: "SD_005", name: "BreadcrumbList on Interior Pages", category: "STRUCTURED_DATA", defaultSeverity: "MEDIUM" },
  (page, ctx) => {
    if (ctx.isHomepage || !page.isIndexable) return { status: "skip" };
    if (!hasSchemaType(page.structuredData, "BreadcrumbList")) {
      return { status: "fail", detail: "Interior page has no BreadcrumbList schema. Breadcrumbs appear in SERPs and improve CTR and hierarchy understanding." };
    }
    return { status: "pass" };
  }
);

const SD_006: PageRule = pageRule(
  { id: "SD_006", name: "FAQPage Schema Where FAQ Content Detected", category: "STRUCTURED_DATA", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    // Heuristic: 3+ question-format headings = FAQ content
    const questionHeadingCount = [
      ...page.headings.h2,
      ...page.headings.h3,
    ].filter((h) => h.trim().endsWith("?")).length;

    if (questionHeadingCount >= 3 && !hasSchemaType(page.structuredData, "FAQPage")) {
      return {
        status: "fail",
        detail: `Page has ${questionHeadingCount} question-format headings but no FAQPage schema. FAQ rich results significantly increase SERP real estate.`,
        evidence: { questionHeadingCount },
      };
    }
    return { status: "pass" };
  }
);

const SD_007: PageRule = pageRule(
  { id: "SD_007", name: "Article Schema on Blog/News Pages", category: "STRUCTURED_DATA", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const isBlogUrl =
      /\/(blog|news|article|post|story)\//i.test(page.url) ||
      /\/(blog|news|article|post|story)$/i.test(page.url);
    if (!isBlogUrl) return { status: "skip" };
    if (!hasSchemaType(page.structuredData, "Article", "BlogPosting", "NewsArticle")) {
      return {
        status: "fail",
        detail: "Blog/news page is missing Article or BlogPosting JSON-LD schema. Article schema enables Google Top Stories and article rich results.",
      };
    }
    return { status: "pass" };
  }
);

const SD_008: PageRule = pageRule(
  { id: "SD_008", name: "HowTo Schema Where Step Content Detected", category: "STRUCTURED_DATA", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    if (!page.hasStepHeadings) return { status: "skip" };
    if (!hasSchemaType(page.structuredData, "HowTo")) {
      return {
        status: "fail",
        detail: "Page contains step-based content (numbered headings) but no HowTo schema. HowTo rich results can display steps directly in SERPs.",
      };
    }
    return { status: "pass" };
  }
);

const SD_009: PageRule = pageRule(
  { id: "SD_009", name: "Article Freshness Dates", category: "STRUCTURED_DATA", defaultSeverity: "MEDIUM" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const article =
      getSchemaBlock(page.structuredData, "Article") ??
      getSchemaBlock(page.structuredData, "BlogPosting") ??
      getSchemaBlock(page.structuredData, "NewsArticle");
    if (!article) return { status: "skip" };
    const raw = article.raw as Record<string, unknown>;
    const missing: string[] = [];
    if (!raw.datePublished) missing.push("datePublished");
    if (!raw.dateModified) missing.push("dateModified");
    if (missing.length > 0) {
      return {
        status: "fail",
        detail: `Article schema is missing freshness dates: ${missing.join(", ")}. Freshness signals are required for Top Stories eligibility.`,
        evidence: { missingFields: missing },
      };
    }
    return { status: "pass" };
  }
);

const SD_010: PageRule = pageRule(
  { id: "SD_010", name: "Schema @context Is schema.org", category: "STRUCTURED_DATA", defaultSeverity: "HIGH" },
  (page) => {
    if (!page.isIndexable) return { status: "skip" };
    const validBlocks = page.structuredData.filter((b) => !b.parseError);
    if (validBlocks.length === 0) return { status: "skip" };
    const invalid = validBlocks.filter((b) => !isValidSchemaContext(b.context));
    if (invalid.length > 0) {
      return {
        status: "fail",
        detail: `${invalid.length} JSON-LD block(s) use an incorrect @context (should be "https://schema.org"). Google will ignore these blocks.`,
        evidence: { invalidContexts: invalid.map((b) => b.context) },
      };
    }
    return { status: "pass" };
  }
);

export const structuredDataRules: PageRule[] = [
  SD_001, SD_002, SD_003, SD_004, SD_005,
  SD_006, SD_007, SD_008, SD_009, SD_010,
];
