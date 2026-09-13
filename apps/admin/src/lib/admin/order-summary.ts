import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AdminOrderDetail } from '@/modules/admin/types';

/** "1" → "01" — mesmo padrão de quantidade da comanda impressa. */
function pad(quantity: number): string {
  return String(quantity).padStart(2, '0');
}

/**
 * Texto pronto pra colar no WhatsApp — resume os itens e o total do pedido
 * pra atendente mandar pro cliente sem digitar tudo de novo.
 */
export function buildOrderSummaryText(order: AdminOrderDetail): string {
  const itemLines = order.items.flatMap((item) => [
    `${pad(item.quantity)} ${item.name} - ${formatCatalogPrice(item.lineTotalCents)}`,
    ...item.addOns.map((addOn) => `   + ${addOn.name}`),
  ]);

  return [
    'Resumo do pedido 📦',
    '',
    ...itemLines,
    '',
    `Valor total do pedido: ${formatCatalogPrice(order.totalCents)}`,
  ].join('\n');
}
