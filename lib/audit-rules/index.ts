import { technicalRules } from "./technical";
import { onPageRules } from "./on-page";
import { localSeoRules } from "./local-seo";
import { structuredDataRules } from "./structured-data";
import { aeoRules } from "./aeo";
import { cannibalizationRules } from "./cannibalization";
import type { AuditRule, PageRule, SitewideRule } from "./types";

export * from "./types";
export * from "./utils";

export const ALL_RULES: AuditRule[] = [
  ...technicalRules,
  ...onPageRules,
  ...localSeoRules,
  ...structuredDataRules,
  ...aeoRules,
  ...cannibalizationRules,
];

export const PAGE_RULES: PageRule[] = ALL_RULES.filter(
  (r): r is PageRule => r.scope === "PAGE"
);

export const SITEWIDE_RULES: SitewideRule[] = ALL_RULES.filter(
  (r): r is SitewideRule => r.scope === "SITEWIDE"
);

export type { AuditRule, PageRule, SitewideRule };
