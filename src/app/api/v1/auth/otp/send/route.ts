import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import { sendCustomerOtp } from '@/modules/auth/otp';
import { rejectHoneypot, enforceIpRateLimit } from '@/modules/security/rate-limit';
import { verifyTurnstileToken } from '@/modules/security/turnstile';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  phone: z.string().min(10),
  captchaToken: z.string().optional(),
  website: z.string().optional(),
});

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

  const honeypot = rejectHoneypot(parsed.data.website);
  if (!honeypot.ok) return jsonError(honeypot.error);

  const ip = clientIpFromRequest(request);
  const limited = await enforceIpRateLimit({
    kind: 'otp_send',
    ip,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const captcha = await verifyTurnstileToken(parsed.data.captchaToken, ip);
  if (!captcha.ok) return jsonError(captcha.error);

  const result = await sendCustomerOtp({ phone: parsed.data.phone });
  if (!result.ok) return jsonError(result.error);

  return NextResponse.json({
    expiresInSeconds: result.data.expiresInSeconds,
    debugCode: result.data.debugCode,
    deliveredVia: result.data.deliveredVia,
  });
}
