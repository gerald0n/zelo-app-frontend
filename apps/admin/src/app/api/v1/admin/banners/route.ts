import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { createBanner, listAdminBanners } from '@/modules/admin/banners/crud';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  linkHref: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET() {
  const result = await listAdminBanners();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ banners: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'Dados do banner inválidos.' },
      },
      { status: 400 },
    );
  }

  const result = await createBanner(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ banner: result.data }, { status: 201 });
}
