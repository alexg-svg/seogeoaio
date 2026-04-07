import type { CheerioAPI } from "cheerio";
import type { ImageEntry } from "./types";

export interface ImagesExtractionResult {
  images: ImageEntry[];
  imageCount: number;
  imagesWithoutAlt: number; // alt attribute entirely absent (not just empty string)
}

/**
 * Extract all <img> elements and their alt attributes.
 *
 * alt = null  → attribute is absent (accessibility / SEO issue)
 * alt = ""    → intentionally empty (decorative) — this is correct usage
 * alt = "..."  → descriptive text
 */
export function extractImages($: CheerioAPI): ImagesExtractionResult {
  const images: ImageEntry[] = [];

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") || // lazy-loaded
      $(el).attr("data-lazy-src") ||
      "";

    const altAttr = $(el).attr("alt");
    const alt = altAttr !== undefined ? altAttr : null;

    images.push({ src, alt });
  });

  // Also pick up <picture> + <source> combinations where <img> is the fallback
  // (already captured above via the img selector)

  const imagesWithoutAlt = images.filter((img) => img.alt === null).length;

  return {
    images,
    imageCount: images.length,
    imagesWithoutAlt,
  };
}
