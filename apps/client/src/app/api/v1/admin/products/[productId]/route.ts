import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  archiveAdminProduct,
  updateAdminProduct,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ productId: string }> };

const patchSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  weightMinGrams: z.number().int().positive().nullable().optional(),
  weightMaxGrams: z.number().int().positive().nullable().optional(),
  stockQuantity: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  addonIds: z.array(z.string().uuid()).optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { productId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const { archive, ...fields } = parsed.data;
  if (archive) {
    const archived = await archiveAdminProduct(productId);
    if (!archived.ok) {
      return NextResponse.json(
        { error: archived.error },
        { status: httpStatusFor(archived.error.code) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const result = await updateAdminProduct({
    productId,
    ...fields,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ product: result.data });
}
