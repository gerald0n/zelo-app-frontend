import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { deleteProductImage } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ productId: string; imageId: string }>;
};

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
