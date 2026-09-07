import * as Sentry from '@sentry/nextjs';
import { getAppEnv, isProductionLike } from '@/config/env';
import type { AppError } from '@/lib/errors';

const SENSITIVE_KEY =
  /(password|token|secret|authorization|cookie|otp|api[_-]?key|service[_-]?role)/i;

function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (Array.isArray(value)) {
    return value.map((item, index) => scrubValue(String(index), item));
  }
  if (value && typeof value === 'object') {
    return scrubObject(value as Record<string, unknown>);
  }
  return value;
}

export function scrubObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = scrubValue(key, value);
  }
  return output;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function write(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    env: getAppEnv(),
    ...(meta ? { meta: scrubObject(meta) } : {}),
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }
  if (!isProductionLike()) {
    console.info(JSON.stringify(payload));
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    write('debug', message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    write('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write('warn', message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    write('error', message, meta);
  },
  captureAppError(error: AppError, meta?: Record<string, unknown>) {
    write('error', error.message, {
      code: error.code,
      details: error.details,
      ...meta,
    });
    if (
      error.code === 'INTERNAL_ERROR' ||
      error.code === 'INTEGRATION_UNAVAILABLE'
    ) {
      Sentry.captureException(error.cause ?? new Error(error.message), {
        extra: scrubObject({
          code: error.code,
          details: error.details ?? {},
          ...meta,
        }),
      });
    }
  },
};
