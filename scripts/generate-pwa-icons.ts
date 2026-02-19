import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUT_DIR = join(__dirname, "..", "public", "icons");

const BG_COLOR = "#0a0a0a";
const TEXT_COLOR = "#ffffff";

function createIconSvg(size: number, padding = 0): Buffer {
  const fontSize = Math.round((size - padding * 2) * 0.38);
  const cx = size / 2;
  const cy = size / 2;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BG_COLOR}" rx="${Math.round(size * 0.1)}"/>
  <text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-weight="700"
    font-size="${fontSize}" fill="${TEXT_COLOR}" text-anchor="middle" dominant-baseline="central">CT</text>
</svg>`;
  return Buffer.from(svg);
}

async function generate() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Standard icons
  for (const size of [192, 512] as const) {
    await sharp(createIconSvg(size))
      .png()
      .toFile(join(OUT_DIR, `icon-${size}x${size}.png`));
    console.log(`  icon-${size}x${size}.png`);
  }

  // Maskable icons — 20% safe-zone padding (10% each side)
  for (const size of [192, 512] as const) {
    const padding = Math.round(size * 0.1);
    await sharp(createIconSvg(size, padding))
      .png()
      .toFile(join(OUT_DIR, `icon-maskable-${size}x${size}.png`));
    console.log(`  icon-maskable-${size}x${size}.png`);
  }

  // Apple touch icon (180x180)
  await sharp(createIconSvg(180))
    .png()
    .toFile(join(OUT_DIR, "apple-touch-icon.png"));
  console.log("  apple-touch-icon.png");

  console.log("\nPWA icons generated in public/icons/");
}

generate().catch((err) => {
  console.error("Failed to generate PWA icons:", err);
  process.exit(1);
});
