import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outDir = path.resolve('public/icons');
await mkdir(outDir, { recursive: true });

function svgFor(size) {
  const radius = Math.round(size * 0.22);
  const font = Math.round(size * 0.46);
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#6B2B32"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif" font-weight="600"
    font-size="${font}" fill="#F7F1E6">Z</text>
</svg>`);
}

async function writePng(name, size) {
  await sharp(svgFor(size))
    .png()
    .toFile(path.join(outDir, name));
}

await writePng('icon-192.png', 192);
await writePng('icon-512.png', 512);
await writePng('apple-touch-icon.png', 180);
await writePng('badge-96.png', 96);

console.log('PWA icons written to public/icons');
