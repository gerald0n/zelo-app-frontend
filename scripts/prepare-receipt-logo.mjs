/**
 * Gera `src/modules/printing/logo.ts` — a logo da Zelo já rasterizada em
 * 1 bit por pixel, no formato que o comando ESC/POS `GS v 0` espera, pra
 * sair no topo da comanda impressa.
 *
 * Fonte: `public/brand/zelo-wordmark.png` se existir (o lettering "ZELO
 * CONFEITARIA" limpo, preto sobre branco/transparente), senão cai no selo
 * circular `public/brand/zelo-selo-full.jpg`.
 * Rode de novo se a logo mudar: `pnpm gen:receipt-logo`.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const WORDMARK = path.resolve('public/brand/zelo-wordmark.png');
const SRC = existsSync(WORDMARK)
  ? WORDMARK
  : path.resolve('public/brand/zelo-selo-full.jpg');
const OUT = path.resolve('src/modules/printing/logo.ts');

// Largura do ponto na TM-T20X é 512; o wordmark é largo e baixo, então cabe
// numa faixa maior; o selo circular fica melhor menor.
const WIDTH = SRC === WORDMARK ? 448 : 288;
// Abaixo disso o pixel conta como tinta (fundo branco ~255, traço ~0).
const INK = 160;
const PAD = 16; // px de respiro em volta do wordmark, na resolução da fonte.

// 1) Acha a caixa que contém tinta de verdade — o `trim` do sharp não pega
//    a margem branca dessas fontes. Achata transparência em branco antes.
const full = await sharp(SRC)
  .flatten({ background: '#ffffff' })
  .grayscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: fw, height: fh, channels: fc } = full.info;
let top = fh;
let left = fw;
let right = 0;
let bottom = 0;
for (let y = 0; y < fh; y += 1) {
  for (let x = 0; x < fw; x += 1) {
    if (full.data[(y * fw + x) * fc] < INK) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
}
const box = {
  left: Math.max(0, left - PAD),
  top: Math.max(0, top - PAD),
  width: Math.min(fw, right + PAD) - Math.max(0, left - PAD),
  height: Math.min(fh, bottom + PAD) - Math.max(0, top - PAD),
};

// 2) Recorta, reduz pra largura do papel, binariza.
const { data, info } = await sharp(SRC)
  .extract(box)
  .resize(WIDTH, null, { fit: 'inside' })
  .flatten({ background: '#ffffff' })
  .grayscale()
  .raw()
  .toBuffer({ resolveWithObject: true });

const width = info.width;
const height = info.height;
const widthBytes = Math.ceil(width / 8);
const packed = new Uint8Array(widthBytes * height);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[y * width + x] < INK) {
      packed[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
}

const base64 = Buffer.from(packed).toString('base64');
const file = `// GERADO por scripts/prepare-receipt-logo.mjs — não editar à mão.
// Logo da Zelo em 1bpp (MSB primeiro, bit 1 = ponto preto) pro \`GS v 0\`.

export const RECEIPT_LOGO = {
  widthBytes: ${widthBytes},
  height: ${height},
  data: '${base64}',
} as const;
`;
await writeFile(OUT, file);
console.log(`logo.ts gerado — ${width}x${height} px, ${packed.length} bytes`);
