import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { archiveAdminProduct } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ productId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { productId } = await context.params;
  const result = await archiveAdminProduct(productId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
