import type { CheerioAPI } from "cheerio";

export interface ImageEntry {
  src: string;
  alt: string | null;
}

export interface ImagesResult {
  images: ImageEntry[];
  imageCount: number;
  imagesWithoutAlt: number;
}

export function parseImages($: CheerioAPI): ImagesResult {
  const images: ImageEntry[] = [];

  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    const altAttr = $(el).attr("alt");
    // alt="" is intentional (decorative) and counts as having alt text
    const alt = altAttr !== undefined ? altAttr : null;
    images.push({ src, alt });
  });

  const imagesWithoutAlt = images.filter((img) => img.alt === null).length;

  return {
    images,
    imageCount: images.length,
    imagesWithoutAlt,
  };
}
