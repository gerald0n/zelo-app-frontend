import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getOrderPixView, regenerateOrderPixCharge } from '@/modules/payments';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ orderId: string }> };

/** Estado atual da cobrança Pix do pedido (a tela de pagamento faz polling aqui). */
export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await getOrderPixView(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}

/** Gera um novo código Pix quando o anterior expirou. */
export async function POST(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const result = await regenerateOrderPixCharge(orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
