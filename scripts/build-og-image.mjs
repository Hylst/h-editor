// Regénère public/og-image.png à partir de public/og-image.svg
// Usage : npm run og:build
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgPath = path.join(root, "public", "og-image.svg");
const pngPath = path.join(root, "public", "og-image.png");

const svg = fs.readFileSync(svgPath);

await sharp(Buffer.from(svg), { density: 150 })
  .resize(1200, 630)
  .png({ quality: 90, compressionLevel: 9 })
  .toFile(pngPath);

const { size } = fs.statSync(pngPath);
console.log(`✓ ${pngPath} generated (${(size / 1024).toFixed(1)} KB)`);
