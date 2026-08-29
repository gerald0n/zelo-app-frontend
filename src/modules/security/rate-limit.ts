import { createHash } from 'node:crypto';
import { err, ok, type Result } from '@/lib/errors';
import { getSupabaseServiceRoleKey } from '@/config/env';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const memoryHits = new Map<string, number[]>();

function hashBucket(kind: string, ip: string): string {
  const salt = getSupabaseServiceRoleKey().slice(0, 16);
  const digest = createHash('sha256')
    .update(`${kind}:${ip}:${salt}`)
    .digest('hex');
  return `${kind}:${digest}`;
}

function memoryAllow(bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (memoryHits.get(bucket) ?? []).filter(
    (at) => now - at < windowMs,
  );
  if (recent.length >= limit) {
    memoryHits.set(bucket, recent);
    return false;
  }
  recent.push(now);
  memoryHits.set(bucket, recent);
  return true;
}

export async function enforceIpRateLimit(options: {
  kind: string;
  ip: string;
  limit: number;
  windowMs: number;
}): Promise<Result<true>> {
  const bucket = hashBucket(options.kind, options.ip);
  const sinceIso = new Date(Date.now() - options.windowMs).toISOString();

  try {
    const admin = createAdminSupabaseClient();
    const counted = await admin
      .from('http_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .gte('created_at', sinceIso);

    if (!counted.error && (counted.count ?? 0) >= options.limit) {
      return err(
        'VALIDATION_ERROR',
        'Muitas tentativas. Aguarde alguns minutos.',
      );
    }

    if (!counted.error) {
      await admin.from('http_rate_limits').insert({ bucket });
      if (Math.random() < 0.05) {
        await admin
          .from('http_rate_limits')
          .delete()
          .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      }
      return ok(true);
    }
  } catch (cause) {
    logger.warn('Rate limit em memória (tabela indisponível)', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
  }

  if (!memoryAllow(bucket, options.limit, options.windowMs)) {
    return err(
      'VALIDATION_ERROR',
      'Muitas tentativas. Aguarde alguns minutos.',
    );
  }
  return ok(true);
}

export function rejectHoneypot(value: unknown): Result<true> {
  if (typeof value === 'string' && value.trim().length > 0) {
    return err('VALIDATION_ERROR', 'Não foi possível concluir. Tente de novo.');
  }
  return ok(true);
}
