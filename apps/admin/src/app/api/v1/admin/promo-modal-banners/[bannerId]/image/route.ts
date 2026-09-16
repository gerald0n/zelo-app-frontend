import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { uploadPromoModalBannerImage } from '@/modules/admin/promo-modal-banners/upload';
import type { PromoModalBannerImageVariant } from '@/modules/admin/promo-modal-banners/shared';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ bannerId: string }> };

const VALID_VARIANTS: PromoModalBannerImageVariant[] = ['vertical', 'horizontal'];

export async function POST(request: Request, context: RouteContext) {
  const { bannerId } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const variant = form?.get('variant');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Envie o arquivo em "file".' } },
      { status: 400 },
    );
  }
  if (
    typeof variant !== 'string' ||
    !VALID_VARIANTS.includes(variant as PromoModalBannerImageVariant)
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Informe "variant" como "vertical" ou "horizontal".',
        },
      },
      { status: 400 },
    );
  }

  const result = await uploadPromoModalBannerImage({
    bannerId,
    variant: variant as PromoModalBannerImageVariant,
    file,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ banner: result.data });
}
