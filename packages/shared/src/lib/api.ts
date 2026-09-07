export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: init?.cache ?? 'no-store',
  });

  const json = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;

  if (!response.ok) {
    throw new ApiError(
      json?.error?.code ?? 'INTERNAL_ERROR',
      json?.error?.message ?? 'Não foi possível concluir a operação.',
      response.status,
    );
  }

  return json as T;
}
