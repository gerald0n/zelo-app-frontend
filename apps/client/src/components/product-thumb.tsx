import { Cookie, CakeSlice, Croissant } from 'lucide-react';
import { productImagePublicUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';

const toneMap = {
  cookie: {
    bg: 'bg-caramel/35',
    fg: 'text-caramel-foreground/70',
    Icon: Cookie,
  },
  pudim: {
    bg: 'bg-primary/12',
    fg: 'text-primary/60',
    Icon: CakeSlice,
  },
  salgado: {
    bg: 'bg-pistachio/40',
    fg: 'text-pistachio-foreground/70',
    Icon: Croissant,
  },
} as const;

export function ProductThumb({
  tone,
  categoryId,
  className,
  iconClassName,
  src,
  alt,
  width = 640,
}: {
  tone?: 'cookie' | 'pudim' | 'salgado';
  categoryId?: string;
  className?: string;
  iconClassName?: string;
  src?: string | null;
  alt?: string | null;
  /** Largura-alvo para a transformação de imagem (produção). */
  width?: number;
}) {
  const resolvedTone =
    tone ??
    (categoryId === 'cookies'
      ? 'cookie'
      : categoryId === 'pudins'
        ? 'pudim'
        : 'salgado');
  const { bg, fg, Icon } = toneMap[resolvedTone];
  const imageUrl = src ? productImagePublicUrl(src, { width }) : null;

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden',
        bg,
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt ?? ''}
          className="size-full object-cover"
        />
      ) : (
        <Icon
          className={cn('opacity-80', fg, iconClassName)}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
