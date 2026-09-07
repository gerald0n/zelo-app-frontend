import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import {
  createOrderBodySchema,
  createOrderFromCheckout,
} from '@/modules/orders/create-order';
import { listCustomerOrders } from '@/modules/orders/customer-orders';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get('scope');
  const scope =
    scopeParam === 'active' || scopeParam === 'history' || scopeParam === 'all'
      ? scopeParam
      : 'all';

  const result = await listCustomerOrders({ scope });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ orders: result.data });
}

export async function POST(request: Request) {
  const limited = await enforceIpRateLimit({
    kind: 'order_create',
    ip: clientIpFromRequest(request),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Header Idempotency-Key é obrigatório.',
        },
      },
      { status: 400 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createOrderBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados do pedido inválidos.',
          details: { issues: parsed.error.issues },
        },
      },
      { status: 400 },
    );
  }

  const result = await createOrderFromCheckout({
    body: parsed.data,
    idempotencyKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json(
    {
      order: result.data.order,
      ...(result.data.pix ? { pix: result.data.pix } : {}),
      replayed: result.data.replayed,
    },
    { status: result.data.httpStatus },
  );
}
