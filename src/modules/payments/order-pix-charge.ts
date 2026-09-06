import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { resolveCustomerForCheckout } from '@/modules/orders/customer';
import { createPixCharge } from '@/modules/payments/mercadopago';

/**
 * E-mail do pagador exigido pela Orders API. O cliente se identifica no app do
 * banco na hora de pagar o Pix, então quando não temos o e-mail real usamos um
 * endereço sintético só para satisfazer a API.
 */
function payerEmailFor(customer: { id: string; email?: string | null }): string {
  const raw = customer.email?.trim();
  if (raw && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) return raw;
  return `cliente+${customer.id}@zeloconfeitaria.com.br`;
}

export type OrderPixCharge = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  expiresAt: string;
};

/** Estado da cobrança Pix visto pela tela de pagamento do cliente. */
export type OrderPixView = {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  status: string;
  paymentStatus: string;
  pix: OrderPixCharge | null;
};

async function persistCharge(
  orderId: string,
  charge: {
    mpOrderId: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string | null;
    expiresAt: string;
  },
  attempt: number,
): Promise<Result<OrderPixCharge>> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('orders')
    .update({
      mp_order_id: charge.mpOrderId,
      pix_qr_code: charge.qrCode,
      pix_qr_code_base64: charge.qrCodeBase64,
      pix_ticket_url: charge.ticketUrl,
      pix_expires_at: charge.expiresAt,
      pix_attempt: attempt,
    })
    .eq('id', orderId);

  if (error) {
    logger.error('Cobrança Pix criada mas falhou ao gravar no pedido', {
      orderId,
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Falha ao registrar a cobrança Pix.', {
      cause: error,
    });
  }

  return ok({
    qrCode: charge.qrCode,
    qrCodeBase64: charge.qrCodeBase64,
    ticketUrl: charge.ticketUrl,
    expiresAt: charge.expiresAt,
  });
}

/**
 * Cria a cobrança Pix no Mercado Pago para um pedido recém-criado e grava o QR
 * (imagem + copia e cola) na linha do pedido. Idempotente por tentativa: a
 * Orders API usa `X-Idempotency-Key = order-<id>-<attempt>`.
 */
export async function createOrderPixCharge(input: {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  customer: { id: string; email?: string | null };
}): Promise<Result<OrderPixCharge>> {
  const charge = await createPixCharge({
    orderId: input.orderId,
    amountCents: input.totalCents,
    payerEmail: payerEmailFor(input.customer),
    description: `Pedido #${input.orderNumber} — Zelo`,
    attempt: 1,
  });
  if (!charge.ok) return charge;

  return persistCharge(input.orderId, charge.data, 1);
}

type OwnedOrderRow = {
  id: string;
  order_number: number;
  total_cents: number;
  status: string;
  payment_method: string;
  payment_status: string;
  mp_order_id: string | null;
  pix_attempt: number;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  pix_expires_at: string | null;
};

const OWNED_ORDER_SELECT =
  'id, order_number, total_cents, status, payment_method, payment_status, mp_order_id, pix_attempt, pix_qr_code, pix_qr_code_base64, pix_ticket_url, pix_expires_at';

/** Carrega um pedido garantindo que ele pertence ao cliente autenticado. */
async function loadOwnedOrder(orderId: string): Promise<Result<OwnedOrderRow>> {
  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return identity;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(OWNED_ORDER_SELECT)
    .eq('id', orderId)
    .eq('customer_id', identity.data.id)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao carregar o pedido.', {
      cause: error,
    });
  }
  if (!data) {
    return err('NOT_FOUND', 'Pedido não encontrado.');
  }
  return ok(data as OwnedOrderRow);
}

function viewFromRow(row: OwnedOrderRow): OrderPixView {
  const hasQr = Boolean(row.pix_qr_code && row.pix_qr_code_base64);
  return {
    orderId: row.id,
    orderNumber: row.order_number,
    totalCents: row.total_cents,
    status: row.status,
    paymentStatus: row.payment_status,
    pix:
      hasQr && row.pix_expires_at
        ? {
            qrCode: row.pix_qr_code as string,
            qrCodeBase64: row.pix_qr_code_base64 as string,
            ticketUrl: row.pix_ticket_url,
            expiresAt: row.pix_expires_at,
          }
        : null,
  };
}

/**
 * Só aceitamos operar a cobrança Pix de pedidos do fluxo dinâmico (Orders API),
 * que têm `mp_order_id`. Pedidos Pix antigos (fluxo manual: copia e cola +
 * WhatsApp) nunca tiveram cobrança no Mercado Pago e não devem gerar uma agora.
 */
function ensureDynamicPixOrder(row: OwnedOrderRow): Result<null> {
  if (row.payment_method !== 'pix') {
    return err('VALIDATION_ERROR', 'Este pedido não é Pix.');
  }
  if (!row.mp_order_id) {
    return err('VALIDATION_ERROR', 'Este pedido não tem cobrança Pix.');
  }
  return ok(null);
}

/** Estado atual da cobrança Pix de um pedido (para a tela de pagamento). */
export async function getOrderPixView(
  orderId: string,
): Promise<Result<OrderPixView>> {
  const owned = await loadOwnedOrder(orderId);
  if (!owned.ok) return owned;
  const guard = ensureDynamicPixOrder(owned.data);
  if (!guard.ok) return guard;
  return ok(viewFromRow(owned.data));
}

/**
 * Gera um novo código Pix para um pedido cujo código anterior expirou. Só é
 * permitido enquanto o pagamento está pendente e o pedido não saiu de "received".
 */
export async function regenerateOrderPixCharge(
  orderId: string,
): Promise<Result<OrderPixView>> {
  const owned = await loadOwnedOrder(orderId);
  if (!owned.ok) return owned;
  const row = owned.data;

  const guard = ensureDynamicPixOrder(row);
  if (!guard.ok) return guard;
  if (row.payment_status === 'confirmed') {
    return ok(viewFromRow(row));
  }
  if (row.payment_status !== 'pending' || row.status !== 'received') {
    return err(
      'VALIDATION_ERROR',
      'Este pedido não aceita mais um novo código Pix.',
    );
  }

  // Ainda válido? Não gera outro à toa.
  if (
    row.pix_qr_code &&
    row.pix_expires_at &&
    new Date(row.pix_expires_at).getTime() > Date.now() + 30_000
  ) {
    return ok(viewFromRow(row));
  }

  const attempt = row.pix_attempt + 1;
  const charge = await createPixCharge({
    orderId: row.id,
    amountCents: row.total_cents,
    payerEmail: `cliente+${orderId}@zeloconfeitaria.com.br`,
    description: `Pedido #${row.order_number} — Zelo`,
    attempt,
  });
  if (!charge.ok) return charge;

  const persisted = await persistCharge(row.id, charge.data, attempt);
  if (!persisted.ok) return persisted;

  return ok({
    orderId: row.id,
    orderNumber: row.order_number,
    totalCents: row.total_cents,
    status: row.status,
    paymentStatus: row.payment_status,
    pix: persisted.data,
  });
}
