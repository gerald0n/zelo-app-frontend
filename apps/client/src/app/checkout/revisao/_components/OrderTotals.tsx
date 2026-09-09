import { Separator } from '@/components/ui/separator';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AppliedCoupon } from '@/app/checkout/revisao/_components/CouponField';

type Props = {
  subtotal: number;
  deliveryFee: number;
  couponDiscount: number;
  coupon: AppliedCoupon | null;
  isPickup: boolean;
  total: number;
};

/** Bloco Subtotal / Cupom / Entrega / Total da revisão do pedido. */
export function OrderTotals({
  subtotal,
  deliveryFee,
  couponDiscount,
  coupon,
  isPickup,
  total,
}: Props) {
  const freeShipCoupon = coupon?.discountType === 'free_shipping';
  const freeDelivery = isPickup || deliveryFee === 0 || freeShipCoupon;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="text-sm font-medium tabular-nums">
          {formatCatalogPrice(subtotal)}
        </span>
      </div>

      {coupon && !freeShipCoupon ? (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Cupom {coupon.code}
            </span>
            <span className="text-sm font-medium tabular-nums text-success">
              −{formatCatalogPrice(couponDiscount)}
            </span>
          </div>
        </>
      ) : null}

      <Separator />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Entrega</span>
        <span
          className={`text-sm font-medium tabular-nums ${freeDelivery ? 'text-success' : ''}`}
        >
          {freeDelivery
            ? freeShipCoupon && deliveryFee > 0
              ? `Grátis (cupom ${coupon?.code})`
              : 'Grátis'
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
  );
}
