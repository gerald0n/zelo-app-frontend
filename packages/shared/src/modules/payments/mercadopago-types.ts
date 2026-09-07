/** Status de pagamento normalizado para o nosso enum `payment_status`. */
export type NormalizedPaymentStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'refunded';

export type PixCharge = {
  mpOrderId: string;
  mpPaymentId: string | null;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  /** Instante absoluto de expiração calculado no momento da criação. */
  expiresAt: string;
  status: NormalizedPaymentStatus;
};

export type MercadoPagoSnapshot = {
  mpOrderId: string | null;
  mpPaymentId: string | null;
  externalReference: string | null;
  status: NormalizedPaymentStatus;
  rawStatus: string | null;
  rawStatusDetail: string | null;
};

// --- Tipos parciais da resposta da Orders API -----------------------------

export type MpPaymentMethod = {
  id?: string;
  type?: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
};

export type MpPayment = {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  payment_method?: MpPaymentMethod;
};

export type MpOrder = {
  id?: string;
  external_reference?: string;
  status?: string;
  status_detail?: string;
  transactions?: { payments?: MpPayment[] };
};

export function firstPayment(order: MpOrder): MpPayment | undefined {
  return order.transactions?.payments?.[0];
}

/**
 * Mapeia o status cru do Mercado Pago para o nosso enum.
 * Referência: `approved`/`accredited` = pago; `rejected`/`cancelled`/`expired`
 * = falha; qualquer outro (`pending`, `action_required`, `in_process`) = aguardando.
 */
export function normalizePaymentStatus(
  raw: string | undefined | null,
): NormalizedPaymentStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'approved':
    case 'accredited':
    case 'processed':
    case 'paid':
      return 'confirmed';
    case 'rejected':
    case 'cancelled':
    case 'canceled':
    case 'expired':
    case 'failed':
      return 'failed';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    default:
      return 'pending';
  }
}

export function snapshotFromOrder(order: MpOrder): MercadoPagoSnapshot {
  const payment = firstPayment(order);
  return {
    mpOrderId: order.id ?? null,
    mpPaymentId: payment?.id ?? null,
    externalReference:
      payment?.external_reference ?? order.external_reference ?? null,
    status: normalizePaymentStatus(payment?.status ?? order.status),
    rawStatus: payment?.status ?? order.status ?? null,
    rawStatusDetail: payment?.status_detail ?? order.status_detail ?? null,
  };
}
