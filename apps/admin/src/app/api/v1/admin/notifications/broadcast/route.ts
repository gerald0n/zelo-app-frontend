import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getBroadcastRecipientCount,
  sendCustomerBroadcast,
} from '@/modules/admin/notifications';

export const dynamic = 'force-dynamic';
// Envio sequencial em levas pode passar do limite padrão com muitos clientes.
export const maxDuration = 60;

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(180),
  url: z.string().trim().min(1).max(300).optional(),
});

export async function GET() {
  const result = await getBroadcastRecipientCount();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = broadcastSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Título e mensagem são obrigatórios.',
        },
      },
      { status: 400 },
    );
  }

  const result = await sendCustomerBroadcast({
    title: parsed.data.title,
    body: parsed.data.body,
    url: parsed.data.url ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
