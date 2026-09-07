/**
 * Renderiza a comanda / comprovante / teste num PNG aproximado (mesma
 * largura de 512 pontos da TM-T20X), interpretando o subconjunto de ESC/POS
 * que a gente emite. Só pra conferir layout — não substitui imprimir.
 *
 *   node scripts/preview-receipt.mjs [comanda|comprovante|teste]
 */
import ts from 'typescript';
import sharp from 'sharp';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tmp = mkdtempSync(path.join(tmpdir(), 'receipt-preview-'));

function transpile(src, out) {
  let code = readFileSync(path.resolve('src/modules/printing', src), 'utf8');
  code = code
    .replace(/@\/modules\/printing\/(\w+)/g, './$1.mjs')
    .replace(/@\/modules\/catalog\/types/g, './catalog-shim.mjs');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: 'ESNext', target: 'ES2020' },
  }).outputText;
  writeFileSync(path.join(tmp, out), js);
}

writeFileSync(
  path.join(tmp, 'catalog-shim.mjs'),
  'export const formatCatalogPrice = (c) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;\n',
);
transpile('escpos.ts', 'escpos.mjs');
transpile('logo.ts', 'logo.mjs');
transpile('types.ts', 'types.mjs');
transpile('receipts.ts', 'receipts.mjs');

const { buildKitchenTicket, buildDeliverySlip, buildTestPrint } = await import(
  path.join(tmp, 'receipts.mjs')
);

const kitchen = {
  orderNumber: '#1013',
  createdAt: '2026-09-05T14:51:00Z',
  deliveryMethod: 'delivery',
  timing: 'scheduled',
  scheduledFor: '2026-09-06T20:00:00Z',
  isGuest: false,
  customerName: 'Maria Silva',
  customerPhone: '(85) 9 9999-9999',
  address: {
    formatted: 'Rua das Flores, 100 - Centro, Pereiro/CE',
    referencePoint: 'casa amarela ao lado da praca',
  },
  items: [
    { name: 'Bolo de chocolate M', quantity: 2, addOns: [{ name: 'recheio extra', quantity: 1 }], note: 'sem lactose' },
    { name: 'Brigadeiro (cx 12)', quantity: 1, addOns: [], note: null },
  ],
  customerNote: 'Sem acucar no bolo, por favor',
  internalNote: 'Ligar antes de sair pra entrega',
};

const which = process.argv[2] || 'comanda';
const bytes =
  which === 'teste'
    ? buildTestPrint()
    : which === 'comprovante'
      ? buildDeliverySlip({
          store: { name: 'Zelo Confeitaria', cnpj: '00.000.000/0001-00', addressLine: 'Rua X, 10', city: 'Pereiro', state: 'CE', phoneE164: '(85) 90000-0000' },
          ...kitchen,
          paymentMethod: 'cash', paymentStatus: 'pending', needsChange: true, changeForAmountCents: 10000,
          subtotalCents: 9000, deliveryFeeCents: 500, totalCents: 9500,
        })
      : buildKitchenTicket(kitchen);

// --- interpretador de ESC/POS ---
const W = 512;
const rows = [];
const images = [];
let align = 'left';
let bold = false;
let dw = 1;
let dh = 1;
let buf = [];
let y = 8;

const BASE = 22;

function flush() {
  const text = Buffer.from(buf).toString('latin1');
  buf = [];
  if (text) rows.push({ type: 'text', text, align, bold, dw, dh, y });
  y += (text ? BASE * dh : BASE) + 8;
}

for (let i = 0; i < bytes.length; i += 1) {
  const b = bytes[i];
  const n = bytes[i + 1];
  if (b === 0x1b && n === 0x40) { i += 1; continue; }
  if (b === 0x1b && n === 0x74) { i += 2; continue; }
  if (b === 0x1b && n === 0x61) { flush(); align = ['left', 'center', 'right'][bytes[i + 2]]; i += 2; continue; }
  if (b === 0x1b && n === 0x45) { flush(); bold = !!bytes[i + 2]; i += 2; continue; }
  if (b === 0x1d && n === 0x21) { flush(); const m = bytes[i + 2]; dw = (m >> 4) + 1; dh = (m & 0x0f) + 1; i += 2; continue; }
  if (b === 0x1b && n === 0x64) { flush(); y += 16 * bytes[i + 2]; i += 2; continue; }
  if (b === 0x1d && n === 0x56) { flush(); rows.push({ type: 'cut', y: y + 4 }); y += 16; i += 2; continue; }
  if (b === 0x1d && n === 0x76 && bytes[i + 2] === 0x30) {
    flush();
    const wb = bytes[i + 4] | (bytes[i + 5] << 8);
    const h = bytes[i + 6] | (bytes[i + 7] << 8);
    const start = i + 8;
    images.push({ wb, h, raster: bytes.slice(start, start + wb * h), y });
    y += h + 10;
    i = start + wb * h - 1;
    continue;
  }
  if (b === 0x0a) { flush(); continue; }
  buf.push(b);
}
flush();

const H = y + 24;
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
for (const r of rows) {
  if (r.type === 'cut') {
    svg += `<line x1="0" y1="${r.y}" x2="${W}" y2="${r.y}" stroke="#c00" stroke-dasharray="6 5"/>`;
    continue;
  }
  const anchor = r.align === 'center' ? 'middle' : r.align === 'right' ? 'end' : 'start';
  const x = r.align === 'center' ? W / 2 : r.align === 'right' ? W - 8 : 8;
  // Largura de glyph fixa (~13px). dw estica na horizontal, dh na vertical —
  // igual ao printer, que NÃO alarga em double-height.
  const baseline = r.y + BASE;
  const sx = r.dw;
  const sy = r.dh;
  svg += `<text x="${x / sx}" y="${baseline / sy}" transform="scale(${sx} ${sy})" font-family="'DejaVu Sans Mono',monospace" font-size="${BASE}" font-weight="${r.bold ? 'bold' : 'normal'}" text-anchor="${anchor}">${escape(r.text)}</text>`;
}
svg = Buffer.from(`${svg}</svg>`);

const layers = [{ input: svg, top: 0, left: 0 }];
for (const im of images) {
  const w = im.wb * 8;
  const px = Buffer.alloc(w * im.h);
  for (let yy = 0; yy < im.h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const bit = (im.raster[yy * im.wb + (xx >> 3)] >> (7 - (xx & 7))) & 1;
      px[yy * w + xx] = bit ? 0 : 255;
    }
  }
  layers.push({
    input: await sharp(px, { raw: { width: w, height: im.h, channels: 1 } }).png().toBuffer(),
    top: Math.round(im.y),
    left: Math.round((W - w) / 2),
  });
}

const out = path.resolve(`receipt-preview-${which}.png`);
await sharp({ create: { width: W, height: H, channels: 3, background: '#fff' } })
  .composite(layers)
  .png()
  .toFile(out);
console.log(out, `${W}x${H}`);
