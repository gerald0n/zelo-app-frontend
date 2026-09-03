import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCronSecret } from '@/config/env';
import { logger } from '@/lib/logger';
import { reconcilePendingPixOrders } from '@/modules/payments';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Reconciliação de pagamentos Pix pendentes. Agendada pelo Supabase Cron
 * (`pg_cron` + `pg_net`, ver `supabase/cron/reconcile-pix.sql`), que envia
 * `Authorization: Bearer <CRON_SECRET>`. Confirma pedidos pagos cujo webhook
 * se perdeu e falha os Pix expirados.
 */
/** Comparação em tempo constante, resistente a timing attack. */
function safeEqual(a: string | null, b: string): boolean {
  if (!a) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function handle(request: Request) {
  const secret = getCronSecret();
  const authorized = secret
    ? safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)
    : false;

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await reconcilePendingPixOrders();
  if (!result.ok) {
    logger.error('Reconciliação Pix falhou', { code: result.error.code });
    return NextResponse.json({ error: result.error.code }, { status: 500 });
  }

  logger.info('Reconciliação Pix concluída', result.data);
  return NextResponse.json(result.data);
}

export const GET = handle;
export const POST = handle;
