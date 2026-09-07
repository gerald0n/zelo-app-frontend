import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  archiveAdminCategory,
  updateAdminCategory,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ categoryId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { categoryId } = await context.params;
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
    const archived = await archiveAdminCategory(categoryId);
    if (!archived.ok) {
      return NextResponse.json(
        { error: archived.error },
        { status: httpStatusFor(archived.error.code) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const result = await updateAdminCategory({
    categoryId,
    name: parsed.data.name,
    description: parsed.data.description,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ category: result.data });
}
