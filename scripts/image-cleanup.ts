/**
 * Image retention cleanup script.
 *
 * Tiered retention:
 *   0-90 days   → full image + thumbnail (no action)
 *   90-180 days → delete full image, keep thumbnail, rewrite DB URLs
 *   180+ days   → delete thumbnail, clear images array in DB
 *
 * Also cleans up statement HTML files (no longer needed with MT bridge).
 *
 * Usage:
 *   npx tsx scripts/image-cleanup.ts
 *   npx tsx scripts/image-cleanup.ts --dry-run
 *   npx tsx scripts/image-cleanup.ts --batch=100
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { unlink, readdir } from "fs/promises";
import path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function getArg(name: string, fallback: number): number {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? parseInt(arg.split("=")[1]) : fallback;
}

const BATCH_SIZE = getArg("batch", 100);
const RETENTION_FULL_DAYS = 90;
const RETENTION_THUMB_DAYS = 180;

const PUBLIC_DIR = path.join(process.cwd(), "public");

function toThumbUrl(url: string): string {
  return url.replace(/\.webp$/, "_thumb.webp");
}

function isThumbUrl(url: string): boolean {
  return url.endsWith("_thumb.webp");
}

function urlToFilePath(url: string): string {
  return path.join(PUBLIC_DIR, url);
}

async function safeUnlink(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch {
    // File already deleted or doesn't exist — idempotent
    return false;
  }
}

interface ImageRecord {
  id: string;
  images: string[];
  createdAt: Date;
}

// Stats
let fullFilesDeleted = 0;
let thumbFilesDeleted = 0;
let recordsUpdated = 0;
let recordsCleared = 0;
let statementFilesDeleted = 0;

/**
 * Phase A: 90-day cleanup — delete full images, rewrite DB to thumbnail URLs
 */
async function cleanupFullImages(
  modelName: string,
  findMany: (skip: number, take: number, before: Date) => Promise<ImageRecord[]>,
  updateImages: (id: string, images: string[]) => Promise<void>
) {
  const cutoff = new Date(Date.now() - RETENTION_FULL_DAYS * 24 * 60 * 60 * 1000);
  let offset = 0;

  while (true) {
    const records = await findMany(offset, BATCH_SIZE, cutoff);
    if (records.length === 0) break;

    for (const record of records) {
      // Skip records already rewritten to thumbnail URLs
      const fullUrls = record.images.filter((url) => !isThumbUrl(url));
      if (fullUrls.length === 0) {
        offset++;
        continue;
      }

      const thumbUrls = fullUrls.map((url) => toThumbUrl(url));

      if (DRY_RUN) {
        console.log(
          `  [DRY RUN] ${modelName} ${record.id}: would delete ${fullUrls.length} full images, rewrite to thumbnails`
        );
      } else {
        for (const url of fullUrls) {
          const deleted = await safeUnlink(urlToFilePath(url));
          if (deleted) fullFilesDeleted++;
        }

        // Rewrite images array to thumbnail URLs
        await updateImages(record.id, thumbUrls);
        recordsUpdated++;
      }

      offset++;
    }

    console.log(`  ${modelName}: processed ${offset} records (90-day phase)`);
  }
}

/**
 * Phase B: 180-day cleanup — delete thumbnails, clear images array
 */
async function cleanupThumbnails(
  modelName: string,
  findMany: (skip: number, take: number, before: Date) => Promise<ImageRecord[]>,
  clearImages: (id: string) => Promise<void>
) {
  const cutoff = new Date(Date.now() - RETENTION_THUMB_DAYS * 24 * 60 * 60 * 1000);
  let offset = 0;

  while (true) {
    const records = await findMany(offset, BATCH_SIZE, cutoff);
    if (records.length === 0) break;

    for (const record of records) {
      if (DRY_RUN) {
        console.log(
          `  [DRY RUN] ${modelName} ${record.id}: would delete ${record.images.length} thumbnails and clear images`
        );
      } else {
        for (const url of record.images) {
          // Delete whatever file exists (could be full or thumb)
          const deleted = await safeUnlink(urlToFilePath(url));
          if (deleted) thumbFilesDeleted++;

          // Also try the thumb variant in case the URL is still the full URL
          if (!isThumbUrl(url)) {
            const thumbDeleted = await safeUnlink(urlToFilePath(toThumbUrl(url)));
            if (thumbDeleted) thumbFilesDeleted++;
          }
        }

        await clearImages(record.id);
        recordsCleared++;
      }

      offset++;
    }

    console.log(`  ${modelName}: processed ${offset} records (180-day phase)`);
  }
}

/**
 * Phase C: Clean up statement HTML files
 */
async function cleanupStatements() {
  const statementsDir = path.join(PUBLIC_DIR, "uploads", "statements");

  let userDirs: string[];
  try {
    userDirs = await readdir(statementsDir);
  } catch {
    console.log("  No statements directory found, skipping.");
    return;
  }

  for (const userDir of userDirs) {
    if (userDir === ".gitkeep") continue;
    const userPath = path.join(statementsDir, userDir);
    let files: string[];
    try {
      files = await readdir(userPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete statement file: ${userDir}/${file}`);
      } else {
        const deleted = await safeUnlink(path.join(userPath, file));
        if (deleted) statementFilesDeleted++;
      }
    }
  }
}

// Model query helpers
function findMessages(skip: number, take: number, before: Date) {
  return prisma.message.findMany({
    where: { createdAt: { lt: before }, images: { isEmpty: false } },
    select: { id: true, images: true, createdAt: true },
    skip,
    take,
    orderBy: { createdAt: "asc" },
  });
}

function findDirectMessages(skip: number, take: number, before: Date) {
  return prisma.directMessage.findMany({
    where: { createdAt: { lt: before }, images: { isEmpty: false } },
    select: { id: true, images: true, createdAt: true },
    skip,
    take,
    orderBy: { createdAt: "asc" },
  });
}

function findChannelPosts(skip: number, take: number, before: Date) {
  return prisma.channelPost.findMany({
    where: { createdAt: { lt: before }, images: { isEmpty: false } },
    select: { id: true, images: true, createdAt: true },
    skip,
    take,
    orderBy: { createdAt: "asc" },
  });
}

async function main() {
  console.log("Image Cleanup Script");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Full image retention: ${RETENTION_FULL_DAYS} days`);
  console.log(`  Thumbnail retention: ${RETENTION_THUMB_DAYS} days`);
  console.log();

  // Phase A: 90-day cleanup
  console.log("Phase A: Deleting full images older than 90 days...");

  await cleanupFullImages(
    "Message",
    findMessages,
    (id, images) => prisma.message.update({ where: { id }, data: { images } }).then(() => {})
  );

  await cleanupFullImages(
    "DirectMessage",
    findDirectMessages,
    (id, images) => prisma.directMessage.update({ where: { id }, data: { images } }).then(() => {})
  );

  await cleanupFullImages(
    "ChannelPost",
    findChannelPosts,
    (id, images) => prisma.channelPost.update({ where: { id }, data: { images } }).then(() => {})
  );

  console.log();

  // Phase B: 180-day cleanup
  console.log("Phase B: Deleting thumbnails older than 180 days...");

  await cleanupThumbnails(
    "Message",
    findMessages,
    (id) => prisma.message.update({ where: { id }, data: { images: [] } }).then(() => {})
  );

  await cleanupThumbnails(
    "DirectMessage",
    findDirectMessages,
    (id) => prisma.directMessage.update({ where: { id }, data: { images: [] } }).then(() => {})
  );

  await cleanupThumbnails(
    "ChannelPost",
    findChannelPosts,
    (id) => prisma.channelPost.update({ where: { id }, data: { images: [] } }).then(() => {})
  );

  console.log();

  // Phase C: Statement files
  console.log("Phase C: Cleaning up statement HTML files...");
  await cleanupStatements();

  console.log();
  console.log("Summary:");
  console.log(`  Full images deleted: ${fullFilesDeleted}`);
  console.log(`  Thumbnails deleted: ${thumbFilesDeleted}`);
  console.log(`  Records rewritten to thumbnails: ${recordsUpdated}`);
  console.log(`  Records cleared (images=[]): ${recordsCleared}`);
  console.log(`  Statement files deleted: ${statementFilesDeleted}`);
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
