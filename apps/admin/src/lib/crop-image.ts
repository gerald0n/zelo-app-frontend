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
 * `onCropComplete` do react-easy-crop) e devolve um `File` novo. O container do
 * card exibe 1:1, então a área já chega quadrada; aqui só materializamos o corte.
 */
export async function cropImageToFile(
  file: File,
  areaPixels: Area,
  { type = 'image/webp' }: { type?: string } = {},
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);

    // O card exibe 1:1, então o output tem que ser um quadrado exato. A área do
    // react-easy-crop já chega ~quadrada; forçamos um único lado e travamos o
    // recorte dentro dos limites reais da imagem pra o browser não esticar nada.
    const side = Math.round(Math.min(areaPixels.width, areaPixels.height));
    const sx = Math.max(
      0,
      Math.min(Math.round(areaPixels.x), image.naturalWidth - side),
    );
    const sy = Math.max(
      0,
      Math.min(Math.round(areaPixels.y), image.naturalHeight - side),
    );

    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível neste navegador.');

    ctx.drawImage(image, sx, sy, side, side, 0, 0, side, side);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, 0.9);
    });
    if (!blob) throw new Error('Falha ao gerar a imagem recortada.');

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem';
    const extension = type === 'image/png' ? 'png' : 'webp';
    return new File([blob], `${baseName}-1x1.${extension}`, {
      type: blob.type || type,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
