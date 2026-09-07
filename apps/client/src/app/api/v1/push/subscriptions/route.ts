import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  revokePushSubscription,
  upsertPushSubscription,
} from '@/modules/notifications/subscriptions';

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().nullable().optional(),
});

const revokeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Assinatura push inválida.',
        },
      },
      { status: 400 },
    );
  }

  const result = await upsertPushSubscription({
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys,
    userAgent:
      parsed.data.userAgent ??
      request.headers.get('user-agent'),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ subscription: result.data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = revokeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Endpoint inválido.',
        },
      },
      { status: 400 },
    );
  }

  const result = await revokePushSubscription(parsed.data.endpoint);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({ ok: true, ...result.data });
}
