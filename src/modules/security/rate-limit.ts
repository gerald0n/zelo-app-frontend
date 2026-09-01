import 'server-only';

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

const TOO_MANY = 'Muitas tentativas. Aguarde alguns minutos.';

export async function enforceIpRateLimit(options: {
  kind: string;
  ip: string;
  limit: number;
  windowMs: number;
}): Promise<Result<true>> {
  const bucket = hashBucket(options.kind, options.ip);

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_limit: options.limit,
      p_window_seconds: Math.max(1, Math.ceil(options.windowMs / 1000)),
    });

    if (!error) {
      return data === false ? err('VALIDATION_ERROR', TOO_MANY) : ok(true);
    }

    logger.warn('Rate limit em memória (RPC indisponível)', {
      message: error.message,
    });
  } catch (cause) {
    logger.warn('Rate limit em memória (RPC indisponível)', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });
  }

  // Fallback local: só útil se o Postgres estiver fora do ar. Em serverless
  // o Map não sobrevive entre invocações — é o melhor que dá sem o banco.
  if (!memoryAllow(bucket, options.limit, options.windowMs)) {
    return err('VALIDATION_ERROR', TOO_MANY);
  }
  return ok(true);
}

export function rejectHoneypot(value: unknown): Result<true> {
  if (typeof value === 'string' && value.trim().length > 0) {
    return err('VALIDATION_ERROR', 'Não foi possível concluir. Tente de novo.');
  }
  return ok(true);
}
