/**
 * Server-only image processing utilities.
 * For client-safe URL helpers, import from "@/lib/image-urls".
 */

import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";

export const FULL_MAX_WIDTH = 1200;
export const FULL_QUALITY = 80;
export const THUMB_MAX_WIDTH = 400;
export const THUMB_QUALITY = 60;

// Re-export client-safe helpers for convenience in server code
export { toThumbUrl, isThumbUrl } from "@/lib/image-urls";

/**
 * Process an image buffer and save both full-size and thumbnail versions.
 * Returns the public URL paths (not filesystem paths).
 */
export async function processAndSaveImage(
  buffer: Buffer,
  uploadDir: string,
  filename: string,
  urlPrefix: string
): Promise<{ fullUrl: string; thumbUrl: string }> {
  const fullFilename = `${filename}.webp`;
  const thumbFilename = `${filename}_thumb.webp`;

  const [fullBuffer, thumbBuffer] = await Promise.all([
    sharp(buffer)
      .resize(FULL_MAX_WIDTH, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: FULL_QUALITY })
      .toBuffer(),
    sharp(buffer)
      .resize(THUMB_MAX_WIDTH, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer(),
  ]);

  await Promise.all([
    writeFile(path.join(uploadDir, fullFilename), fullBuffer),
    writeFile(path.join(uploadDir, thumbFilename), thumbBuffer),
  ]);

  return {
    fullUrl: `${urlPrefix}/${fullFilename}`,
    thumbUrl: `${urlPrefix}/${thumbFilename}`,
  };
}
