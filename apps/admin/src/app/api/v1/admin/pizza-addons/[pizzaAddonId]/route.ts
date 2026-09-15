import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  archiveAdminPizzaAddon,
  updateAdminPizzaAddon,
} from '@/modules/admin/catalog/pizza';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pizzaAddonId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  priceHalfCents: z.number().int().min(0).max(1_000_000).optional(),
  priceFullCents: z.number().int().min(0).max(1_000_000).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { pizzaAddonId } = await context.params;
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

  if (parsed.data.archive) {
    const archived = await archiveAdminPizzaAddon(pizzaAddonId);
    if (!archived.ok) {
      return NextResponse.json(
        { error: archived.error },
        { status: httpStatusFor(archived.error.code) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const result = await updateAdminPizzaAddon({
    pizzaAddonId,
    name: parsed.data.name,
    description: parsed.data.description,
    priceHalfCents: parsed.data.priceHalfCents,
    priceFullCents: parsed.data.priceFullCents,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ pizzaAddon: result.data });
}
