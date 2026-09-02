'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import { CheckoutProvider } from '@/contexts/CheckoutContext';
import { ShopExperienceProvider } from '@/contexts/ShopExperienceContext';
import { AppDialogProvider } from '@/contexts/AppDialogContext';
import { AdminProvider } from '@/contexts/AdminContext';
import { CartSync } from '@/modules/carts/CartSync';
import DesktopNavigation from '@/components/DesktopNavigation';
import MobileBottomNav from '@/components/MobileBottomNav';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { PwaInstallProvider } from '@/contexts/PwaInstallContext';
import LockMobileZoom from '@/components/LockMobileZoom';
import { shouldHideCustomerMobileNav } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const isAdminLogin = pathname === '/admin/login';
  const hideCustomerNav = shouldHideCustomerMobileNav(pathname);

  return (
    <>
      <DesktopNavigation />
      {/* Documento rola normalmente; padding só p/ o conteúdo não ficar sob
          a navbar flutuante do mobile. */}
      <div
        className={cn(
          'lg:min-h-dvh',
          !hideCustomerNav && 'max-lg:pb-[84px]',
          isAdmin && !isAdminLogin && 'max-lg:pb-[84px] lg:pb-0',
        )}
      >
        {children}
      </div>
      <MobileBottomNav />
      <AdminBottomNav />
    </>
  );
}

function ClientObservability() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
      dsn,
      enabled: true,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
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
            <AdminProvider>
              <CheckoutProvider>
                <CartSync />
                <PwaInstallProvider>
                  <ClientObservability />
                  <LockMobileZoom />
                  <AppShell>{children}</AppShell>
                </PwaInstallProvider>
              </CheckoutProvider>
            </AdminProvider>
          </AppDialogProvider>
        </ShopExperienceProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
