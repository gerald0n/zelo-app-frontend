import { NextResponse } from 'next/server';
import { getVapidPublicKey, hasWebPushConfig } from '@/config/env';
import { httpStatusFor } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: httpStatusFor(auth.error.code) },
    );
  }

  return NextResponse.json({
    enabled: hasWebPushConfig(),
    publicKey: getVapidPublicKey() ?? null,
  });
}
