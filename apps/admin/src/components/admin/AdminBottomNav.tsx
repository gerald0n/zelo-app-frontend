'use client';

import { usePathname } from 'next/navigation';
import {
  Grid2x2,
  Receipt,
  UtensilsCrossed,
  BarChart3,
  Star,
  Settings,
} from 'lucide-react';
import LiquidGlassTabs from '@/components/LiquidGlassTabs';

const TABS = [
  {
    href: '/',
    label: 'Visão geral',
    icon: Grid2x2,
    match: (p: string) => p === '/',
  },
  {
    href: '/pedidos',
    label: 'Pedidos',
    icon: Receipt,
    match: (p: string) =>
      p.startsWith('/pedidos') || p.startsWith('/pedido'),
  },
  {
    href: '/catalogo',
    label: 'Catálogo',
    icon: UtensilsCrossed,
    match: (p: string) => p.startsWith('/catalogo'),
  },
  {
    href: '/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    match: (p: string) => p.startsWith('/relatorios'),
  },
  {
    href: '/avaliacoes',
    label: 'Avaliações',
    icon: Star,
    match: (p: string) => p.startsWith('/avaliacoes'),
  },
  {
    href: '/configuracoes',
    label: 'Ajustes',
    icon: Settings,
    match: (p: string) => p.startsWith('/configuracoes'),
  },
];

/**
 * Navegação do painel no mobile — barra flutuante inferior. No desktop a
 * navegação vive na `AdminSidebar`.
 */
export default function AdminBottomNav() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  return (
    <nav
      aria-label="Navegação administrativa"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:hidden"
    >
      <div
        aria-hidden
        className="liquid-glass-veil absolute inset-x-0 bottom-0 h-24"
      />
      <div className="pointer-events-auto relative px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        <div className="mx-auto max-w-[440px]">
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
  );
}
