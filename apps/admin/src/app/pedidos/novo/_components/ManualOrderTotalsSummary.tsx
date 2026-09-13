import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AppliedManualOrderCoupon } from '@/app/pedidos/novo/_components/ManualOrderCouponField';

type Props = {
  itemCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  showDelivery: boolean;
  coupon: AppliedManualOrderCoupon | null;
  couponDiscountCents: number;
  totalCents: number;
};

/** Resumo de valores do passo 3 — subtotal, entrega, cupom e total previsto. */
export function ManualOrderTotalsSummary({
  itemCount,
  subtotalCents,
  deliveryFeeCents,
  showDelivery,
  coupon,
  couponDiscountCents,
  totalCents,
}: Props) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-3.5 text-xs">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal ({itemCount} itens)</span>
        <span>{formatCatalogPrice(subtotalCents)}</span>
      </div>
      {showDelivery ? (
        <div className="flex justify-between text-muted-foreground">
          <span>Entrega</span>
          <span>{formatCatalogPrice(deliveryFeeCents)}</span>
        </div>
      ) : null}
      {coupon ? (
        <div className="flex justify-between text-success">
          <span>Cupom {coupon.code}</span>
          <span>−{formatCatalogPrice(couponDiscountCents)}</span>
        </div>
      ) : null}
      <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
        <span>Total previsto</span>
        <span className="text-primary">{formatCatalogPrice(totalCents)}</span>
      </div>
    </div>
  );
}
