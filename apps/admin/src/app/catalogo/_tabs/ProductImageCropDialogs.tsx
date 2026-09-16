'use client';

import type { UseMutationResult } from '@tanstack/react-query';
import { ImageCropDialog } from '@/components/ImageCropDialog';

type CropTarget = { productId: string; file: File } | null;

type UploadMutation = UseMutationResult<
  unknown,
  unknown,
  { productId: string; file: File },
  unknown
>;

type Props = {
  cropTarget: CropTarget;
  onCropTargetChange: (target: CropTarget) => void;
  uploadMutation: UploadMutation;
  previewCropTarget: CropTarget;
  onPreviewCropTargetChange: (target: CropTarget) => void;
  uploadPreviewImageMutation: UploadMutation;
};

/**
 * Os dois modais de recorte 1:1 do catálogo — foto normal e imagem de
 * preview de sabor de pizza — extraídos do `ProductsTab` só pra caber no
 * limite de linhas do lint (`quality/max-lines`). Renderizados depois do
 * `ProductFormModal` no DOM: como os dois usam o mesmo z-index, o portal
 * montado por último fica por cima.
 */
export function ProductImageCropDialogs({
  cropTarget,
  onCropTargetChange,
  uploadMutation,
  previewCropTarget,
  onPreviewCropTargetChange,
  uploadPreviewImageMutation,
}: Props) {
  return (
    <>
      <ImageCropDialog
        open={cropTarget != null}
        file={cropTarget?.file ?? null}
        onCancel={() => onCropTargetChange(null)}
        onConfirm={async (croppedFile) => {
          if (!cropTarget) return;
          // `mutateAsync` só resolve depois do `onSuccess` (invalidateCatalog),
          // então quando fechamos o modal a imagem nova já chegou — nada de
          // "fecha e some, aí de repente troca". Se der erro, rejeita e o
          // próprio modal mostra a mensagem e continua aberto.
          await uploadMutation.mutateAsync({
            productId: cropTarget.productId,
            file: croppedFile,
          });
          onCropTargetChange(null);
        }}
      />

      <ImageCropDialog
        open={previewCropTarget != null}
        file={previewCropTarget?.file ?? null}
        title="Recortar imagem de preview (1:1)"
        onCancel={() => onPreviewCropTargetChange(null)}
        onConfirm={async (croppedFile) => {
          if (!previewCropTarget) return;
          await uploadPreviewImageMutation.mutateAsync({
            productId: previewCropTarget.productId,
            file: croppedFile,
          });
          onPreviewCropTargetChange(null);
        }}
      />
    </>
  );
}
