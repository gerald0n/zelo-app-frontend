import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { uploadProductPreviewImage } from '@/modules/admin/catalog/product-preview-image';

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

  const result = await uploadProductPreviewImage({ productId, file, altText });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ previewImage: result.data }, { status: 201 });
}
