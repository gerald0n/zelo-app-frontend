import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { uploadProductImage } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Envie multipart/form-data.',
        },
      },
      { status: 400 },
    );
  }

  const productId = String(form.get('productId') ?? '');
  const altText = String(form.get('altText') ?? '');
  const isPrimaryRaw = form.get('isPrimary');
  const file = form.get('file');

  if (!productId || !(file instanceof File)) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Informe productId e file.',
        },
      },
      { status: 400 },
    );
  }

  const isPrimaryValue = String(isPrimaryRaw ?? '');
  const result = await uploadProductImage({
    productId,
    file,
    altText,
    isPrimary: isPrimaryValue === 'true' || isPrimaryValue === '1',
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ image: result.data }, { status: 201 });
}
