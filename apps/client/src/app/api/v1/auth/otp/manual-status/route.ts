import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import { hasCustomerName } from '@/modules/auth/customer-name';
import { checkAndConsumeApproval } from '@/modules/auth/otp-manual-approval';
import { enforceIpRateLimit } from '@/modules/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Consultado pela tela de OTP em polling — quando o admin aprova o acesso
 * em `/suporte-acesso`, essa rota já consome a aprovação e abre a sessão,
 * no mesmo formato de resposta de `/otp/verify`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  if (!phone) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Telefone ausente.' } },
      { status: 400 },
    );
  }

  const limited = await enforceIpRateLimit({
    kind: 'otp_manual_status',
    ip: clientIpFromRequest(request),
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const result = await checkAndConsumeApproval(phone);
  if (!result.ok) return jsonError(result.error);

  if (!result.data) {
    return NextResponse.json({ approved: false });
  }

  return NextResponse.json({
    approved: true,
    customer: {
      id: result.data.customer.id,
      name: result.data.customer.name,
      phoneE164: result.data.customer.phoneE164,
      needsName: !hasCustomerName(result.data.customer.name),
    },
  });
}
