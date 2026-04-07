/**
 * Recommendation generation.
 *
 * Groups IssueOutput objects by ruleId, looks up a template, and produces
 * a recommendation per failing rule per audit. Templates are deterministic
 * plain-English content — no AI, no external calls.
 */

import type { IssueOutput, IssueCategory, IssueSeverity } from "@/lib/audit-rules/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationInput {
  auditId: string;
  ruleId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  implementationSteps: string[];
  exampleFix: string | null;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effort: "HIGH" | "MEDIUM" | "LOW";
  priority: number;
  affectedPageCount: number;
  totalScoreImpact: number;
  /** Distinct affected URLs, capped at 20. null for sitewide-only issues. */
  affectedUrls: string[];
}

interface Template {
  title: string;
  summary: string;
  whyItMatters: string;
  implementationSteps: string[];
  exampleFix?: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effort: "HIGH" | "MEDIUM" | "LOW";
  basePriority: number; // 1–100; lower = fix first
}

// ─── Template registry ────────────────────────────────────────────────────────

const TEMPLATES: Record<string, Template> = {
  // ── Basic page rules ────────────────────────────────────────────────────────

  BASIC_PAGE_001: {
    title: "Add missing title tags",
    summary: "One or more pages are missing a <title> tag entirely.",
    whyItMatters:
      "The title tag is the single most important on-page SEO element. Search engines use it as the primary text in SERP results. Pages without a title cannot rank competitively.",
    implementationSteps: [
      "Open the CMS or template for each affected page.",
      "Add a descriptive, keyword-rich <title> between 10 and 60 characters.",
      "Ensure the title is unique across the site.",
      "Re-crawl after deployment to confirm the tag is present.",
    ],
    exampleFix: '<title>Best Running Shoes for Flat Feet | ShoeStore</title>',
    impact: "HIGH",
    effort: "LOW",
    basePriority: 1,
  },

  BASIC_PAGE_002: {
    title: "Lengthen short title tags",
    summary: "Some titles are fewer than 10 characters and carry too little keyword signal.",
    whyItMatters:
      "Very short titles fail to communicate the page topic to search engines and users alike, reducing click-through rates from SERPs.",
    implementationSteps: [
      "Identify the page topic and primary keyword.",
      "Expand the title to at least 30 characters while keeping it under 60.",
      "Include the brand name at the end if space allows.",
    ],
    exampleFix: '<title>Running Shoes | ShoeStore</title>',
    impact: "MEDIUM",
    effort: "LOW",
    basePriority: 8,
  },

  BASIC_PAGE_003: {
    title: "Shorten over-long title tags",
    summary: "Some titles exceed 60 characters and will be truncated in SERPs.",
    whyItMatters:
      "Truncated titles lose the end of the message in search results, reducing click-through rates. Search engines may also rewrite the title, reducing your control.",
    implementationSteps: [
      "Edit each affected title to fit within 50–60 characters.",
      "Prioritise the most important keywords at the front.",
      "Remove filler words like 'Welcome to' or repeated brand mentions.",
    ],
    impact: "LOW",
    effort: "LOW",
    basePriority: 20,
  },

  BASIC_PAGE_004: {
    title: "Add missing meta descriptions",
    summary: "Pages are missing meta description tags.",
    whyItMatters:
      "While not a direct ranking signal, meta descriptions are shown as the snippet in SERPs. Without one, Google writes its own — often poorly. Good descriptions improve click-through rates.",
    implementationSteps: [
      "Write a compelling 120–155 character description for each affected page.",
      "Include the primary keyword naturally.",
      "End with a call-to-action where relevant (e.g. 'Learn more', 'Shop now').",
      "Keep each description unique across the site.",
    ],
    exampleFix: '<meta name="description" content="Shop the best running shoes for flat feet. Free UK delivery on orders over £50. Browse 200+ styles." />',
    impact: "MEDIUM",
    effort: "LOW",
    basePriority: 10,
  },

  BASIC_PAGE_005: {
    title: "Add missing H1 headings",
    summary: "Pages are missing an H1 heading.",
    whyItMatters:
      "The H1 is a strong on-page signal that tells search engines what the page is about. It also anchors the content hierarchy for users and screen readers.",
    implementationSteps: [
      "Add a single H1 to each affected page.",
      "Make it descriptive of the page's primary topic.",
      "Align it closely with the title tag — they don't need to be identical.",
      "Do not use CSS to visually hide the H1.",
    ],
    exampleFix: "<h1>Running Shoes for Flat Feet</h1>",
    impact: "HIGH",
    effort: "LOW",
    basePriority: 3,
  },

  BASIC_PAGE_006: {
    title: "Remove duplicate H1 headings",
    summary: "Pages have more than one H1 tag.",
    whyItMatters:
      "Multiple H1s dilute the page's topic signal. Best practice is one H1 per page, with H2–H6 used for subheadings.",
    implementationSteps: [
      "Audit the page template for any layout blocks that insert an extra H1.",
      "Demote additional H1s to H2 or lower.",
      "Ensure the single remaining H1 is the main page heading.",
    ],
    impact: "MEDIUM",
    effort: "LOW",
    basePriority: 12,
  },

  BASIC_PAGE_007: {
    title: "Add H2/H3 subheadings to long pages",
    summary: "Pages with substantial content have no H2 or H3 subheadings.",
    whyItMatters:
      "Subheadings signal content structure to crawlers and improve readability. They also create additional keyword opportunities and improve dwell time.",
    implementationSteps: [
      "Break content sections into logical chunks.",
      "Use H2 for major sections and H3 for subsections.",
      "Include relevant secondary keywords in subheadings.",
      "Aim for one H2 per ~200 words of content.",
    ],
    impact: "LOW",
    effort: "MEDIUM",
    basePriority: 25,
  },

  BASIC_PAGE_008: {
    title: "Add canonical tags",
    summary: "Pages are missing a <link rel=\"canonical\"> tag.",
    whyItMatters:
      "Without a canonical tag, duplicate or near-duplicate URLs can split PageRank and confuse crawlers. A self-referencing canonical is the minimum baseline.",
    implementationSteps: [
      "Add a self-referencing canonical to every indexable page.",
      "For Next.js/React, use the <Head> component or metadata API.",
      "For CMS sites, enable canonical generation in SEO settings.",
      "Verify canonicals point to the preferred version (https, non-www, etc.).",
    ],
    exampleFix: '<link rel="canonical" href="https://example.com/running-shoes" />',
    impact: "MEDIUM",
    effort: "LOW",
    basePriority: 9,
  },

  BASIC_PAGE_009: {
    title: "Review noindex directives",
    summary: "Pages are marked noindex and will not appear in search results.",
    whyItMatters:
      "Noindex pages are deliberately excluded from search engines. If any of the flagged pages should be indexed, the directive must be removed immediately.",
    implementationSteps: [
      "Review each affected page and confirm whether noindex is intentional.",
      "For pages that should be indexed: remove the noindex meta tag or X-Robots-Tag header.",
      "For pages correctly set to noindex (login pages, thank-you pages, etc.): no action needed.",
      "Re-crawl after changes to verify the directive is gone.",
    ],
    impact: "HIGH",
    effort: "LOW",
    basePriority: 5,
  },

  BASIC_PAGE_010: {
    title: "Expand thin content pages",
    summary: "Pages have fewer than 300 words of content.",
    whyItMatters:
      "Thin pages provide little value to users and are less likely to rank. Google's Helpful Content guidance explicitly penalises low-value pages.",
    implementationSteps: [
      "Identify the target audience and intent for each thin page.",
      "Expand content to at least 300 words, covering the topic comprehensively.",
      "Add supporting sections: FAQs, examples, related topics.",
      "Consider consolidating thin pages that cover similar topics.",
    ],
    impact: "MEDIUM",
    effort: "HIGH",
    basePriority: 18,
  },

  BASIC_PAGE_011: {
    title: "Add a direct answer in the opening paragraph",
    summary: "Pages lack a clear, concise answer in the first ~150 words.",
    whyItMatters:
      "Featured snippets and AI-generated answers are extracted from the opening of pages. Starting with a clear direct answer significantly improves AEO eligibility.",
    implementationSteps: [
      "Identify the primary question your page answers.",
      "Write a 2–3 sentence direct answer at the very start of the body content.",
      "Follow it with supporting detail, not the other way around.",
      "Use plain language — avoid jargon in the opening.",
    ],
    exampleFix: "Running shoes for flat feet need extra arch support and motion control features to prevent overpronation. Look for shoes with a straight or semi-curved last and firm midsoles.",
    impact: "LOW",
    effort: "MEDIUM",
    basePriority: 30,
  },

  BASIC_PAGE_012: {
    title: "Add question-style subheadings",
    summary: "Pages have no H2/H3 headings phrased as questions.",
    whyItMatters:
      "Question headings match how users search ('How do I…', 'What is…'). They improve relevance for long-tail queries and FAQ snippet eligibility.",
    implementationSteps: [
      "Review the page topic and identify 3–5 questions users commonly ask.",
      "Rephrase existing subheadings as questions where natural.",
      "Add FAQ sections using H3 questions and paragraph answers.",
    ],
    impact: "LOW",
    effort: "LOW",
    basePriority: 35,
  },

  BASIC_PAGE_013: {
    title: "Add alt text to images",
    summary: "Images are missing the alt attribute.",
    whyItMatters:
      "Alt text is used by screen readers (accessibility) and by Google Image Search. Missing alt text fails WCAG 2.1 and misses keyword placement opportunities.",
    implementationSteps: [
      "For each image without alt text, write a short (≤125 char) descriptive phrase.",
      "Decorative images should use alt=\"\" (empty string, not omitted).",
      "Include target keywords naturally but do not keyword-stuff.",
      "For CMS sites, enable alt text prompts for media uploads.",
    ],
    exampleFix: '<img src="shoe.jpg" alt="Navy blue stability running shoe with cushioned sole" />',
    impact: "MEDIUM",
    effort: "MEDIUM",
    basePriority: 15,
  },

  BASIC_PAGE_014: {
    title: "Add NAP signals to the homepage",
    summary: "The homepage has no detectable phone number, address, or email.",
    whyItMatters:
      "Name, Address, and Phone (NAP) consistency is a core local SEO ranking factor. Google uses these signals to verify business legitimacy and location.",
    implementationSteps: [
      "Add a visible NAP section (footer or contact block) to the homepage.",
      "Ensure the address format matches your Google Business Profile exactly.",
      "Include a phone number in tel: link format for click-to-call.",
      "Also add the NAP details inside your LocalBusiness JSON-LD schema.",
    ],
    exampleFix: '<address>123 High Street, London, EC1A 1BB | <a href="tel:+44207123456">020 7123 456</a></address>',
    impact: "MEDIUM",
    effort: "LOW",
    basePriority: 22,
  },

  BASIC_PAGE_015: {
    title: "Add LocalBusiness JSON-LD schema to the homepage",
    summary: "The homepage is missing LocalBusiness (or a subtype) structured data.",
    whyItMatters:
      "LocalBusiness schema helps Google understand your business type, location, hours, and contact info. It can trigger rich results in local search.",
    implementationSteps: [
      "Identify the most specific LocalBusiness subtype for your business (e.g. Restaurant, LegalService, MedicalBusiness).",
      "Create a JSON-LD block with @type, name, address (PostalAddress), telephone, url, and openingHours.",
      "Add it to the homepage <head> via a <script type=\"application/ld+json\"> tag.",
      "Validate with Google's Rich Results Test.",
    ],
    exampleFix: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Acme Plumbing",
      address: { "@type": "PostalAddress", streetAddress: "1 Example St", addressLocality: "London", postalCode: "EC1A 1BB" },
      telephone: "+44207123456",
      url: "https://example.com",
    }, null, 2),
    impact: "HIGH",
    effort: "MEDIUM",
    basePriority: 7,
  },

  // ── Sitewide rules ──────────────────────────────────────────────────────────

  BASIC_SITE_001: {
    title: "Fix duplicate title tags",
    summary: "Multiple pages share the same title tag.",
    whyItMatters:
      "Duplicate titles force Google to guess which page is authoritative for a given query, diluting rankings across all affected pages.",
    implementationSteps: [
      "Audit all duplicate title groups.",
      "Assign a unique, page-specific title to each page.",
      "If pages have duplicate titles because they have duplicate content, consider consolidating them into one page.",
      "For dynamically-generated titles, review the CMS template logic.",
    ],
    impact: "HIGH",
    effort: "MEDIUM",
    basePriority: 4,
  },

  BASIC_SITE_002: {
    title: "Fix duplicate meta descriptions",
    summary: "Multiple pages share the same meta description.",
    whyItMatters:
      "Duplicate meta descriptions reduce click-through rates — users see identical snippets for different results and cannot distinguish between them.",
    implementationSteps: [
      "Write a unique meta description for each affected page.",
      "Focus on each page's specific value proposition.",
      "For large sites, prioritise high-traffic pages first and use templates for the rest.",
    ],
    impact: "MEDIUM",
    effort: "MEDIUM",
    basePriority: 14,
  },

  BASIC_SITE_003: {
    title: "Resolve title/keyword cannibalization",
    summary: "Page titles are very similar across multiple pages, risking keyword cannibalization.",
    whyItMatters:
      "When two or more pages target the same keywords, they compete against each other in search results. Google may rank neither as highly as a single, authoritative page would rank.",
    implementationSteps: [
      "Review each pair of similar-title pages and determine if they should remain separate.",
      "If they serve different intents: differentiate the titles and content clearly.",
      "If they serve the same intent: merge them into a single, comprehensive page with a 301 redirect from the deleted URL.",
      "Update internal links to point to the canonical page.",
    ],
    impact: "MEDIUM",
    effort: "HIGH",
    basePriority: 16,
  },

  BASIC_SITE_004: {
    title: "Fix widespread missing metadata",
    summary: "A large proportion of indexable pages are missing titles and/or meta descriptions.",
    whyItMatters:
      "This pattern suggests a CMS template or deployment issue rather than isolated omissions. Fixing the template will resolve all affected pages at once.",
    implementationSteps: [
      "Identify the page templates generating affected URLs.",
      "Add dynamic title and meta description generation to the template.",
      "For Next.js: use the `metadata` export or `generateMetadata()` in each layout/page.",
      "For CMS: enable SEO fields and add a fallback formula (e.g. H1 + site name).",
      "Re-crawl after deployment to verify coverage.",
    ],
    impact: "HIGH",
    effort: "MEDIUM",
    basePriority: 2,
  },

  // ── Technical rules (common subset) ────────────────────────────────────────

  TECH_001: {
    title: "Switch to HTTPS",
    summary: "Pages are being served over HTTP instead of HTTPS.",
    whyItMatters:
      "HTTPS is a confirmed Google ranking factor. Browsers mark HTTP sites as 'Not Secure', reducing user trust and conversion rates.",
    implementationSteps: [
      "Obtain an SSL/TLS certificate (Let's Encrypt is free).",
      "Configure your server or hosting platform to serve all traffic over HTTPS.",
      "Set up a permanent 301 redirect from HTTP to HTTPS.",
      "Update all internal links and canonical tags to use https://.",
      "Submit the HTTPS sitemap to Google Search Console.",
    ],
    impact: "HIGH",
    effort: "MEDIUM",
    basePriority: 1,
  },

  TECH_003: {
    title: "Remove noindex from important pages",
    summary: "Indexable-looking pages carry a noindex directive.",
    whyItMatters:
      "A noindex tag permanently excludes pages from search results. Verify that every noindex is deliberate.",
    implementationSteps: [
      "Review all pages flagged as noindex.",
      "Remove the noindex directive from any page that should appear in search results.",
      "Request indexing in Google Search Console after removing the directive.",
    ],
    impact: "HIGH",
    effort: "LOW",
    basePriority: 2,
  },
};

// ─── Fallback template builder ────────────────────────────────────────────────

const SEVERITY_IMPACT_MAP: Record<IssueSeverity, "HIGH" | "MEDIUM" | "LOW"> = {
  CRITICAL: "HIGH",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INFO: "LOW",
};

const CATEGORY_EFFORT_MAP: Record<IssueCategory, "HIGH" | "MEDIUM" | "LOW"> = {
  TECHNICAL_SEO: "LOW",
  ON_PAGE_SEO: "LOW",
  LOCAL_SEO: "MEDIUM",
  STRUCTURED_DATA: "MEDIUM",
  AEO: "MEDIUM",
  CONTENT: "HIGH",
};

const SEVERITY_PRIORITY_OFFSET: Record<IssueSeverity, number> = {
  CRITICAL: 0,
  HIGH: 10,
  MEDIUM: 20,
  LOW: 35,
  INFO: 50,
};

function fallbackTemplate(issue: IssueOutput): Template {
  return {
    title: issue.ruleName,
    summary: `Issue detected: ${issue.ruleName}. Review and fix the affected pages.`,
    whyItMatters: `This issue is categorised as ${issue.category.replace(/_/g, " ")} with ${issue.severity} severity. Resolving it will improve your audit score and site quality.`,
    implementationSteps: [
      `Review each affected page for this issue: ${issue.ruleName}.`,
      "Apply the fix described in the issue detail.",
      "Re-crawl the affected pages to verify the issue is resolved.",
    ],
    impact: SEVERITY_IMPACT_MAP[issue.severity],
    effort: CATEGORY_EFFORT_MAP[issue.category],
    basePriority: 50 + SEVERITY_PRIORITY_OFFSET[issue.severity],
  };
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate one recommendation per unique failing ruleId.
 *
 * @param auditId   - Prisma Audit.id — stored on each recommendation.
 * @param issues    - All IssueOutput objects (page + sitewide) for the audit.
 * @returns Array ready to upsert into the Recommendation table.
 */
export function generateRecommendations(
  auditId: string,
  issues: IssueOutput[]
): RecommendationInput[] {
  // Group failing issues by ruleId
  const byRule = new Map<string, IssueOutput[]>();
  for (const issue of issues) {
    const group = byRule.get(issue.ruleId) ?? [];
    group.push(issue);
    byRule.set(issue.ruleId, group);
  }

  const recommendations: RecommendationInput[] = [];

  for (const [ruleId, ruleIssues] of byRule) {
    const representative = ruleIssues[0];
    const template = TEMPLATES[ruleId] ?? fallbackTemplate(representative);

    // Collect distinct affected URLs (null entries are sitewide — exclude)
    const distinctUrls = [
      ...new Set(ruleIssues.map((i) => i.url).filter((u): u is string => u !== null)),
    ].slice(0, 20);

    const totalScoreImpact = ruleIssues.reduce((sum, i) => sum + i.scoreImpact, 0);

    recommendations.push({
      auditId,
      ruleId,
      title: template.title,
      summary: template.summary,
      whyItMatters: template.whyItMatters,
      implementationSteps: template.implementationSteps,
      exampleFix: template.exampleFix ?? null,
      impact: template.impact,
      effort: template.effort,
      // Boost priority for rules affecting many pages
      priority: Math.max(
        1,
        template.basePriority - Math.floor(distinctUrls.length / 5)
      ),
      affectedPageCount: distinctUrls.length,
      totalScoreImpact,
      affectedUrls: distinctUrls,
    });
  }

  // Sort by priority ascending (1 = fix first)
  recommendations.sort((a, b) => a.priority - b.priority);

  return recommendations;
}
