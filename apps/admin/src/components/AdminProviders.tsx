'use client';

import { useEffect } from 'react';
import { config as configureZod } from 'zod';

// A CSP de produção bloqueia `eval`/`new Function`. `jitless` desliga a
// sondagem `new Function("")` do fast-path do Zod (que dispara um report de
// violação de CSP mesmo caindo no caminho interpretado).
configureZod({ jitless: true });

import { AdminProvider } from '@/contexts/AdminContext';
import { AdminRealtimeProvider } from '@/contexts/AdminRealtimeContext';
import { AdminNewOrderProvider } from '@/contexts/AdminNewOrderContext';
import { PrinterProvider } from '@/contexts/PrinterContext';
import { AppDialogProvider } from '@/contexts/AppDialogContext';
import { QueryProvider } from '@/providers/query-provider';
import { ApiErrorToaster } from '@/components/ApiErrorToaster';
import AdminShell from '@/components/admin/AdminShell';

function AdminObservability() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
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

/**
 * Providers do painel administrativo. `AdminShell` traz a sidebar/bottom-nav
 * (a tela de login não tem chrome — ver `AdminShell`).
 */
export default function AdminProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <AppDialogProvider>
        <AdminProvider>
          <PrinterProvider>
            <AdminRealtimeProvider>
              <AdminNewOrderProvider>
                <AdminObservability />
                <ApiErrorToaster />
                <AdminShell>{children}</AdminShell>
              </AdminNewOrderProvider>
            </AdminRealtimeProvider>
          </PrinterProvider>
        </AdminProvider>
      </AppDialogProvider>
    </QueryProvider>
  );
}
