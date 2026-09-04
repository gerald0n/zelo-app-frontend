import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { toPhoneE164 } from '@/lib/phone';
import {
  createManualAdminOrder,
  listAdminOrders,
} from '@/modules/admin/orders';

export const dynamic = 'force-dynamic';

const addOnSchema = z.object({
  addOnId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  customerNote: z.string().trim().max(500).nullable().optional(),
  addOns: z.array(addOnSchema).default([]),
});

const addressSchema = z.object({
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  neighborhood: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().length(2),
  postalCode: z.string().trim().nullable().optional(),
  complement: z.string().trim().nullable().optional(),
  referencePoint: z.string().trim().nullable().optional(),
});

const createManualOrderSchema = z.object({
  guestPhone: z.string().trim().min(8),
  guestName: z.string().trim().min(1).max(120),
  items: z.array(itemSchema).min(1),
  deliveryMethod: z.enum(['pickup', 'delivery']),
  timing: z.enum(['immediate', 'scheduled']),
  scheduledFor: z.string().datetime().nullable().optional(),
  address: addressSchema.nullable().optional(),
  deliveryFeeCents: z.number().int().min(0).optional(),
  paymentMethod: z.enum(['cash', 'card']),
  alreadyPaid: z.boolean().default(false),
  customerNote: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get('scope');
  const scope =
    scopeParam === 'active' ||
    scopeParam === 'scheduled' ||
    scopeParam === 'done' ||
    scopeParam === 'all'
      ? scopeParam
      : 'all';
  const q = searchParams.get('q') ?? undefined;

  const result = await listAdminOrders({ scope, q });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ orders: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createManualOrderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados da comanda inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const guestPhoneE164 = toPhoneE164(parsed.data.guestPhone);
  if (!guestPhoneE164) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Telefone inválido.',
        },
      },
      { status: 400 },
    );
  }

  const result = await createManualAdminOrder({
    guestName: parsed.data.guestName,
    guestPhoneE164,
    items: parsed.data.items,
    deliveryMethod: parsed.data.deliveryMethod,
    timing: parsed.data.timing,
    scheduledFor: parsed.data.scheduledFor,
    address: parsed.data.address,
    deliveryFeeCents: parsed.data.deliveryFeeCents,
    paymentMethod: parsed.data.paymentMethod,
    alreadyPaid: parsed.data.alreadyPaid,
    customerNote: parsed.data.customerNote,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ order: result.data }, { status: 201 });
}
