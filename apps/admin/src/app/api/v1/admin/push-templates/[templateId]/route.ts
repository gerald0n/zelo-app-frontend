import { NextResponse } from 'next/server';
import { z } from 'zod';
import { httpStatusFor } from '@/lib/errors';
import {
  deletePushTemplate,
  updatePushTemplate,
} from '@/modules/admin/push-templates/crud';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ templateId: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  body: z.string().trim().min(1).max(180).optional(),
  url: z.string().trim().min(1).max(300).nullable().optional(),
  mode: z.enum(['manual', 'scheduled']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Dados do modelo inválidos.' } },
      { status: 400 },
    );
  }

  const result = await updatePushTemplate(templateId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ template: result.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  const result = await deletePushTemplate(templateId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ ok: true });
}
