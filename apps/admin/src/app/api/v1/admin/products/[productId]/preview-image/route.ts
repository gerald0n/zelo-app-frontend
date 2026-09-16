import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { deleteProductPreviewImage } from '@/modules/admin/catalog/product-preview-image';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { productId } = await context.params;
  const result = await deleteProductPreviewImage(productId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
