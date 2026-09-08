import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  deleteProductImage,
  setPrimaryProductImage,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ productId: string; imageId: string }>;
};

const patchSchema = z.object({ isPrimary: z.literal(true) });

export async function PATCH(request: Request, context: RouteContext) {
  const { productId, imageId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } },
      { status: 400 },
    );
  }

  const result = await setPrimaryProductImage({ productId, imageId });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { productId, imageId } = await context.params;
  const result = await deleteProductImage({ productId, imageId });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
