import type { CustomerOrder } from '@/modules/orders/types';

const LABEL: Record<CustomerOrder['paymentMethod'], string> = {
  pix: 'Pix',
  pix_manual: 'Pix (manual)',
  cash: 'Dinheiro',
  card: 'Cartão',
};

/** Rótulo de exibição de `payment_method` — mesmo mapeamento em todo o admin. */
export function paymentMethodLabel(
  method: CustomerOrder['paymentMethod'],
): string {
  return LABEL[method];
}
