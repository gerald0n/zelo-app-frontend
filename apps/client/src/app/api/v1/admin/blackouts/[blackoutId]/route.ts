import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { deleteAdminBlackout } from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ blackoutId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { blackoutId } = await context.params;
  const result = await deleteAdminBlackout(blackoutId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
