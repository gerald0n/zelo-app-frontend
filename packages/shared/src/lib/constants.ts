export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

type ImageTransform = { width?: number; height?: number; quality?: number };

/**
 * URL pública de uma imagem de produto.
 *
 * Com `transform` e em produção, usa o endpoint de transformação do Supabase
 * (recurso do plano Pro) para servir uma versão redimensionada — normalmente
 * já em WebP, decidido pelo `Accept` do navegador. Em local/preview (Free) o
 * endpoint de transformação não existe, então cai no objeto original.
 */
const OBJECT_MARKER = '/storage/v1/object/public/product-images/';
const RENDER_MARKER = '/storage/v1/render/image/public/product-images/';

export function productImagePublicUrl(
  storagePath: string,
  transform?: ImageTransform,
): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) return storagePath;

  // Aceita o storage_path cru ou uma URL já montada (object/render) — assim
  // dá pra pedir uma transformação diferente sobre uma URL que já veio pronta.
  let path = storagePath;
  if (path.includes(OBJECT_MARKER)) {
    path = path.split(OBJECT_MARKER)[1];
  } else if (path.includes(RENDER_MARKER)) {
    path = path.split(RENDER_MARKER)[1];
  } else if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  path = path.split('?')[0].replace(/^\//, '');

  const canRender =
    process.env.NEXT_PUBLIC_APP_ENV === 'production' &&
    !!transform &&
    (!!transform.width || !!transform.height);

  if (canRender) {
    const params = new URLSearchParams();
    if (transform.width) params.set('width', String(transform.width));
    if (transform.height) params.set('height', String(transform.height));
    params.set('quality', String(transform.quality ?? 70));
    params.set('resize', 'cover');
    return `${base}/storage/v1/render/image/public/product-images/${path}?${params.toString()}`;
  }

  return `${base}/storage/v1/object/public/product-images/${path}`;
}
