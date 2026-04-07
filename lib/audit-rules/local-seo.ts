import { pageRule, sitewideRule } from "./utils";
import { hasSchemaType, getSchemaBlock } from "@/lib/parser/structured-data";
import type { PageRule, SitewideRule } from "./types";

// Local SEO page rules only fire on the homepage (isHomepage check inside each rule).

const LOCAL_001: PageRule = pageRule(
  { id: "LOCAL_001", name: "LocalBusiness Schema Present", category: "LOCAL_SEO", defaultSeverity: "HIGH" },
  (page, ctx) => {
    if (!ctx.isHomepage) return { status: "skip" };
    const localBusinessTypes = [
      "LocalBusiness", "Restaurant", "Store", "MedicalBusiness",
      "LegalService", "HealthAndBeautyBusiness", "HomeAndConstructionBusiness",
      "SportsActivityLocation", "EntertainmentBusiness", "FoodEstablishment",
      "LodgingBusiness", "Dentist", "Physician", "Attorney",
    ];
    if (!hasSchemaType(page.structuredData, ...localBusinessTypes)) {
      return {
        status: "fail",
        detail: "Homepage has no LocalBusiness (or subtype) JSON-LD schema. This is the core local entity signal for Google.",
      };
    }
    return { status: "pass" };
  }
);

const LOCAL_002: PageRule = pageRule(
  { id: "LOCAL_002", name: "NAP in Structured Data", category: "LOCAL_SEO", defaultSeverity: "HIGH" },
  (page, ctx) => {
    if (!ctx.isHomepage) return { status: "skip" };
    const block = page.structuredData.find((b) => {
      const types = Array.isArray(b.type) ? b.type : [b.type];
      return types.some((t) =>
        ["LocalBusiness", "Organization"].includes(t)
      );
    });
    if (!block) return { status: "skip" };
    const raw = block.raw as Record<string, unknown>;
    const missing: string[] = [];
    if (!raw.name) missing.push("name");
    if (!raw.telephone) missing.push("telephone");
    const address = raw.address as Record<string, unknown> | undefined;
    if (!address || !address.streetAddress) missing.push("address.streetAddress");
    if (missing.length > 0) {
      return {
        status: "fail",
        detail: `LocalBusiness schema is missing NAP fields: ${missing.join(", ")}. NAP consistency is the primary local ranking factor.`,
        evidence: { missingFields: missing },
      };
    }
    return { status: "pass" };
  }
);

const LOCAL_003: PageRule = pageRule(
  { id: "LOCAL_003", name: "GeoCoordinates Present", category: "LOCAL_SEO", defaultSeverity: "MEDIUM" },
  (page, ctx) => {
    if (!ctx.isHomepage) return { status: "skip" };
    const block = page.structuredData.find((b) => {
      const types = Array.isArray(b.type) ? b.type : [b.type];
      return types.some((t) => t === "LocalBusiness" || t.endsWith("Business"));
    });
    if (!block) return { status: "skip" };
    const raw = block.raw as Record<string, unknown>;
    const geo = raw.geo as Record<string, unknown> | undefined;
    if (!geo || (!geo.latitude && !geo["@type"])) {
      return {
        status: "fail",
        detail: "LocalBusiness schema is missing geo coordinates (latitude/longitude). Precise geo-targeting improves map pack eligibility.",
      };
    }
    return { status: "pass" };
  }
);

const LOCAL_004: PageRule = pageRule(
  { id: "LOCAL_004", name: "Opening Hours Present", category: "LOCAL_SEO", defaultSeverity: "MEDIUM" },
  (page, ctx) => {
    if (!ctx.isHomepage) return { status: "skip" };
    const block = page.structuredData.find((b) => {
      const types = Array.isArray(b.type) ? b.type : [b.type];
      return types.some((t) => t === "LocalBusiness" || t.endsWith("Business") || t.endsWith("Establishment"));
    });
    if (!block) return { status: "skip" };
    const raw = block.raw as Record<string, unknown>;
    if (!raw.openingHours && !raw.openingHoursSpecification) {
      return {
        status: "fail",
        detail: "LocalBusiness schema has no opening hours. Opening hours appear in Knowledge Panel and local SERP results.",
      };
    }
    return { status: "pass" };
  }
);

const LOCAL_005: PageRule = pageRule(
  { id: "LOCAL_005", name: "aggregateRating Present", category: "LOCAL_SEO", defaultSeverity: "LOW" },
  (page, ctx) => {
    if (!ctx.isHomepage) return { status: "skip" };
    const block = page.structuredData.find((b) => {
      const types = Array.isArray(b.type) ? b.type : [b.type];
      return types.some((t) => t === "LocalBusiness" || t.endsWith("Business") || t.endsWith("Establishment"));
    });
    if (!block) return { status: "skip" };
    const raw = block.raw as Record<string, unknown>;
    if (!raw.aggregateRating) {
      return {
        status: "fail",
        detail: "LocalBusiness schema has no aggregateRating. Star ratings displayed in SERPs can significantly increase click-through rate.",
      };
    }
    return { status: "pass" };
  }
);

// ─── Sitewide Local SEO Rules ─────────────────────────────────

const LOCAL_006: SitewideRule = sitewideRule(
  { id: "LOCAL_006", name: "Contact Page Detected", category: "LOCAL_SEO", defaultSeverity: "MEDIUM" },
  (pages) => {
    const hasContactPage = pages.some(
      (p) =>
        p.url.toLowerCase().includes("/contact") ||
        (p.title ?? "").toLowerCase().includes("contact")
    );
    if (!hasContactPage) {
      return [{ url: null, detail: "No contact page detected in crawled URLs. A contact page signals a legitimate local business and supports E-E-A-T." }];
    }
    return [];
  }
);

export const localSeoRules: Array<PageRule | SitewideRule> = [
  LOCAL_001, LOCAL_002, LOCAL_003, LOCAL_004, LOCAL_005, LOCAL_006,
];
