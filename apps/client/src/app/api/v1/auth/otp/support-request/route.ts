import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import { createSupportRequest } from '@/modules/auth/otp-manual-approval';
import { notifyAdminOtpSupportRequest } from '@/modules/notifications/send';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  phone: z.string().min(10),
});

/**
 * Cliente clicou em "Fale com o suporte" na tela de OTP (só aparece depois
 * do primeiro reenvio) — registra o pedido e avisa o painel por push. A
 * aprovação em si acontece em `/suporte-acesso` no admin.
 */
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

  const limited = await enforceIpRateLimit({
    kind: 'otp_support_request',
    ip: clientIpFromRequest(request),
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const result = await createSupportRequest(parsed.data.phone);
  if (!result.ok) return jsonError(result.error);

  // `after` estende a vida da invocação até o push terminar — sem isso, em
  // serverless a função congela ao responder e a notificação se perde.
  after(() =>
    notifyAdminOtpSupportRequest({
      requestId: result.data.id,
      phoneE164: result.data.phoneE164,
    }),
  );

  return NextResponse.json({ ok: true });
}
