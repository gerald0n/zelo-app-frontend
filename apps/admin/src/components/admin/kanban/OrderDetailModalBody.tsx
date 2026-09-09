import type { ReactNode } from 'react';
import { ArrowRight, Loader2, Printer, X } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { statusLabel } from '@/modules/orders/types';
import { nextAdminStatus, type AdminOrderDetail } from '@/modules/admin/types';
import OrderTimeline, { clock } from '@/components/admin/kanban/OrderTimeline';
import { cn } from '@/lib/cn';

type Props = {
  order: AdminOrderDetail;
  busy: boolean;
  error: string | null;
  printerReady: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onReprintTicket: () => void;
  onClose: () => void;
};

function paymentText(order: AdminOrderDetail) {
  const method =
    order.paymentMethod === 'pix'
      ? 'Pix'
      : order.paymentMethod === 'cash'
        ? 'Dinheiro'
        : 'Cartão';
  if (order.paymentStatus === 'refunded') return `${method} — Estornado`;
  if (order.paymentStatus === 'confirmed') {
    return `${method} — ${order.paymentMethod === 'pix' ? 'Aprovado' : 'Pago'}`;
  }
  return `${method} — Aguardando`;
}

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex-1 space-y-1 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Conteúdo do modal de detalhes do pedido (cabeçalho, corpo e ações). */
export default function OrderDetailModalBody({
  order,
  busy,
  error,
  printerReady,
  onAdvance,
  onCancel,
  onReprintTicket,
  onClose,
}: Props) {
  const next = nextAdminStatus(order.status, order.deliveryMethod);
  const customer = order.customer ?? order.guest;
  const terminal = order.status === 'delivered' || order.status === 'cancelled';
  const scheduledAt =
    order.timing === 'scheduled' && order.scheduledFor
      ? new Date(order.scheduledFor).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  const laneLabel =
    order.timing === 'scheduled' && order.status === 'received'
      ? 'Agenda'
      : order.deliveryMethod === 'delivery'
        ? 'Delivery'
        : 'Retirada';
  const feeLabel =
    order.deliveryMethod === 'delivery'
      ? 'Entrega'
      : 'Taxa de conveniência / embalagem';

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg font-bold">
              Detalhes do Pedido {order.number}
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
              {statusLabel(order.status)}
            </span>
            <span className="rounded-full bg-tone-info/15 px-2 py-0.5 text-2xs font-semibold text-tone-info-foreground">
              {laneLabel}
            </span>
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">
            {scheduledAt ? `Agendado para ${scheduledAt} · ` : ''}
            Criado às {clock(order.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <InfoCard label="Cliente">
            <p className="text-sm font-semibold">
              {customer?.name ?? 'Cliente'}
            </p>
            {customer?.phoneE164 ? (
              <p className="text-xs text-muted-foreground">
                {customer.phoneE164}
              </p>
            ) : null}
            {order.isGuest ? (
              <p className="text-2xs text-muted-foreground">Pedido de balcão</p>
            ) : null}
          </InfoCard>
          <InfoCard label="Modalidade & pagamento">
            <p className="text-xs">
              <span className="text-muted-foreground">Tipo: </span>
              {order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
              {order.timing === 'scheduled' ? ' Agendada' : ''}
              {order.isGuest ? ' (Balcão)' : ''}
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Pagamento: </span>
              <span
                className={cn(
                  'font-semibold',
                  order.paymentStatus === 'confirmed'
                    ? 'text-success'
                    : 'text-foreground',
                )}
              >
                {paymentText(order)}
              </span>
            </p>
          </InfoCard>
        </div>

        {order.status === 'cancelled' ? (
          <div className="rounded-lg border border-destructive/40 p-3">
            <p className="text-sm font-bold text-destructive">
              Pedido cancelado
            </p>
            {order.cancellationReason ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Motivo: {order.cancellationReason}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
              Linha do tempo do pedido
            </p>
            <OrderTimeline order={order} />
          </div>
        )}

        <div>
          <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
            Itens do pedido
          </p>
          <div className="rounded-lg border border-border">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2.5 border-b border-border p-3 last:border-b-0"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-2xs font-bold">
                  {item.quantity}×
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  {item.addOns.map((addon) => (
                    <p
                      key={`${addon.id}-${addon.name}`}
                      className="text-2xs text-muted-foreground"
                    >
                      + {addon.name}
                    </p>
                  ))}
                  {item.note ? (
                    <p className="mt-1 inline-block rounded bg-tone-warning px-1.5 py-0.5 text-2xs font-medium text-tone-warning-foreground">
                      Obs: {item.note}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {formatCatalogPrice(item.lineTotalCents)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg border border-border p-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Subtotal ({order.items.length}{' '}
              {order.items.length === 1 ? 'item' : 'itens'})
            </span>
            <span>{formatCatalogPrice(order.subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{feeLabel}</span>
            <span>{formatCatalogPrice(order.deliveryFeeCents)}</span>
          </div>
          {order.couponDiscountCents > 0 ? (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Cupom {order.couponCode}
              </span>
              <span className="text-success">
                −{formatCatalogPrice(order.couponDiscountCents)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
            <span>Valor Total</span>
            <span className="text-primary">
              {formatCatalogPrice(order.totalCents)}
            </span>
          </div>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
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
    </>
  );
}
