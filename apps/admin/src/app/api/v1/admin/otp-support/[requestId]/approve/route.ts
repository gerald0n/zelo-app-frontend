import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { approveAdminOtpSupportRequest } from '@/modules/admin/otp-support';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { requestId } = await context.params;
  const result = await approveAdminOtpSupportRequest(requestId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
