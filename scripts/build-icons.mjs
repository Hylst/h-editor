/**
 * Generates favicon.ico, icon-192.png and icon-512.png from public/icon.svg.
 * Run with: npm run icons:build
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'icon.svg');
const svgBuffer = readFileSync(svgPath);

async function buildIcons() {
  console.log('Building H Editor icons from public/icon.svg...\n');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(root, 'public', 'icon-512.png'));
  console.log('  ✓ public/icon-512.png  (512×512)');

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(root, 'public', 'icon-192.png'));
  console.log('  ✓ public/icon-192.png  (192×192)');

  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  writeFileSync(join(root, 'public', 'favicon.ico'), wrapPngInIco(png32));
  console.log('  ✓ public/favicon.ico   (32×32 PNG-in-ICO)');

  console.log('\nDone — commit the three files in public/.');
}

/** Wraps a PNG buffer in a minimal single-image ICO container (Vista+ format). */
function wrapPngInIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: 1 = ICO
  header.writeUInt16LE(1, 4);  // image count: 1

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);           // width (32 px)
  entry.writeUInt8(32, 1);           // height (32 px)
  entry.writeUInt8(0, 2);            // color count (0 = truecolor)
  entry.writeUInt8(0, 3);            // reserved
  entry.writeUInt16LE(1, 4);         // color planes
  entry.writeUInt16LE(32, 6);        // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);  // byte size of image data
  entry.writeUInt32LE(22, 12);       // offset to image data (6 + 16)

  return Buffer.concat([header, entry, pngBuffer]);
}

buildIcons().catch(err => { console.error(err); process.exit(1); });
