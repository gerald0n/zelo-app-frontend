import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppEnv, hasWebPushConfig } from '@/config/env';
import { httpStatusFor } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';
import {
  notifyAdminNewOrder,
  notifyOrderStatusChange,
} from '@/modules/notifications/send';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orderId: z.string().uuid(),
  /** Omitido = testa o push de pedido novo pro painel. */
  newStatus: z
    .enum([
      'confirmed',
      'in_production',
      'ready_for_delivery',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'cancelled',
    ])
    .optional(),
});

/**
 * Envio de teste — apenas local ou admin autenticado.
 */
export async function POST(request: Request) {
  const appEnv = getAppEnv();
  if (appEnv !== 'local') {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: httpStatusFor(auth.error.code) },
      );
    }
  }

  if (!hasWebPushConfig()) {
    return NextResponse.json(
      {
        error: {
          code: 'INTEGRATION_UNAVAILABLE',
          message: 'Configure as chaves VAPID para testar push.',
        },
      },
      { status: 503 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Informe um orderId válido.',
        },
      },
      { status: 400 },
    );
  }

  if (parsed.data.newStatus) {
    await notifyOrderStatusChange({
      orderId: parsed.data.orderId,
      newStatus: parsed.data.newStatus,
    });
  } else {
    await notifyAdminNewOrder({ orderId: parsed.data.orderId });
  }

  return NextResponse.json({ ok: true });
}
