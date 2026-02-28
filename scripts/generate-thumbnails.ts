/**
 * One-time script to generate thumbnails for existing images.
 * Scans chat-images/ and post-images/ directories for .webp files
 * without a corresponding _thumb.webp and generates them.
 *
 * Usage:
 *   npx tsx scripts/generate-thumbnails.ts
 *   npx tsx scripts/generate-thumbnails.ts --dry-run
 */

import sharp from "sharp";
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const THUMB_MAX_WIDTH = 400;
const THUMB_QUALITY = 60;

const DIRECTORIES = ["uploads/chat-images", "uploads/post-images"];

async function processDirectory(relDir: string) {
  const dir = path.join(PUBLIC_DIR, relDir);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    console.log(`  Directory not found: ${relDir}, skipping.`);
    return 0;
  }

  // Find .webp files that are NOT thumbnails and don't have a thumbnail yet
  const fullFiles = files.filter(
    (f) => f.endsWith(".webp") && !f.endsWith("_thumb.webp")
  );

  const existingThumbs = new Set(
    files.filter((f) => f.endsWith("_thumb.webp"))
  );

  let generated = 0;

  for (const file of fullFiles) {
    const thumbName = file.replace(/\.webp$/, "_thumb.webp");
    if (existingThumbs.has(thumbName)) continue;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would generate thumbnail: ${relDir}/${thumbName}`);
      generated++;
      continue;
    }

    try {
      const buffer = await readFile(path.join(dir, file));
      const thumb = await sharp(buffer)
        .resize(THUMB_MAX_WIDTH, undefined, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer();

      await writeFile(path.join(dir, thumbName), thumb);
      generated++;
    } catch (err) {
      console.error(`  Error processing ${relDir}/${file}:`, err);
    }
  }

  return generated;
}

async function main() {
  console.log("Thumbnail Backfill Script");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log();

  let total = 0;

  for (const dir of DIRECTORIES) {
    console.log(`Processing ${dir}/...`);
    const count = await processDirectory(dir);
    console.log(`  Generated: ${count} thumbnails`);
    total += count;
  }

  console.log();
  console.log(`Total thumbnails generated: ${total}`);
}

main().catch((e) => {
  console.error("Backfill error:", e);
  process.exit(1);
});
