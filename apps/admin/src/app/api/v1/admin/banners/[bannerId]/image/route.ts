import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { uploadBannerImage } from '@/modules/admin/banners';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ bannerId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { bannerId } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Envie o arquivo em "file".' } },
      { status: 400 },
    );
  }

  const result = await uploadBannerImage({ bannerId, file });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ banner: result.data });
}
