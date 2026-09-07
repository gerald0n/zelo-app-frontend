import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  createOrderBodySchema,
  previewCheckout,
} from '@/modules/orders/create-order';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createOrderBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados da prévia inválidos.',
          details: { issues: parsed.error.issues },
        },
      },
      { status: 400 },
    );
  }

  const result = await previewCheckout(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ preview: result.data });
}
