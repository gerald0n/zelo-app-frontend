'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useAdminOrderDetail } from '@/app/pedido/[id]/useAdminOrderDetail';
import OrderDetailModalBody from '@/components/admin/kanban/OrderDetailModalBody';

type Props = { orderId: string | null; onClose: () => void };

/**
 * Detalhes do pedido num modal — clicar num card do quadro abre aqui em vez
 * de navegar. Reaproveita `useAdminOrderDetail` (mesma busca e ações da
 * página `/pedido/[id]`, que segue existindo para deep-link).
 */
export default function AdminOrderDetailModal({ orderId, onClose }: Props) {
  const detail = useAdminOrderDetail(orderId);
  const { order, loading, error, busy, printerReady } = detail;

  useEffect(() => {
    if (orderId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orderId, onClose]);

  if (orderId === null) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {loading || (!order && !error) ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error && !order ? (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
        ) : order ? (
          <OrderDetailModalBody
            order={order}
            busy={busy}
            error={error}
            printerReady={printerReady}
            onAdvance={() => void detail.advance()}
            onCancel={() => void detail.cancel()}
            onReprintTicket={() => void detail.reprintTicket()}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
