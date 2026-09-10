import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  getPendingPixRefundCount,
  runPixRefundSweep,
} from '@/modules/admin/pix-refunds';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET: quantos estornos Pix estão pendentes. POST: processa o lote agora. */
export async function GET() {
  const result = await getPendingPixRefundCount();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}

export async function POST() {
  const result = await runPixRefundSweep();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
