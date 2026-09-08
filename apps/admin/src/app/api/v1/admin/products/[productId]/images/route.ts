import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { reorderProductImages } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ productId: string }> };

const putSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export async function PUT(request: Request, context: RouteContext) {
  const { productId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
      { status: 400 },
    );
  }

  const result = await reorderProductImages({
    productId,
    orderedIds: parsed.data.orderedIds,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ ok: true });
}
