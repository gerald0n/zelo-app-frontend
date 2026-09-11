/**
 * Aviso manual pelo WhatsApp em dois momentos do pedido: quando fica pronto
 * (mesmo status em que a térmica imprime o romaneio — "o pedido", não a
 * comanda de cozinha) e quando é concluído. Monta um link `wa.me`
 * (click-to-chat — recurso oficial da Meta) com a mensagem pronta; quem
 * envia é a atendente, pela conta real da confeitaria. Sem API, sem custo,
 * sem risco de bloqueio de número.
 */

import type { OrderStatus } from '@/modules/orders/types';

/**
 * Origin do cardápio — só entra no link de acompanhamento da mensagem.
 * `NEXT_PUBLIC_CLIENT_APP_ORIGIN` cobre preview/local; o default é produção.
 */
const CLIENT_APP_ORIGIN =
  process.env.NEXT_PUBLIC_CLIENT_APP_ORIGIN?.replace(/\/$/, '') ||
  'https://cardapio.zeloconfeitaria.com.br';

/**
 * "Saiu para entrega"/"pronto para retirada" — os mesmos status em que a
 * térmica imprime o romaneio do pedido. `out_for_delivery` fica coberto
 * também: cobre o caso de a atendente não ter clicado em `ready_for_delivery`
 * (que o painel apresenta como "saiu para entrega" pro cliente de qualquer
 * jeito) e só perceber depois.
 */
const DISPATCH_STATUSES: OrderStatus[] = [
  'ready_for_delivery',
  'out_for_delivery',
  'ready_for_pickup',
];

/** Pedido concluído — mensagem de agradecimento/feedback. */
const COMPLETION_STATUSES: OrderStatus[] = ['delivered'];

/** Status em que faz sentido avisar o cliente pelo WhatsApp. */
export function canNotifyOnWhatsapp(status: OrderStatus): boolean {
  return (
    DISPATCH_STATUSES.includes(status) || COMPLETION_STATUSES.includes(status)
  );
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
  if (COMPLETION_STATUSES.includes(order.status)) {
    return (
      'Muito obrigado pelo seu pedido na Zelo Confeitaria! Esperamos que ' +
      'aproveite cada pedaço. Saiba que pode sempre contar conosco para ' +
      'adoçar os seus momentos. Seu feedback também é super importante ' +
      'para nós, então, não deixe de dizer o que achou. 🧡'
    );
  }

  if (order.status === 'ready_for_pickup') {
    const name = firstName(order.customerName);
    const greeting = name ? `Oi, ${name}! ` : 'Oi! ';
    return `${greeting}Seu pedido ${order.number} da Zelo está pronto para retirada. Te esperamos! 🧡`;
  }

  return (
    `Boa notícia! O seu pedido de número ${order.number} saiu para ser ` +
    `entregue e chegará em breve até você 🧡\n\n` +
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
