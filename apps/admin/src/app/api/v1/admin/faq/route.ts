import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import { createFaqItem, listAdminFaqItems } from '@/modules/admin/faq/crud';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1000),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET() {
  const result = await listAdminFaqItems();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ items: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'Dados da pergunta inválidos.' },
      },
      { status: 400 },
    );
  }

  const result = await createFaqItem(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ item: result.data }, { status: 201 });
}
