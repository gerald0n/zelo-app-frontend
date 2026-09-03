import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import {
  cartSyncBodySchema,
  getCustomerCart,
  replaceCustomerCart,
  clearCustomerCart,
} from '@/modules/carts/persist-cart';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getCustomerCart();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ items: result.data.items });
}

export async function PUT(request: Request) {
  const limited = await enforceIpRateLimit({
    kind: 'cart_sync',
    ip: clientIpFromRequest(request),
    limit: 240,
    windowMs: 5 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const json = await request.json().catch(() => null);
  const parsed = cartSyncBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Carrinho inválido.',
        },
      },
      { status: 400 },
    );
  }

  const result = await replaceCustomerCart(parsed.data.items);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ items: result.data.items });
}

export async function DELETE() {
  const result = await clearCustomerCart();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ items: [] });
}
