'use client';

import { useCheckout } from '@/contexts/CheckoutContext';
import type { FulfillmentLocation } from '@/contexts/checkout-state';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ id: FulfillmentLocation; label: string }> = [
  { id: 'pereiro', label: 'Pereiro' },
  { id: 'sao_miguel', label: 'São Miguel' },
];

/** Escolha de onde o pedido é atendido — só aparece no fluxo de encomenda. */
export function FulfillmentLocationToggle() {
  const { checkout, setFulfillmentLocation } = useCheckout();

  return (
    <>
      <p className="text-base font-semibold">Onde retirar/receber?</p>
      <div className="flex min-w-0 gap-2.5">
        {OPTIONS.map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => setFulfillmentLocation(loc.id)}
            className={cn(
              'flex-1 rounded-md border-[1.5px] py-2.5 text-sm transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
              checkout.fulfillmentLocation === loc.id
                ? 'border-primary bg-primary/[0.07] font-semibold text-primary'
                : 'border-border bg-card text-foreground',
            )}
          >
            {loc.label}
          </button>
        ))}
      </div>
    </>
  );
}
