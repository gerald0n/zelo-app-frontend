import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createAdminProduct,
  listAdminProducts,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000),
  slug: z.string().trim().min(1).max(80).optional(),
  weightMinGrams: z.number().int().positive().nullable().optional(),
  weightMaxGrams: z.number().int().positive().nullable().optional(),
  stockQuantity: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  addonIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  const result = await listAdminProducts();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ products: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados do produto inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAdminProduct(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ product: result.data }, { status: 201 });
}
