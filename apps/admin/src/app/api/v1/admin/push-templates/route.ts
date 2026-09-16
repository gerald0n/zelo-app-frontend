import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  createPushTemplate,
  listPushTemplates,
} from '@/modules/admin/push-templates/crud';

export const dynamic = 'force-dynamic';

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(180),
    url: z.string().trim().min(1).max(300).nullable().optional(),
    mode: z.enum(['manual', 'scheduled']),
    scheduledAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (input) => input.mode !== 'scheduled' || Boolean(input.scheduledAt),
    { message: 'Informe o dia e horário do agendamento.', path: ['scheduledAt'] },
  );

export async function GET() {
  const result = await listPushTemplates();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ templates: result.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados do modelo inválidos.' } },
      { status: 400 },
    );
  }

  const result = await createPushTemplate(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ template: result.data }, { status: 201 });
}
