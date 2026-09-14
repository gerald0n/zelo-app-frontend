import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createAndApproveAdminOtpSupportRequest,
  listAdminOtpSupportRequests,
} from '@/modules/admin/otp-support';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ phone: z.string().min(10) });

export async function GET() {
  const result = await listAdminOtpSupportRequests();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ requests: result.data });
}

/** Fallback: aprova um telefone direto, sem solicitação prévia do cliente. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Informe um celular válido.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createAndApproveAdminOtpSupportRequest(
    parsed.data.phone,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
