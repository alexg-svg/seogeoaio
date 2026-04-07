import type { CheerioAPI } from "cheerio";
import type { StructuredDataBlock } from "./types";

export interface SchemaExtractionResult {
  blocks: StructuredDataBlock[];
  hasParseError: boolean;
}

/**
 * Extract and parse all JSON-LD blocks from <script type="application/ld+json">.
 *
 * - Handles both single objects and top-level arrays.
 * - Records parse errors on individual blocks so broken JSON doesn't prevent
 *   valid blocks from being returned.
 * - Does NOT validate against schema.org vocabulary — that is a rule concern.
 */
export function extractSchema($: CheerioAPI): SchemaExtractionResult {
  const blocks: StructuredDataBlock[] = [];
  let hasParseError = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    const source = $(el).html() ?? "";
    if (!source.trim()) return;

    try {
      const parsed: unknown = JSON.parse(source);
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const context = String(obj["@context"] ?? "");
        const rawType = obj["@type"] ?? "";
        const type: string | string[] = Array.isArray(rawType)
          ? rawType.map(String)
          : String(rawType);

        blocks.push({ context, type, raw: obj, parseError: null });
      }
    } catch (err) {
      hasParseError = true;
      blocks.push({
        context: "",
        type: "",
        raw: {},
        parseError: String(err),
      });
    }
  });

  return { blocks, hasParseError };
}

// ─── Query helpers (used by audit rules) ──────────────────────────────────────

/**
 * Return true if any block's @type includes one of the given type names
 * (case-insensitive). Ignores blocks with parse errors.
 */
export function hasSchemaType(
  blocks: StructuredDataBlock[],
  ...types: string[]
): boolean {
  const lower = types.map((t) => t.toLowerCase());
  return blocks.some((b) => {
    if (b.parseError) return false;
    const bt = Array.isArray(b.type) ? b.type : [b.type];
    return bt.some((t) => lower.includes(t.toLowerCase()));
  });
}

/**
 * Return the first block whose @type includes the given name (case-insensitive).
 */
export function getSchemaBlock(
  blocks: StructuredDataBlock[],
  type: string
): StructuredDataBlock | undefined {
  const lower = type.toLowerCase();
  return blocks.find((b) => {
    if (b.parseError) return false;
    const bt = Array.isArray(b.type) ? b.type : [b.type];
    return bt.some((t) => t.toLowerCase() === lower);
  });
}

/**
 * Return all blocks of a given @type.
 */
export function getSchemaBlocks(
  blocks: StructuredDataBlock[],
  type: string
): StructuredDataBlock[] {
  const lower = type.toLowerCase();
  return blocks.filter((b) => {
    if (b.parseError) return false;
    const bt = Array.isArray(b.type) ? b.type : [b.type];
    return bt.some((t) => t.toLowerCase() === lower);
  });
}

/** Check that @context is a recognised schema.org URL variant. */
export function isValidSchemaContext(context: string): boolean {
  const normalised = context.replace(/\/$/, "").toLowerCase();
  return normalised === "https://schema.org" || normalised === "http://schema.org";
}
