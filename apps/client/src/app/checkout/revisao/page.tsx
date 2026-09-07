'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  Bike,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/contexts/CartContext';
import { Separator } from '@/components/ui/separator';
import CheckoutProgress from '@/components/CheckoutProgress';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { cn } from '@/lib/cn';
import {
  checkoutFooterClass,
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
  pageBodyPadClass,
  pagePrimaryButtonClass,
} from '@/lib/layout';
import { randomUUID } from '@/lib/random-id';
import { useAppDialog } from '@/contexts/AppDialogContext';

const PAYMENT_LABELS = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
};

function SummaryBlock({
  icon: Icon,
  title,
  children,
  onEdit,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-[18px] text-primary" />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-medium text-primary"
          >
            Editar
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function buildScheduledFor(
  dateIso?: string,
  time?: string,
): string | undefined {
  if (!dateIso || !time) return undefined;
  return `${dateIso}T${time}:00-03:00`;
}

export default function RevisaoPage() {
  const router = useRouter();
  const { checkout, resetCheckout } = useCheckout();
  const { items, subtotal, clearCart } = useCart();
  const { confirm } = useAppDialog();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => randomUUID());

  const deliveryFee =
    checkout.deliveryType === 'delivery' ? checkout.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;

  const handleConfirm = async () => {
    if (submitting || items.length === 0) return;

    const ok = await confirm({
      title: 'Confirmar pedido',
      description: `Total de ${formatCatalogPrice(total)}. Deseja enviar o pedido agora?`,
      confirmLabel: 'Fazer pedido',
    });
    if (!ok) return;

    setSubmitting(true);
    setError(null);

    const body = {
      timing: checkout.scheduleType === 'now' ? 'immediate' : 'scheduled',
      scheduledFor:
        checkout.scheduleType === 'scheduled'
          ? buildScheduledFor(checkout.scheduledDate, checkout.scheduledTime)
          : undefined,
      deliveryMethod: checkout.deliveryType,
      paymentMethod: checkout.paymentMethod,
      needsChange:
        checkout.paymentMethod === 'cash'
          ? Boolean(checkout.changeFor.trim())
          : undefined,
      changeForAmountCents:
        checkout.paymentMethod === 'cash' && checkout.changeFor.trim()
          ? Math.round(parseFloat(checkout.changeFor.replace(',', '.')) * 100)
          : undefined,
      customerNote: checkout.note || undefined,
      address:
        checkout.deliveryType === 'delivery'
          ? {
              street: checkout.addressDetails.street,
              number: checkout.addressDetails.number,
              neighborhood: checkout.addressDetails.neighborhood,
              city: checkout.addressDetails.city || 'Pereiro',
              state: checkout.addressDetails.state || 'CE',
              postalCode: checkout.addressDetails.postalCode || undefined,
              complement: checkout.addressDetails.complement || undefined,
              referencePoint:
                checkout.addressDetails.referencePoint || undefined,
              latitude: checkout.addressDetails.latitude!,
              longitude: checkout.addressDetails.longitude!,
            }
          : undefined,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customerNote: item.note || undefined,
        addOns: item.selectedAddons.map((addon) => ({
          addOnId: addon.id,
          quantity: 1,
        })),
      })),
    };

    try {
      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? 'Não foi possível criar o pedido.');
        setSubmitting(false);
        return;
      }

      const orderId = json.order.id as string;
      const orderNumber = json.order.orderNumber as number;
      clearCart();
      resetCheckout();
      // Pix: cai na tela do QR e só avança quando o pagamento é confirmado.
      if (checkout.paymentMethod === 'pix' && json.pix) {
        router.push(`/checkout/pix/${encodeURIComponent(orderId)}`);
        return;
      }
      router.push(
        `/pedido-recebido?orderId=${encodeURIComponent(orderId)}&orderNumber=${orderNumber}`,
      );
    } catch {
      setError('Falha de rede ao criar o pedido.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <Link href="/checkout/pagamento" aria-label="Voltar ao pagamento">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Revisão</h1>
        <span className="w-6" />
      </header>

      <CheckoutProgress
        current={3}
        total={3}
        labels={['Recebimento', 'Pagamento', 'Revisão']}
        className={checkoutDesktopContainerClass}
      />

      <div>
        <div
          className={cn(
            'space-y-3',
            pageBodyPadClass,
            checkoutDesktopContainerClass,
          )}
        >
          <SummaryBlock icon={ShoppingBag} title="Itens do pedido">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="w-6 text-sm text-muted-foreground">
                  {item.quantity}×
                </span>
                <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                <span className="text-sm font-medium tabular-nums">
                  {formatCatalogPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </SummaryBlock>

          <SummaryBlock
            icon={checkout.deliveryType === 'delivery' ? Bike : ShoppingBag}
            title="Recebimento"
            onEdit={() => router.push('/checkout/recebimento')}
          >
            <p className="text-sm leading-5 text-muted-foreground">
              {checkout.deliveryType === 'delivery'
                ? 'Entrega'
                : 'Retirada na loja'}{' '}
              · {checkout.scheduleType === 'now' ? 'Agora' : 'Agendado'}
              {checkout.scheduleType === 'scheduled' && checkout.scheduledDate
                ? ` · ${checkout.scheduledDate}${checkout.scheduledTime ? ` às ${checkout.scheduledTime}` : ''}`
                : null}
            </p>
            {checkout.deliveryType === 'delivery' && checkout.address ? (
              <p className="text-sm leading-5 text-muted-foreground">
                {checkout.address}
              </p>
            ) : null}
            {checkout.deliveryType === 'delivery' &&
            checkout.routeDistanceMeters != null ? (
              <p className="text-sm leading-5 text-muted-foreground">
                A {(checkout.routeDistanceMeters / 1000).toFixed(1)} km da loja
              </p>
            ) : null}
          </SummaryBlock>

          <SummaryBlock
            icon={CreditCard}
            title="Pagamento"
            onEdit={() => router.push('/checkout/pagamento')}
          >
            <p className="text-sm leading-5 text-muted-foreground">
              {PAYMENT_LABELS[checkout.paymentMethod]}
            </p>
            {checkout.paymentMethod === 'cash' && checkout.changeFor ? (
              <p className="text-sm leading-5 text-muted-foreground">
                Troco para {checkout.changeFor}
              </p>
            ) : null}
          </SummaryBlock>

          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium tabular-nums">
                {formatCatalogPrice(subtotal)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Entrega</span>
              <span
                className={`text-sm font-medium tabular-nums ${checkout.deliveryType === 'pickup' || deliveryFee === 0 ? 'text-success' : ''}`}
              >
                {checkout.deliveryType === 'pickup' || deliveryFee === 0
                  ? 'Grátis'
                  : formatCatalogPrice(deliveryFee)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-bold tabular-nums">
                {formatCatalogPrice(total)}
              </span>
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className={cn(checkoutFooterClass, 'space-y-3')}>
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Total</span>
              <span className="font-serif text-xl font-bold tabular-nums">
                {formatCatalogPrice(total)}
              </span>
            </div>
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={() => void handleConfirm()}
              className={pagePrimaryButtonClass}
            >
              {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
              {submitting ? 'Enviando…' : 'Fazer pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
