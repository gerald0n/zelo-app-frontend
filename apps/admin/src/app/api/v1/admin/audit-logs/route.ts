import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listAdminAuditLogs } from '@/modules/admin/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get('limit') ?? '40');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 40;

  const result = await listAdminAuditLogs(limit);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ logs: result.data });
}
