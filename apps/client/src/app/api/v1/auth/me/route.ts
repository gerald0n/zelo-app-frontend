import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { hasCustomerName } from '@/modules/auth/customer-name';
import { updateCustomerProfile } from '@/modules/customers/profile';
import { resolveCustomerForCheckout } from '@/modules/orders/customer';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
});

export async function GET() {
  const identity = await resolveCustomerForCheckout();
  if (!identity.ok) return jsonError(identity.error);

  return NextResponse.json({
    customer: {
      id: identity.data.id,
      name: identity.data.name,
      phoneE164: identity.data.phoneE164,
      needsName: !hasCustomerName(identity.data.name),
    },
  });
}

export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const result = await updateCustomerProfile(parsed.data);
  if (!result.ok) return jsonError(result.error);

  return NextResponse.json({
    customer: {
      id: result.data.id,
      name: result.data.name,
      phoneE164: result.data.phoneE164,
      needsName: !hasCustomerName(result.data.name),
    },
  });
}
