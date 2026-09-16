import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCronSecret } from '@/config/env';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendScheduledPushTemplate } from '@/modules/admin/push-templates/send';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Dispara os modelos de push agendados cujo horário já chegou. Agendada pelo
 * Supabase Cron (`pg_cron` + `pg_net`, ver
 * `supabase/cron/send-scheduled-pushes.sql`), que envia
 * `Authorization: Bearer <CRON_SECRET>` — mesmo segredo do reconcile-pix.
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

  const admin = createAdminSupabaseClient();
  const { data: due, error } = await admin
    .from('push_templates')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString());

  if (error) {
    logger.error('Cron de push agendado: falha ao buscar modelos', { error });
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of due ?? []) {
    // Update condicional = trava otimista: só segue se ainda estava
    // 'scheduled' aqui (evita disparo duplicado se o cron rodar em paralelo).
    const { data: claimed, error: claimError } = await admin
      .from('push_templates')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (claimError || !claimed) {
      skipped += 1;
      continue;
    }

    const result = await sendScheduledPushTemplate(row.id);
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      logger.error('Cron de push agendado: falha ao enviar', {
        templateId: row.id,
        code: result.error.code,
      });
    }
  }

  const payload = { due: due?.length ?? 0, sent, skipped, failed };
  logger.info('Cron de push agendado concluído', payload);
  return NextResponse.json(payload);
}

export const GET = handle;
export const POST = handle;
