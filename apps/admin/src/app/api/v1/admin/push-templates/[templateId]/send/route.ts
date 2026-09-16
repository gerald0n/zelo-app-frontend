import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { sendPushTemplateNow } from '@/modules/admin/push-templates/send';

export const dynamic = 'force-dynamic';
// Envio sequencial em levas pode passar do limite padrão com muitos clientes.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  const result = await sendPushTemplateNow(templateId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
