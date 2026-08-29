'use client';

import { usePathname } from 'next/navigation';
import { UtensilsCrossed, ReceiptText, User } from 'lucide-react';
import LiquidGlassTabs from '@/components/LiquidGlassTabs';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { shouldHideCustomerMobileNav } from '@/lib/layout';

const TABS = [
  {
    href: '/',
    label: 'Cardápio',
    icon: UtensilsCrossed,
    match: (p: string) => p === '/',
  },
  {
    href: '/pedidos',
    label: 'Pedidos',
    icon: ReceiptText,
    match: (p: string) => p.startsWith('/pedidos'),
  },
  {
    href: '/conta',
    label: 'Conta',
    icon: User,
    match: (p: string) => p.startsWith('/conta'),
  },
];

export default function MobileBottomNav() {
  const { isDesktop } = useResponsiveLayout();
  const pathname = usePathname();

  if (isDesktop || shouldHideCustomerMobileNav(pathname)) {
    return null;
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:hidden"
    >
      <div
        aria-hidden
        className="liquid-glass-veil absolute inset-x-0 bottom-0 h-24"
      />
      <div className="pointer-events-auto relative px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        <div className="mx-auto max-w-[340px]">
          <LiquidGlassTabs tabs={TABS} pathname={pathname} />
        </div>
      </div>
    </nav>
  );
}
