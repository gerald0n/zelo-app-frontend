import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { archiveAdminAddon, updateAdminAddon } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ addonId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { addonId } = await context.params;
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
    const archived = await archiveAdminAddon(addonId);
    if (!archived.ok) {
      return NextResponse.json(
        { error: archived.error },
        { status: httpStatusFor(archived.error.code) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const result = await updateAdminAddon({
    addonId,
    name: parsed.data.name,
    description: parsed.data.description,
    priceCents: parsed.data.priceCents,
    isActive: parsed.data.isActive,
    isAvailable: parsed.data.isAvailable,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ addon: result.data });
}
