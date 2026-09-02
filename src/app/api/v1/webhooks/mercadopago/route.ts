import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyWebhookSignature } from '@/modules/payments/mercadopago';
import { processMercadoPagoNotification } from '@/modules/payments/order-pix';

export const dynamic = 'force-dynamic';

type NotificationBody = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

/**
 * Webhook do Mercado Pago (tópicos `order` e `payment`).
 *
 * O corpo é apenas um gatilho: a confirmação real vem de uma consulta à API do
 * Mercado Pago feita em `processMercadoPagoNotification`. Respondemos 200 sempre
 * que a notificação foi tratada (mesmo "pedido não encontrado"), e 5xx só em
 * falha transitória, para que o Mercado Pago re-tente.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const queryDataId = url.searchParams.get('data.id');
  const queryType = url.searchParams.get('type');

  const body = (await request
    .json()
    .catch(() => null)) as NotificationBody | null;

  const bodyDataId = body?.data?.id != null ? String(body.data.id) : null;
  const resourceId = queryDataId ?? bodyDataId;
  const type = queryType ?? body?.type ?? null;
  const eventId =
    body?.id != null ? String(body.id) : request.headers.get('x-request-id');

  const signatureValid = verifyWebhookSignature({
    signatureHeader: request.headers.get('x-signature'),
    requestIdHeader: request.headers.get('x-request-id'),
    // O manifesto usa o `data.id` do query param.
    dataId: queryDataId ?? bodyDataId,
  });

  if (!signatureValid) {
    logger.error('Webhook Mercado Pago com assinatura inválida', {
      type,
      resourceId,
    });
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const result = await processMercadoPagoNotification({
    eventId,
    eventType: type,
    action: body?.action ?? null,
    ref: { type, resourceId },
    signatureValid,
    rawPayload: body ?? {},
  });

  if (!result.ok) {
    logger.error('Falha transitória ao processar webhook Mercado Pago', {
      type,
      resourceId,
      code: result.error.code,
    });
    return NextResponse.json({ error: 'retry later' }, { status: 503 });
  }

  return NextResponse.json({ outcome: result.data }, { status: 200 });
}
