'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Loader2, X } from 'lucide-react';
import { cropImageToFile } from '@/lib/crop-image';

type Props = {
  open: boolean;
  /** Arquivo escolhido no input; o recorte é feito sobre ele. */
  file: File | null;
  onCancel: () => void;
  /**
   * Recebe o arquivo já recortado 1:1. Pode devolver uma Promise (o upload):
   * enquanto ela não resolve o modal fica travado em "Enviando…". Ao resolver,
   * quem fecha o modal é o pai; se rejeitar, o erro aparece aqui e o modal fica.
   */
  onConfirm: (croppedFile: File) => void | Promise<void>;
};

/**
 * Modal de recorte 1:1 antes de enviar a imagem de um produto. Segue o padrão
 * do `ProductFormModal` (portal no body, fecha no Esc / clique fora).
 */
export function ImageCropDialog({ open, file, onCancel, onConfirm }: Props) {
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
  onConfirm: (croppedFile: File) => void | Promise<void>;
}) {
  // O object URL precisa nascer e morrer dentro do mesmo effect: assim, no
  // ciclo mount→cleanup→mount do StrictMode, o segundo mount recria a URL em
  // vez de reaproveitar uma já revogada (o que deixava o <img> do cropper 404).
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o ciclo de vida de um recurso externo (blob URL)
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  // null = ocioso; enquanto tiver fase, o modal está travado e não fecha.
  const [phase, setPhase] = useState<'cropping' | 'uploading' | null>(null);
  const [error, setError] = useState('');
  const busy = phase !== null;

  // Esc só fecha quando não há upload em andamento (não dá pra abortar no meio).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const dismiss = () => {
    if (!busy) onCancel();
  };

  const confirm = async () => {
    if (!areaPixels || busy) return;
    setError('');
    try {
      setPhase('cropping');
      const cropped = await cropImageToFile(file, areaPixels);
      setPhase('uploading');
      await onConfirm(cropped);
      // Sucesso: o pai desmonta o modal. Mantemos `phase` pra não piscar o
      // botão de volta pra "Recortar e enviar" no frame antes de fechar.
    } catch (cause) {
      setPhase(null);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Falha ao enviar a imagem. Tente de novo.',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        aria-label="Recortar imagem"
        className="relative flex w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <X className="size-5" />
        </button>

        <p className="font-serif text-base font-bold">Recortar imagem (1:1)</p>

        {/* Container quadrado = área de recorte: com objectFit "cover" o que
            aparece aqui é exatamente o que é salvo (WYSIWYG). O default
            "contain" do react-easy-crop força zoom em fotos retrato e o
            resultado não bate com o enquadramento. */}
        <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-lg bg-muted">
          {objectUrl ? (
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
              /* onCropAreaChange (não onCropComplete): dispara a cada frame,
               inclusive no re-render final depois do mouseup, então
               `areaPixels` sempre reflete o enquadramento exato que ficou
               na tela. O onCropComplete pode chegar com o `crop` anterior. */
              onCropAreaChange={(_area, pixels) => setAreaPixels(pixels)}
            />
          ) : null}

          {busy ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs font-semibold text-foreground">
                {phase === 'uploading' ? 'Enviando imagem…' : 'Recortando…'}
              </span>
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            disabled={busy}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1 accent-primary disabled:opacity-50"
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
            disabled={busy || !areaPixels}
            className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {phase === 'uploading' ? 'Enviando…' : 'Recortando…'}
              </>
            ) : (
              'Recortar e enviar'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
