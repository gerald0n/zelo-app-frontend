'use client';

import Link from 'next/link';
import { Clock, Info, MapPin, ShoppingBag } from 'lucide-react';
import { ZeloSeal } from '@/components/ZeloSeal';
import { cn } from '@/lib/utils';

export function HeroContent({
  expanded,
  storeOpen,
  hoursLabel,
  totalItems,
}: {
  expanded: boolean;
  storeOpen: boolean;
  hoursLabel: string;
  totalItems: number;
}) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <ZeloSeal
          className={expanded ? 'size-11' : 'size-8'}
          fallbackClassName={cn(
            expanded ? 'size-11 rounded-xl' : 'size-8 rounded-lg',
          )}
          letterClassName={expanded ? 'text-xl' : 'text-base'}
        />

        <div className="min-w-0 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1
              className={cn(
                'font-serif font-semibold leading-none text-foreground',
                expanded ? 'text-lg' : 'text-sm',
              )}
            >
              {expanded ? 'Zelo Confeitaria' : 'Zelo'}
            </h1>
            <StatusBadge storeOpen={storeOpen} compact={!expanded} />
          </div>

          <p
            className={cn(
              'flex items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground',
              expanded ? 'mt-1 text-xs' : 'mt-0.5 text-2xs',
            )}
          >
            <MapPin
              className={cn('shrink-0', expanded ? 'size-3' : 'size-2.5')}
              aria-hidden="true"
            />
            <span className="shrink-0">Pereiro, CE</span>
            {expanded ? (
              <>
                <span
                  className="shrink-0 text-muted-foreground/50"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span className="truncate">Entrega e retirada</span>
              </>
            ) : null}
          </p>

          {expanded ? (
            <div className="mt-1.5">
              <p className="text-xs leading-snug text-muted-foreground">
                Cookies, pudins e salgados artesanais
              </p>
              <p className="mt-1 flex items-center gap-1.5 overflow-hidden text-2xs font-medium whitespace-nowrap text-foreground/80">
                <Clock className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{hoursLabel}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <HeaderActions expanded={expanded} totalItems={totalItems} />
    </div>
  );
}

function StatusBadge({
  storeOpen,
  compact,
}: {
  storeOpen: boolean;
  compact: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        storeOpen
          ? 'bg-pistachio/60 text-pistachio-foreground'
          : 'bg-destructive/15 text-destructive',
        compact ? 'px-1.5 py-0.5 text-2xs' : 'px-1.5 py-0.5 text-2xs',
      )}
    >
      <span
        className={cn(
          'rounded-full',
          storeOpen ? 'bg-pistachio-foreground' : 'bg-destructive',
          compact ? 'size-1' : 'size-1.5',
        )}
      />
      {storeOpen ? 'Aberto agora' : 'Fechado'}
    </span>
  );
}

function HeaderActions({
  expanded,
  totalItems,
}: {
  expanded: boolean;
  totalItems: number;
}) {
  const iconBtn = expanded ? 'size-9' : 'size-8';
  const iconSize = expanded ? 'size-4' : 'size-3.5';

  return (
    <div
      className={cn('flex shrink-0 items-center gap-1.5', expanded && 'mt-0.5')}
    >
      <Link
        href="/loja"
        aria-label="Informações da loja"
        className={cn(
          'flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-accent',
          iconBtn,
        )}
      >
        <Info className={iconSize} />
      </Link>
      <Link
        href="/carrinho"
        aria-label={totalItems > 0 ? `Sacola, ${totalItems} itens` : 'Sacola'}
        className={cn(
          'relative flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-accent',
          iconBtn,
        )}
      >
        <ShoppingBag className={iconSize} />
        {totalItems > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
            {totalItems}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
