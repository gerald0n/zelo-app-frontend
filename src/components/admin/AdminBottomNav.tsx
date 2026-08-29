'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid2x2, Receipt, UtensilsCrossed, Settings } from 'lucide-react';
import LiquidGlassTabs from '@/components/LiquidGlassTabs';
import { cn } from '@/lib/cn';

const TABS = [
  {
    href: '/admin',
    label: 'Visão geral',
    icon: Grid2x2,
    match: (p: string) => p === '/admin',
  },
  {
    href: '/admin/pedidos',
    label: 'Pedidos',
    icon: Receipt,
    match: (p: string) =>
      p.startsWith('/admin/pedidos') || p.startsWith('/admin/pedido'),
  },
  {
    href: '/admin/catalogo',
    label: 'Catálogo',
    icon: UtensilsCrossed,
    match: (p: string) => p.startsWith('/admin/catalogo'),
  },
  {
    href: '/admin/configuracoes',
    label: 'Ajustes',
    icon: Settings,
    match: (p: string) => p.startsWith('/admin/configuracoes'),
  },
];

export default function AdminBottomNav() {
  const pathname = usePathname();

  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return null;
  }

  return (
    <>
      <nav
        aria-label="Navegação administrativa"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:hidden"
      >
        <div
          aria-hidden
          className="liquid-glass-veil absolute inset-x-0 bottom-0 h-24"
        />
        <div className="pointer-events-auto relative px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
          <div className="mx-auto max-w-[400px]">
            <LiquidGlassTabs
              tabs={TABS}
              pathname={pathname}
              className="gap-0.5"
              itemClassName="rounded-[1.35rem] px-1 py-2"
              labelClassName="max-w-full truncate text-2xs"
            />
          </div>
        </div>
      </nav>

      <nav className="fixed bottom-0 left-0 top-0 z-50 hidden w-52 flex-col border-r border-border bg-background pt-14 lg:flex">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2.5',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className="size-[21px]"
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className="text-sm font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
