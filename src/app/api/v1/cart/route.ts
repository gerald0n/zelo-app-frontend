import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  cartSyncBodySchema,
  getCustomerCart,
  replaceCustomerCart,
  clearCustomerCart,
} from '@/modules/carts/persist-cart';

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
