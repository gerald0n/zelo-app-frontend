import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createAdminPromotion,
  listAdminPromotions,
} from '@/modules/admin/promotions';

export const dynamic = 'force-dynamic';

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scope: z.enum(['store', 'category', 'products']),
    discountPercent: z.number().gt(0).max(100),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    productIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => data.scope !== 'category' || (data.categoryIds?.length ?? 0) > 0,
    { message: 'Selecione ao menos uma categoria.', path: ['categoryIds'] },
  )
  .refine(
    (data) => data.scope !== 'products' || (data.productIds?.length ?? 0) > 0,
    { message: 'Selecione ao menos um produto.', path: ['productIds'] },
  );

export async function GET() {
  const result = await listAdminPromotions();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ promotions: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados da promoção inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAdminPromotion(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ promotion: result.data }, { status: 201 });
}
