import type { CheerioAPI } from "cheerio";

export interface StructuredDataBlock {
  context: string;
  type: string | string[];
  raw: Record<string, unknown>;
  parseError: string | null;
}

export interface StructuredDataResult {
  blocks: StructuredDataBlock[];
  hasParseError: boolean;
}

export function parseStructuredData($: CheerioAPI): StructuredDataResult {
  const blocks: StructuredDataBlock[] = [];
  let hasParseError = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() ?? "";
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const context = String(item["@context"] ?? "");
        const type = item["@type"] ?? "";
        blocks.push({
          context,
          type: Array.isArray(type) ? type : String(type),
          raw: item as Record<string, unknown>,
          parseError: null,
        });
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

/** Check if any block matches one of the given @type values (case-insensitive). */
export function hasSchemaType(
  blocks: StructuredDataBlock[],
  ...types: string[]
): boolean {
  const lower = types.map((t) => t.toLowerCase());
  return blocks.some((b) => {
    const bt = Array.isArray(b.type) ? b.type : [b.type];
    return bt.some((t) => lower.includes(t.toLowerCase()));
  });
}

/** Get the first block matching a given @type. */
export function getSchemaBlock(
  blocks: StructuredDataBlock[],
  type: string
): StructuredDataBlock | undefined {
  const lower = type.toLowerCase();
  return blocks.find((b) => {
    const bt = Array.isArray(b.type) ? b.type : [b.type];
    return bt.some((t) => t.toLowerCase() === lower);
  });
}

/** Check if @context is a valid schema.org URL. */
export function isValidSchemaContext(context: string): boolean {
  return (
    context === "https://schema.org" ||
    context === "http://schema.org" ||
    context === "https://schema.org/" ||
    context === "http://schema.org/"
  );
}
