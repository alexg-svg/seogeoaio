import type { CheerioAPI } from "cheerio";
import type { LocalSignals } from "./types";

// ─── Regex patterns ───────────────────────────────────────────────────────────

/**
 * Matches common phone number formats:
 *   (123) 456-7890    +1 123 456 7890    123-456-7890
 *   +44 20 7123 4567  0800 123 4567      1-800-FLOWERS
 *
 * Intentionally permissive — false positives are less harmful than false
 * negatives for local-SEO signal detection.
 */
const RE_PHONE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)(?:\d{2,4}[\s.-]?){1,4}\d{2,4}/g;

// Require at least 7 digits to exclude short numeric strings
const RE_PHONE_MIN_DIGITS = /\d/g;
function hasEnoughDigits(match: string): boolean {
  return (match.match(RE_PHONE_MIN_DIGITS) ?? []).length >= 7;
}

/**
 * Matches US-style street addresses: "123 Main Street", "4501 Oak Ave Ste 200"
 * Also catches simple "1 Smith Road"-style patterns.
 *
 * Not exhaustive — designed to reduce false negatives for audit purposes.
 */
const RE_STREET_ADDRESS =
  /\b\d{1,5}\s+[A-Z][a-zA-Z0-9\s]{2,30}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Terrace|Ter|Circle|Cir|Suite|Ste|Floor|Fl)\b/g;

/**
 * Matches common email address patterns.
 * Extracted from visible text and mailto: href values.
 */
const RE_EMAIL = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Detect local SEO signals (NAP — Name, Address, Phone) from visible page text.
 *
 * Sources checked:
 * 1. Visible body text (noise tags removed)
 * 2. LocalBusiness / Organization JSON-LD schema (telephone, address fields)
 * 3. <a href="tel:..."> and <a href="mailto:..."> links
 *
 * Returns deduplicated, trimmed arrays.
 */
export function extractLocalSignals(
  $: CheerioAPI
): LocalSignals {
  const phones = new Set<string>();
  const streetAddresses = new Set<string>();
  const emails = new Set<string>();

  // ── 1. Visible body text ──────────────────────────────────────────────────
  const $body = $.load($.html())("body");
  $body.find("script, style, noscript, svg").remove();
  const bodyText = $body.text();

  for (const match of matchAll(bodyText, RE_PHONE)) {
    if (hasEnoughDigits(match)) phones.add(normalisePhone(match));
  }
  for (const match of matchAll(bodyText, RE_STREET_ADDRESS)) {
    streetAddresses.add(match.trim());
  }
  for (const match of matchAll(bodyText, RE_EMAIL)) {
    emails.add(match.toLowerCase());
  }

  // ── 2. JSON-LD telephone and address fields ───────────────────────────────
  $('script[type="application/ld+json"]').each((_, el) => {
    const src = $(el).html() ?? "";
    try {
      const obj = JSON.parse(src);
      const items: unknown[] = Array.isArray(obj) ? obj : [obj];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const schema = item as Record<string, unknown>;

        // telephone
        const phone = schema.telephone;
        if (typeof phone === "string" && phone.trim()) {
          phones.add(normalisePhone(phone.trim()));
        }

        // address
        const addr = schema.address;
        if (addr && typeof addr === "object") {
          const a = addr as Record<string, unknown>;
          const street = [a.streetAddress, a.addressLocality, a.addressRegion]
            .filter(Boolean)
            .join(", ");
          if (street) streetAddresses.add(street.trim());
        }

        // email
        const email = schema.email;
        if (typeof email === "string" && email.includes("@")) {
          emails.add(email.toLowerCase().trim());
        }
      }
    } catch {
      // Malformed JSON — skip
    }
  });

  // ── 3. Anchor href="tel:" and "mailto:" ──────────────────────────────────
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (href.startsWith("tel:")) {
      const raw = decodeURIComponent(href.slice(4)).trim();
      if (raw) phones.add(normalisePhone(raw));
    } else if (href.startsWith("mailto:")) {
      const addr = href.slice(7).split("?")[0].trim().toLowerCase();
      if (addr && addr.includes("@")) emails.add(addr);
    }
  });

  const phonesArr = Array.from(phones).filter(Boolean);
  const addressesArr = Array.from(streetAddresses).filter(Boolean);
  const emailsArr = Array.from(emails).filter(Boolean);

  return {
    phones: phonesArr,
    streetAddresses: addressesArr,
    emails: emailsArr,
    hasNapSignals: phonesArr.length > 0 || addressesArr.length > 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collapse whitespace and strip common noise chars from phone strings. */
function normalisePhone(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Polyfill-safe String.matchAll using exec loop. */
function matchAll(text: string, re: RegExp): string[] {
  const results: string[] = [];
  const pattern = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    results.push(m[0]);
    // Guard against zero-width matches causing infinite loop
    if (m.index === pattern.lastIndex) pattern.lastIndex++;
  }
  return results;
}
