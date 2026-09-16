import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createAdminPizzaAddon,
  listAdminPizzaAddons,
} from '@/modules/admin/catalog/pizza';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  priceHalfCents: z.number().int().min(0).max(1_000_000),
  priceFullCents: z.number().int().min(0).max(1_000_000),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const result = await listAdminPizzaAddons();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ pizzaAddons: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados do adicional de pizza inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAdminPizzaAddon(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ pizzaAddon: result.data }, { status: 201 });
}
