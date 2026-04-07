// Backward-compat re-export. New code should import from extract-text.ts.
export { extractText as parseContent } from "./extract-text";
export type { TextExtractionResult as ContentResult } from "./extract-text";
