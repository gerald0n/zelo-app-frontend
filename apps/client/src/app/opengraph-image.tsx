import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Imagem de compartilhamento (WhatsApp, redes sociais). Gerada no build a
 * partir do selo da marca — não depende de dados de request, então o Next
 * a otimiza estaticamente.
 */
export const alt = 'Zelo Confeitaria — doces artesanais em Pereiro, CE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// A arte não depende de request; sobrepõe o `force-dynamic` do layout raiz
// para que a imagem seja gerada uma vez no build e servida do cache.
export const dynamic = 'force-static';

const seloData = await readFile(
  join(process.cwd(), 'public/brand/zelo-selo.png'),
  'base64',
);
const seloSrc = `data:image/png;base64,${seloData}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 64,
          padding: '0 96px',
          background:
            'linear-gradient(135deg, #F7F1E6 0%, #F1E6D2 55%, #EAD9C0 100%)',
          color: '#463b33',
        }}
      >
        <img src={seloSrc} width={380} height={380} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              fontSize: 26,
              letterSpacing: 8,
              textTransform: 'uppercase',
              color: '#8a3a48',
            }}
          >
            Confeitaria artesanal
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              marginTop: 18,
              whiteSpace: 'nowrap',
            }}
          >
            Zelo Confeitaria
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.35,
              marginTop: 24,
              color: '#6b5b4d',
            }}
          >
            Cookies, pudins e salgados feitos com carinho em Pereiro, CE.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
