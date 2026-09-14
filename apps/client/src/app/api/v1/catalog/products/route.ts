import { NextResponse } from 'next/server';
import { listOrderableProducts } from '@/modules/catalog/catalog-repository';
import { httpStatusFor } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Sem cache (diferente da vitrine pública): usado pra revalidar carrinho e
// pra reviews, que também precisam enxergar produtos de pronta entrega —
// `listOrderableProducts()` inclui esses, `listCachedPublicProducts()` não.
export async function GET() {
  const result = await listOrderableProducts();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ products: result.data });
}
