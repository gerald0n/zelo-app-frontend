'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { shouldHideCustomerNav } from '@/lib/layout';
import { cn } from '@/lib/cn';

const PRIMARY_ROUTES = [
  { label: 'Cardápio', href: '/', match: '/' },
  { label: 'Pedidos', href: '/pedidos', match: '/pedidos' },
  { label: 'Conta', href: '/conta', match: '/conta' },
];

export default function DesktopNavigation() {
  const { totalItems } = useCart();
  const pathname = usePathname();

  // Visibilidade só por CSS (`lg:flex`): renderizar/ocultar via JS fazia o
  // primeiro paint sair sem a barra e "pular" depois de montar.
  if (shouldHideCustomerNav(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-[100] hidden h-14 items-center justify-between border-b border-border bg-background px-6 lg:flex">
      <Link href="/" className="flex items-baseline gap-[7px]">
        <span className="font-serif text-2xl font-semibold tracking-tight">
          Zelo
        </span>
        <span className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
          Confeitaria
        </span>
      </Link>
      <nav className="flex items-center gap-[5px]">
        {PRIMARY_ROUTES.map((item) => {
          const active = pathname === item.match;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-semibold',
                active ? 'bg-muted text-primary' : 'text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/carrinho"
          className="ml-[5px] flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold"
        >
          <ShoppingBag className="size-[18px]" />
          Carrinho
          {totalItems > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-[5px] text-2xs font-bold text-primary-foreground">
              {totalItems}
            </span>
          ) : null}
        </Link>
      </nav>
    </header>
  );
}
