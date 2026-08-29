import { NextResponse } from 'next/server';
import { listPublicProducts } from '@/modules/catalog/catalog-repository';
import { httpStatusFor } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listPublicProducts();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ products: result.data });
}
