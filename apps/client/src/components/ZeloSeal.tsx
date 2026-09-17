'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Selo da marca — `logoUrl` do tenant (`stores.logo_url`, ADR-0001 Fase D)
 * quando a loja define um, senão o selo fixo da Zelo
 * (`public/brand/zelo-selo.png`).
 *
 * Se a imagem não carregar (arquivo ainda não adicionado, `logo_url`
 * quebrado, rede etc.), cai na inicial do nome da loja serifada sobre a cor
 * primária — o mesmo desenho do ícone de fallback do PWA (que, para a Zelo,
 * é "Z").
 */
export function ZeloSeal({
  className,
  fallbackClassName,
  letterClassName,
  logoUrl,
  alt = 'Zelo Confeitaria',
  fallbackLetter = 'Z',
}: {
  className?: string;
  /** Classe do bloco de fallback (formato/raio). Default: mesmo `className`. */
  fallbackClassName?: string;
  letterClassName?: string;
  /** `stores.logo_url` do tenant atual. `null`/ausente = selo fixo da Zelo. */
  logoUrl?: string | null;
  alt?: string;
  fallbackLetter?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl ?? '/brand/zelo-selo.png';

  if (failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-primary text-primary-foreground',
          fallbackClassName ?? className,
        )}
      >
        <span className={cn('font-serif font-semibold', letterClassName)}>
          {fallbackLetter}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn('shrink-0 object-contain', className)}
      onError={() => setFailed(true)}
    />
  );
}
