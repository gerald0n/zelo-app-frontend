'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Selo da marca Zelo (`public/brand/zelo-selo.png`).
 *
 * Se a imagem não carregar (arquivo ainda não adicionado, rede etc.), cai no
 * "Z" serifado sobre vinho — o mesmo desenho do ícone de fallback do PWA.
 */
export function ZeloSeal({
  className,
  fallbackClassName,
  letterClassName,
}: {
  className?: string;
  /** Classe do bloco de fallback (formato/raio). Default: mesmo `className`. */
  fallbackClassName?: string;
  letterClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-primary text-primary-foreground',
          fallbackClassName ?? className,
        )}
      >
        <span className={cn('font-serif font-semibold', letterClassName)}>
          Z
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/zelo-selo.png"
      alt="Zelo Confeitaria"
      className={cn('shrink-0 object-contain', className)}
      onError={() => setFailed(true)}
    />
  );
}
