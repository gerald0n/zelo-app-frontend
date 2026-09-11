/**
 * Aviso manual pelo WhatsApp quando o pedido vira "saiu para entrega" ou
 * "pronto para retirada". Monta um link `wa.me` (click-to-chat — recurso
 * oficial da Meta) com a mensagem pronta; quem envia é a atendente, pela conta
 * real da confeitaria. Sem API, sem custo, sem risco de bloqueio de número.
 */

import type { OrderStatus } from '@/modules/orders/types';

/**
 * Origin do cardápio — só entra no link de acompanhamento da mensagem.
 * `NEXT_PUBLIC_CLIENT_APP_ORIGIN` cobre preview/local; o default é produção.
 */
const CLIENT_APP_ORIGIN =
  process.env.NEXT_PUBLIC_CLIENT_APP_ORIGIN?.replace(/\/$/, '') ||
  'https://cardapio.zeloconfeitaria.com.br';

/** Status em que faz sentido avisar o cliente pelo WhatsApp. */
export function canNotifyOnWhatsapp(status: OrderStatus): boolean {
  return status === 'out_for_delivery' || status === 'ready_for_pickup';
}

function firstName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.split(/\s+/)[0] : '';
}

/** `+55 (41) 99999-9999` → `5541999999999`; `null` quando não dá pra usar. */
function toWaNumber(phoneE164: string | null | undefined): string | null {
  const digits = (phoneE164 ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

export type WhatsappOrderInfo = {
  status: OrderStatus;
  /** Número exibido, ex. `#123`. */
  number: string;
  id: string;
  customerName: string | null;
  phoneE164: string | null;
};

function messageFor(order: WhatsappOrderInfo): string {
  const name = firstName(order.customerName);
  const greeting = name ? `Oi, ${name}! ` : 'Oi! ';

  if (order.status === 'ready_for_pickup') {
    return `${greeting}Seu pedido ${order.number} da Zelo está pronto para retirada. Te esperamos! 💛`;
  }

  return (
    `${greeting}Seu pedido ${order.number} da Zelo saiu para entrega e chega em breve. 💛\n\n` +
    `Acompanhe: ${CLIENT_APP_ORIGIN}/acompanhamento/${order.id}`
  );
}

/** Link `https://wa.me/...` pronto, ou `null` quando não dá pra avisar. */
export function buildOrderWhatsappLink(
  order: WhatsappOrderInfo,
): string | null {
  if (!canNotifyOnWhatsapp(order.status)) return null;
  const number = toWaNumber(order.phoneE164);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(messageFor(order))}`;
}
