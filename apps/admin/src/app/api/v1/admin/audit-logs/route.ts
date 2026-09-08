import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listAdminAuditLogs } from '@/modules/admin/audit';

export const dynamic = 'force-dynamic';

const ALLOWED_PREFIXES = new Set([
  'product',
  'category',
  'store',
  'order',
  'promotion',
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const limitRaw = Number(searchParams.get('limit') ?? '40');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 40;

  const prefixRaw = searchParams.get('action') ?? '';
  const actionPrefix = ALLOWED_PREFIXES.has(prefixRaw) ? prefixRaw : undefined;

  const daysRaw = Number(searchParams.get('days') ?? '');
  let since: string | undefined;
  if (Number.isFinite(daysRaw) && daysRaw > 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysRaw);
    since = d.toISOString();
  }

  const result = await listAdminAuditLogs({ limit, actionPrefix, since });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ logs: result.data });
}
