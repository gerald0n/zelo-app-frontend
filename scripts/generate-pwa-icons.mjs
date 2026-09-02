import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outDir = path.resolve('public/icons');
/** Selo da marca (de preferência PNG com fundo transparente, 1024px+). */
const SEAL = path.resolve('public/brand/zelo-selo.png');
/** Creme da marca — mesmo do `background_color` do manifest e do splash. */
const CREAM = '#F7F1E6';
const WINE = '#6B2B32';
const CREAM_RGB = { r: 0xf7, g: 0xf1, b: 0xe6, alpha: 1 };

await mkdir(outDir, { recursive: true });

async function hasSeal() {
  try {
    await access(SEAL);
    return true;
  } catch {
    return false;
  }
}

/** Fallback: o "Z" serifado sobre vinho, caso o selo não esteja disponível. */
function letterSvg(size) {
  const radius = Math.round(size * 0.22);
  const font = Math.round(size * 0.46);
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${WINE}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif" font-weight="600"
    font-size="${font}" fill="${CREAM}">Z</text>
</svg>`);
}

function circleMask(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  );
}

/**
 * Selo recortado num círculo (some com os cantos brancos do arquivo original)
 * e centralizado sobre o creme da marca.
 *
 * @param inset fração livre em cada borda (folga p/ a máscara do launcher).
 */
async function sealIcon(size, inset) {
  const disc = Math.round(size * (1 - inset * 2));
  const seal = await sharp(SEAL)
    .resize(disc, disc, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .composite([{ input: circleMask(disc), blend: 'dest-in' }])
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: CREAM_RGB },
  })
    .composite([{ input: seal, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true });
}

async function writeIcon(name, size, { maskable = false } = {}) {
  const file = path.join(outDir, name);
  if (await hasSeal()) {
    // maskable: safe zone ~80% → selo ~72%. "any": folga menor, mas o
    // suficiente pro arredondamento do iOS/Android não comer a borda do selo.
    await (await sealIcon(size, maskable ? 0.14 : 0.1)).toFile(file);
  } else {
    await sharp(letterSvg(size)).png().toFile(file);
  }
}

await writeIcon('icon-192.png', 192);
await writeIcon('icon-512.png', 512);
await writeIcon('icon-512-maskable.png', 512, { maskable: true });
await writeIcon('apple-touch-icon.png', 180);

// Badge de notificação: o Android trata como silhueta (alpha), então segue o "Z".
await sharp(letterSvg(96)).png().toFile(path.join(outDir, 'badge-96.png'));

console.log(
  (await hasSeal())
    ? 'Ícones PWA gerados a partir de public/brand/zelo-selo.png'
    : 'public/brand/zelo-selo.png ausente — ícones gerados com o "Z" de fallback',
);
