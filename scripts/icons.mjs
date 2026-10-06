import sharp from 'sharp';
import fs from 'node:fs';

// The selected vector is the single source for browser and installation icons.
const svg = fs.readFileSync('public/favicon.svg');
for (const size of [192, 512])
  await sharp(svg).resize(size, size).png().toFile(`public/icon-${size}.png`);
// Opaque backgrounds let launchers apply their own masks without transparent corners.
await sharp(svg)
  .resize(512, 512)
  .flatten({ background: '#153f56' })
  .png()
  .toFile('public/icon-maskable-512.png');
await sharp(svg)
  .resize(180, 180)
  .flatten({ background: '#153f56' })
  .png()
  .toFile('public/apple-touch-icon.png');
