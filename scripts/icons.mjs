import sharp from 'sharp';
import fs from 'node:fs';

// The selected vector is the single source for browser and installation icons.
const svg = fs.readFileSync('public/favicon.svg');
// New URLs avoid reusing the previous identity from browser/launcher icon caches.
fs.writeFileSync('public/favicon-crayon.svg', svg);
await sharp(svg).resize(32, 32).png().toFile('public/favicon-crayon-32.png');
for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icon-crayon-${size}.png`);
  // Retain the legacy URLs for older installed versions and notification references.
  fs.copyFileSync(`public/icon-crayon-${size}.png`, `public/icon-${size}.png`);
}
// Opaque backgrounds let launchers apply their own masks without transparent corners.
await sharp(svg)
  .resize(512, 512)
  .flatten({ background: '#153f56' })
  .png()
  .toFile('public/icon-crayon-maskable-512.png');
fs.copyFileSync('public/icon-crayon-maskable-512.png', 'public/icon-maskable-512.png');
await sharp(svg)
  .resize(180, 180)
  .flatten({ background: '#153f56' })
  .png()
  .toFile('public/apple-touch-icon-crayon.png');
fs.copyFileSync('public/apple-touch-icon-crayon.png', 'public/apple-touch-icon.png');
