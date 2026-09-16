import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { deleteBanner, updateBanner } from '@/modules/admin/banners/crud';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ bannerId: string }> };

const patchSchema = z.object({
  linkHref: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { bannerId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'Dados do banner inválidos.' },
      },
      { status: 400 },
    );
  }

  const result = await updateBanner(bannerId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ banner: result.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { bannerId } = await context.params;
  const result = await deleteBanner(bannerId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
