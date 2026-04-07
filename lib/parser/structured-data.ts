// Backward-compat re-export. New code should import from extract-schema.ts.
export {
  extractSchema as parseStructuredData,
  hasSchemaType,
  getSchemaBlock,
  getSchemaBlocks,
  isValidSchemaContext,
} from "./extract-schema";
export type { SchemaExtractionResult as StructuredDataResult } from "./extract-schema";
// StructuredDataBlock is defined in types.ts; re-export for callers that
// imported it from here previously.
export type { StructuredDataBlock } from "./types";
