import { useState } from 'react';
import { ArrowRight, CalendarClock, Check, Copy, Loader2, Printer } from 'lucide-react';
import { statusLabel } from '@/modules/orders/types';
import { nextAdminStatus, type AdminOrderDetail } from '@/modules/admin/types';
import { buildOrderSummaryText } from '@/lib/admin/order-summary';

type Props = {
  order: AdminOrderDetail;
  busy: boolean;
  printerReady: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onReprintTicket: () => void;
  onReschedule: () => void;
  onClose: () => void;
};

/** Barra de ações fixa no rodapé do modal de detalhes do pedido. */
export function OrderDetailModalFooter({
  order,
  busy,
  printerReady,
  onAdvance,
  onCancel,
  onReprintTicket,
  onReschedule,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const next = nextAdminStatus(order.status, order.deliveryMethod);
  const terminal = order.status === 'delivered' || order.status === 'cancelled';

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildOrderSummaryText(order));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard — nada a fazer além de deixar o botão mudo.
    }
  };

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReprintTicket}
          disabled={!printerReady}
          title={
            printerReady
              ? undefined
              : 'Impressora não pareada — pareie em Configurações'
          }
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Printer className="size-3.5" />
          Imprimir comanda
        </button>
        <button
          type="button"
          onClick={() => void copySummary()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado!' : 'Copiar resumo'}
        </button>
        {order.canReschedule ? (
          <button
            type="button"
            disabled={busy}
            onClick={onReschedule}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            <CalendarClock className="size-3.5" />
            Reagendar
          </button>
        ) : null}
        {!terminal ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {order.status === 'received' ? 'Recusar' : 'Cancelar'}
          </button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
        >
          Fechar
        </button>
        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAdvance}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowRight className="size-3.5" />
            )}
            Avançar para {statusLabel(next)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
