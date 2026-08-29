import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { createAdminAddon, listAdminAddons } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export async function GET() {
  const result = await listAdminAddons();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ addons: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados do adicional inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAdminAddon(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ addon: result.data }, { status: 201 });
}
