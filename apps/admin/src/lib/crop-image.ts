import type { Area } from 'react-easy-crop';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () =>
      reject(new Error('Não foi possível carregar a imagem.')),
    );
    image.src = src;
  });
}

/**
 * Recorta `file` na área `areaPixels` (em pixels reais da imagem, vinda do
 * `onCropComplete` do react-easy-crop) e devolve um `File` novo. O container
 * exibe a proporção desejada (1:1 pra produto, wide pra banner), então a área
 * já chega no formato certo; aqui só materializamos o corte.
 */
export async function cropImageToFile(
  file: File,
  areaPixels: Area,
  { type = 'image/webp', suffix = '' }: { type?: string; suffix?: string } = {},
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);

    // A área do react-easy-crop já vem na proporção configurada no Cropper;
    // só travamos o recorte dentro dos limites reais da imagem pra o browser
    // não esticar nada.
    const width = Math.round(areaPixels.width);
    const height = Math.round(areaPixels.height);
    const sx = Math.max(
      0,
      Math.min(Math.round(areaPixels.x), image.naturalWidth - width),
    );
    const sy = Math.max(
      0,
      Math.min(Math.round(areaPixels.y), image.naturalHeight - height),
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível neste navegador.');

    ctx.drawImage(image, sx, sy, width, height, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, 0.9);
    });
    if (!blob) throw new Error('Falha ao gerar a imagem recortada.');

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem';
    const extension = type === 'image/png' ? 'png' : 'webp';
    return new File([blob], `${baseName}${suffix}.${extension}`, {
      type: blob.type || type,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
