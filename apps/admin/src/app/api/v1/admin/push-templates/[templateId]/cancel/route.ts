import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { cancelScheduledPushTemplate } from '@/modules/admin/push-templates/crud';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  const result = await cancelScheduledPushTemplate(templateId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json({ template: result.data });
}
