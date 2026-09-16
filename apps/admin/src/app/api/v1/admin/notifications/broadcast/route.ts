import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { getBroadcastRecipientCount } from '@/modules/admin/notifications';

export const dynamic = 'force-dynamic';

/** Contagem de destinatários, usada pelos modelos de push pra montar a confirmação. */
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
