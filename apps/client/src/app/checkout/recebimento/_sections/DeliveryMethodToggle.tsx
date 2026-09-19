'use client';

import { Bike, ShoppingBag } from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { formatRadius } from '@/app/checkout/recebimento/recebimento-helpers';
import { cn } from '@/lib/cn';
import { NEARBY_DELIVERY_FEE_CENTS } from '@/modules/delivery';

type Props = {
  nearbyDeliveryRadiusMeters: number | null;
};

/** Botões "Entrega"/"Retirada" com o resumo de taxa/raio de cada opção. */
export function DeliveryMethodToggle({ nearbyDeliveryRadiusMeters }: Props) {
  const { checkout, setDeliveryType } = useCheckout();
  const deliveryFee =
    checkout.deliveryType === 'delivery' ? checkout.deliveryFeeCents : 0;

  return (
    <div className="flex min-w-0 gap-2.5">
      {(['delivery', 'pickup'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setDeliveryType(t)}
          className={cn(
            'flex flex-1 flex-col items-center gap-1.5 rounded-md border-[1.5px] py-3.5 transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
            checkout.deliveryType === t
              ? 'border-primary bg-primary/[0.07]'
              : 'border-border bg-card',
          )}
        >
          {t === 'delivery' ? (
            <Bike
              className={cn(
                'size-[22px]',
                checkout.deliveryType === t
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
            />
          ) : (
            <ShoppingBag
              className={cn(
                'size-[22px]',
                checkout.deliveryType === t
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
            />
          )}
          <span
            className={cn(
              'text-sm',
              checkout.deliveryType === t
                ? 'font-semibold text-primary'
                : 'text-foreground',
            )}
          >
            {t === 'delivery' ? 'Entrega' : 'Retirada'}
          </span>
          <span className="text-2xs text-muted-foreground">
            {t === 'delivery'
              ? checkout.routeDistanceMeters != null
                ? deliveryFee === 0
                  ? 'Grátis'
                  : formatCatalogPrice(deliveryFee)
                : nearbyDeliveryRadiusMeters != null
                  ? `${formatCatalogPrice(NEARBY_DELIVERY_FEE_CENTS)} até ${formatRadius(nearbyDeliveryRadiusMeters)}`
                  : `A partir de ${formatCatalogPrice(NEARBY_DELIVERY_FEE_CENTS)}`
              : 'Grátis'}
          </span>
        </button>
      ))}
    </div>
  );
}
