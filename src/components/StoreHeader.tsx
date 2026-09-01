'use client';

import Link from 'next/link';
import { Info, Search, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useStoreOpen } from '@/hooks/useStoreOpen';
import { cn } from '@/lib/utils';

/**
 * Barra da loja — conteúdo da camada de vidro fixa no topo do cardápio
 * (a moldura de vidro + a faixa de categorias vivem em HomeCatalog).
 * Só marca, status e ações; horário e regras ficam no cartão de aviso do scroll.
 */
export default function StoreHeader() {
  const storeOpen = useStoreOpen();
  const { totalItems } = useCart();

  return (
    <div className="flex items-center justify-between gap-2.5 px-4 pb-2 pt-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/loja" className="min-w-0 leading-none">
          <span className="block font-serif text-xl font-semibold tracking-tight text-foreground">
            Zelo
          </span>
          <span className="mt-0.5 block text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Confeitaria
          </span>
        </Link>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold',
            storeOpen ? 'bg-success/15 text-success' : 'bg-primary/12 text-primary',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              storeOpen ? 'bg-success' : 'bg-primary',
            )}
            aria-hidden="true"
          />
          {storeOpen ? 'Aberto' : 'Fechado'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <HeaderAction href="/busca" label="Buscar no cardápio">
          <Search className="size-4" aria-hidden="true" />
        </HeaderAction>
        <HeaderAction href="/loja" label="Informações da loja">
          <Info className="size-4" aria-hidden="true" />
        </HeaderAction>
        <HeaderAction
          href="/carrinho"
          label={totalItems > 0 ? `Sacola, ${totalItems} itens` : 'Sacola'}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          {totalItems > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
              {totalItems}
            </span>
          ) : null}
        </HeaderAction>
      </div>
    </div>
  );
}

function HeaderAction({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex size-9 items-center justify-center rounded-full bg-card/55 text-foreground transition-transform duration-100 active:scale-95"
    >
      {children}
    </Link>
  );
}
