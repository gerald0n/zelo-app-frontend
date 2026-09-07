'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { X } from 'lucide-react';
import { cropImageToFile } from '@/lib/crop-image';

type Props = {
  open: boolean;
  /** Arquivo escolhido no input; o recorte é feito sobre ele. */
  file: File | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
};

/**
 * Modal de recorte 1:1 antes de enviar a imagem de um produto. Segue o padrão
 * do `ProductFormModal` (portal no body, fecha no Esc / clique fora).
 */
export function ImageCropDialog({ open, file, onCancel, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !file) return null;

  return createPortal(
    <CropDialogBody file={file} onCancel={onCancel} onConfirm={onConfirm} />,
    document.body,
  );
}

function CropDialogBody({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (!areaPixels) return;
    setProcessing(true);
    setError('');
    try {
      onConfirm(await cropImageToFile(file, areaPixels));
    } catch (cause) {
      setProcessing(false);
      setError(
        cause instanceof Error ? cause.message : 'Falha ao recortar a imagem.',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recortar imagem"
        className="relative flex w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <p className="font-serif text-base font-bold">Recortar imagem (1:1)</p>

        {/* Container quadrado = área de recorte: com objectFit "cover" o que
            aparece aqui é exatamente o que é salvo (WYSIWYG). O default
            "contain" do react-easy-crop força zoom em fotos retrato e o
            resultado não bate com o enquadramento. */}
        <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-lg bg-muted">
          <Cropper
            image={objectUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            objectFit="cover"
            showGrid={false}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1 accent-primary"
            aria-label="Zoom da imagem"
          />
        </label>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={processing || !areaPixels}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
          >
            {processing ? 'Recortando…' : 'Recortar e enviar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
