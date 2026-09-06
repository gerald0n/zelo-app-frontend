import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import { hasCustomerName } from '@/modules/auth/customer-name';
import { verifyCustomerOtp } from '@/modules/auth/otp';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  phone: z.string().min(10),
  code: z.string().min(6).max(6),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'OTP_INVALID',
          message: 'Código inválido.',
        },
      },
      { status: 401 },
    );
  }

  const limited = await enforceIpRateLimit({
    kind: 'otp_verify',
    ip: clientIpFromRequest(request),
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const result = await verifyCustomerOtp(parsed.data);
  if (!result.ok) return jsonError(result.error);

  return NextResponse.json({
    customer: {
      id: result.data.customer.id,
      name: result.data.customer.name,
      phoneE164: result.data.customer.phoneE164,
      needsName: !hasCustomerName(result.data.customer.name),
    },
  });
}
