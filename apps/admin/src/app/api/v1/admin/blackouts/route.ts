import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createAdminBlackout,
  listAdminBlackouts,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  reason: z.string().trim().max(300).nullable().optional(),
});

export async function GET() {
  const result = await listAdminBlackouts();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ blackouts: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados do bloqueio inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAdminBlackout(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ blackout: result.data }, { status: 201 });
}
