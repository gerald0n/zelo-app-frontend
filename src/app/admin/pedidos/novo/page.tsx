'use client';

import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { NewOrderForm } from '@/app/admin/pedidos/novo/NewOrderForm';

/**
 * Rota da nova comanda — mantida para deep-link. No fluxo normal a "Nova
 * comanda" abre num modal (ver `AdminNewOrderContext`).
 */
export default function AdminNovaComandaPage() {
  const router = useRouter();
  const { isAuthenticated, ready } = useRequireAdmin();

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn('min-h-dvh p-3 pb-24 md:px-6 md:pt-6', adminContainerClass)}
    >
      <div className="rounded-xl border border-border bg-card">
        <NewOrderForm
          onCreated={(orderId) => router.push(`/admin/pedido/${orderId}`)}
          onCancel={() => router.push('/admin/pedidos')}
        />
      </div>
    </div>
  );
}
