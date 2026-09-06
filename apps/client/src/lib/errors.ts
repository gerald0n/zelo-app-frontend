export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'OTP_INVALID'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PRODUCT_UNAVAILABLE'
  | 'CART_EXPIRED'
  | 'STORE_CLOSED'
  | 'OUT_OF_DELIVERY_AREA'
  | 'CANCELLATION_BLOCKED'
  | 'INTEGRATION_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type AppError = {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export type OkResult<T> = { ok: true; data: T };
export type ErrResult = { ok: false; error: AppError };
export type Result<T> = OkResult<T> | ErrResult;

export function ok<T>(data: T): OkResult<T> {
  return { ok: true, data };
}

export function err(
  code: AppErrorCode,
  message: string,
  options?: { details?: Record<string, unknown>; cause?: unknown },
): ErrResult {
  const error: AppError = { code, message };
  if (options?.details) {
    Object.defineProperty(error, 'details', {
      value: options.details,
      enumerable: false,
    });
  }
  if (options?.cause !== undefined) {
    Object.defineProperty(error, 'cause', {
      value: options.cause,
      enumerable: false,
    });
  }
  return { ok: false, error };
}

/** Corpo JSON seguro: nunca inclui cause, stack ou detalhes internos. */
export function publicErrorBody(error: AppError): {
  error: { code: AppErrorCode; message: string };
} {
  return { error: { code: error.code, message: error.message } };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

const HTTP_STATUS: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  OTP_INVALID: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  CART_EXPIRED: 409,
  STORE_CLOSED: 409,
  OUT_OF_DELIVERY_AREA: 409,
  CANCELLATION_BLOCKED: 409,
  INTEGRATION_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export function httpStatusFor(code: AppErrorCode): number {
  return HTTP_STATUS[code];
}

/** Mensagem segura para o usuário (sem detalhes técnicos). */
export function userMessageFor(error: AppError): string {
  return error.message;
}
