'use client';

import { use } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { statusLabel } from '@/modules/orders/types';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { useAdminOrderDetail } from '@/app/admin/pedido/[id]/useAdminOrderDetail';
import { OrderDetailMain } from '@/app/admin/pedido/[id]/_components/OrderDetailMain';
import { OrderDetailActions } from '@/app/admin/pedido/[id]/_components/OrderDetailActions';

export default function AdminPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    ready,
    isAuthenticated,
    order,
    loading,
    busy,
    error,
    hasStore,
    printerReady,
    advance,
    cancel,
    retryRefund,
    reprintTicket,
    reprintSlip,
  } = useAdminOrderDetail(id);

  if (!ready || !isAuthenticated || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background lg:pl-52">
        <p>{error ?? 'Pedido não encontrado.'}</p>
        <Link href="/admin/pedidos" className="text-primary">
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader
        title={order.number}
        subtitle={statusLabel(order.status)}
        backTo="/admin/pedidos"
      />
      <div className={cn('p-3 pb-8 md:px-6 md:pt-6', adminContainerClass)}>
        <div className="flex flex-wrap">
          <OrderDetailMain order={order} />
          <OrderDetailActions
            order={order}
            busy={busy}
            error={error}
            hasStore={hasStore}
            printerReady={printerReady}
            onAdvance={() => void advance()}
            onCancel={() => void cancel()}
            onRetryRefund={() => void retryRefund()}
            onReprintTicket={() => void reprintTicket()}
            onReprintSlip={() => void reprintSlip()}
          />
        </div>
      </div>
    </div>
  );
}
