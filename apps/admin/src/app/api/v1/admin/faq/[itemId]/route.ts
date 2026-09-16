import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { deleteFaqItem, updateFaqItem } from '@/modules/admin/faq/crud';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ itemId: string }> };

const patchSchema = z.object({
  question: z.string().trim().min(1).max(200).optional(),
  answer: z.string().trim().min(1).max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'Dados da pergunta inválidos.' },
      },
      { status: 400 },
    );
  }

  const result = await updateFaqItem(itemId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ item: result.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const result = await deleteFaqItem(itemId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
