/**
 * Gera `public/brand/zelo-selo.png` (selo com fundo transparente) a partir do
 * arquivo original com fundo branco `public/brand/zelo-selo-full.jpg`.
 *
 * Se um dia chegar um selo já com transparência, é só salvá-lo direto como
 * `public/brand/zelo-selo.png` e ignorar este script.
 *
 * Estratégia: recorta a margem branca, faz o key do branco (grayscale +
 * threshold) e protege o miolo com um círculo de segurança, pra não abrir
 * buracos nos brilhos claros de dentro do selo.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('public/brand/zelo-selo-full.jpg');
const OUT = path.resolve('public/brand/zelo-selo.png');
// 512 cobre o maior ícone sem virar um asset pesado no header do cardápio.
const SIZE = 512;

try {
  await access(SRC);
} catch {
  console.log(
    'public/brand/zelo-selo-full.jpg ausente — nada a preparar ' +
      '(use um zelo-selo.png com transparência direto, se tiver).',
  );
  process.exit(0);
}

const trimmed = await sharp(SRC).trim({ threshold: 12 }).toBuffer();
const rgb = await sharp(trimmed)
  .resize(SIZE, SIZE, { fit: 'cover' })
  .toBuffer();

const circle = (r) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
      `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${r}" fill="#fff"/></svg>`,
  );

// Alpha = "não é branco" (com feather leve).
const notWhite = await sharp(rgb)
  .grayscale()
  .threshold(243)
  .negate()
  .blur(1.2)
  .toBuffer();

// (notWhite OU círculo de segurança) E círculo externo de recorte.
const alpha = await sharp(notWhite)
  .composite([
    { input: circle(SIZE * 0.444), blend: 'lighten' },
    { input: circle(SIZE * 0.496), blend: 'multiply' },
  ])
  .toColourspace('b-w')
  .toBuffer();

await sharp(rgb)
  .joinChannel(alpha)
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(OUT);

console.log('public/brand/zelo-selo.png gerado a partir de zelo-selo-full.jpg');
