import { NextRequest, NextResponse } from 'next/server';
import { getPairRecommendationProductId } from '@/modules/catalog/recommendations-repository';
import { getPublicProductBySlugOrId } from '@/modules/catalog/catalog-repository';
import { httpStatusFor } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Recomendação de "comprados juntos" pro carrinho de 1 produto — ver
// packages/shared/src/modules/catalog/recommendations-repository.ts.
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id');
  if (!productId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'product_id é obrigatório' } },
      { status: 400 },
    );
  }

  const recommendedId = await getPairRecommendationProductId(productId);
  if (!recommendedId) {
    return NextResponse.json({ product: null });
  }

  const result = await getPublicProductBySlugOrId(recommendedId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ product: result.data });
}
