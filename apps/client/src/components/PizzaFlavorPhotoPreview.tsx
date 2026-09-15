'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { productImagePublicUrl } from '@/lib/constants';

type Props = {
  name: string;
  image: string;
  onClose: () => void;
};

/**
 * Foto do sabor em tela cheia — aberta ao tocar na thumbnail dentro de
 * `PizzaFlavorGrid`. z-index acima do `PizzaSlotModal` (1200) que a contém.
 */
export function PizzaFlavorPhotoPreview({ name, image, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-foreground/80"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 rounded-full bg-black/40 p-2 text-white"
      >
        <X className="size-5" />
      </button>
      <div className="relative flex max-h-full max-w-full flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImagePublicUrl(image, { width: 1000, height: 1000 })}
          alt={name}
          className="max-h-[70dvh] max-w-full rounded-2xl object-contain"
        />
        <p className="text-sm font-semibold text-white">{name}</p>
      </div>
    </div>
  );
}
