import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  getAdminStore,
  getStoreAcceptingOrders,
  pauseStore,
  resumeStore,
  setStoreAcceptingOrders,
  updateAdminStore,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    acceptingOrders: z.boolean().optional(),
    resume: z.literal(true).optional(),
    pause: z
      .object({
        until: z.string().datetime().nullable().optional(),
        reason: z.string().trim().max(280).nullable().optional(),
      })
      .optional(),
    name: z.string().trim().min(1).max(120).optional(),
    cnpj: z.string().trim().max(20).nullable().optional(),
    phoneE164: z.string().trim().min(8).max(20).optional(),
    whatsappE164: z.string().trim().min(8).max(20).optional(),
    addressLine: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    state: z.string().trim().min(2).max(2).optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    freeDeliveryRadiusMeters: z.number().int().min(0).max(50_000).optional(),
    fixedDeliveryFeeCents: z.number().int().min(0).max(100_000).optional(),
    maxDeliveryRadiusMeters: z.number().int().min(0).max(50_000).optional(),
    paymentFeeEstimateBps: z.number().int().min(0).max(2000).optional(),
    acceptsPix: z.boolean().optional(),
    acceptsCash: z.boolean().optional(),
    acceptsCard: z.boolean().optional(),
    scheduleSlotTimes: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'))
      .min(1, 'Informe ao menos um horário de agendamento.')
      .max(48)
      .optional(),
  })
  .superRefine((value, ctx) => {
    const touched =
      typeof value.acceptsPix === 'boolean' ||
      typeof value.acceptsCash === 'boolean' ||
      typeof value.acceptsCard === 'boolean';
    if (!touched) return;
    if (
      value.acceptsPix === false &&
      value.acceptsCash === false &&
      value.acceptsCard === false
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mantenha ao menos uma forma de pagamento habilitada.',
        path: ['acceptsPix'],
      });
    }
    if (
      typeof value.freeDeliveryRadiusMeters === 'number' &&
      typeof value.maxDeliveryRadiusMeters === 'number' &&
      value.maxDeliveryRadiusMeters < value.freeDeliveryRadiusMeters
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'O raio máximo deve ser maior ou igual ao raio grátis.',
        path: ['maxDeliveryRadiusMeters'],
      });
    }
  });

export async function GET() {
  const [store, accepting] = await Promise.all([
    getAdminStore(),
    getStoreAcceptingOrders(),
  ]);
  if (!store.ok) {
    return NextResponse.json(
      { error: store.error },
      { status: httpStatusFor(store.error.code) },
    );
  }
  if (!accepting.ok) {
    return NextResponse.json(
      { error: accepting.error },
      { status: httpStatusFor(accepting.error.code) },
    );
  }

  return NextResponse.json({
    store: store.data,
    acceptingOrders: accepting.data.acceptingOrders,
    pausedUntil: accepting.data.pausedUntil,
    pauseReason: accepting.data.pauseReason,
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
          message: 'Dados da loja inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const keys = Object.keys(parsed.data);
  if (keys.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Nenhuma alteração informada.',
        },
      },
      { status: 400 },
    );
  }

  if (parsed.data.resume || parsed.data.pause) {
    const result = parsed.data.resume
      ? await resumeStore()
      : await pauseStore({
          pausedUntil: parsed.data.pause?.until ?? null,
          reason: parsed.data.pause?.reason ?? null,
        });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: httpStatusFor(result.error.code) },
      );
    }
    return NextResponse.json(result.data);
  }

  if (keys.length === 1 && typeof parsed.data.acceptingOrders === 'boolean') {
    const result = await setStoreAcceptingOrders(parsed.data.acceptingOrders);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: httpStatusFor(result.error.code) },
      );
    }
    return NextResponse.json(result.data);
  }

  const result = await updateAdminStore(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }

  return NextResponse.json({
    store: result.data,
    acceptingOrders:
      result.data.isOpenOverride !== false && result.data.pausedUntil == null,
    pausedUntil: result.data.pausedUntil,
    pauseReason: result.data.pauseReason,
  });
}
