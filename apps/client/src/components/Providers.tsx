'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { config as configureZod } from 'zod';

// A CSP de produção bloqueia `eval`/`new Function`. Sem isso, o Zod ainda
// funciona (ele mesmo captura a falha e cai no caminho interpretado), mas a
// sondagem `new Function("")` do fast-path dispara um report de violação de
// CSP mesmo assim — `jitless` desliga a sondagem na raiz.
configureZod({ jitless: true });
import { AuthProvider } from '@/contexts/AuthContext';
import { CheckoutProvider } from '@/contexts/CheckoutContext';
import { ShopExperienceProvider } from '@/contexts/ShopExperienceContext';
import { AppDialogProvider } from '@/contexts/AppDialogContext';
import { CartSync } from '@/modules/carts/CartSync';
import DesktopNavigation from '@/components/DesktopNavigation';
import MobileBottomNav from '@/components/MobileBottomNav';
import { PwaInstallProvider } from '@/contexts/PwaInstallContext';
import LockMobileZoom from '@/components/LockMobileZoom';
import { shouldHideCustomerNav } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // `/admin/*` cai em `shouldHideCustomerNav` e traz o próprio layout
  // (navbar + padding) em `src/app/admin/layout.tsx`.
  const hideCustomerNav = shouldHideCustomerNav(pathname);

  return (
    <>
      <DesktopNavigation />
      {/* Documento rola normalmente; padding só p/ o conteúdo não ficar sob
          a navbar flutuante do mobile. */}
      <div
        className={cn(
          'lg:min-h-dvh',
          // Folga p/ a navbar flutuante + a área segura inferior (home
          // indicator no iPhone), pra o último item passar todo acima dela.
          !hideCustomerNav &&
            'max-lg:pb-[calc(84px+env(safe-area-inset-bottom,0px))]',
        )}
      >
        {children}
      </div>
      <MobileBottomNav />
    </>
  );
}

function ClientObservability() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    // Carrega o SDK sob demanda: ~25 KB fora do first load de todo cliente.
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({
        dsn,
        enabled: true,
        environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
      });
    });
  }, []);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ShopExperienceProvider>
          <AppDialogProvider>
            <CheckoutProvider>
              <CartSync />
              <PwaInstallProvider>
                <ClientObservability />
                <LockMobileZoom />
                <AppShell>{children}</AppShell>
              </PwaInstallProvider>
            </CheckoutProvider>
          </AppDialogProvider>
        </ShopExperienceProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
