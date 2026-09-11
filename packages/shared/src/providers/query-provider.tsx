'use client';

import { useState } from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { emitApiError } from '@/lib/api-error-bus';

function reportQueryError(error: unknown) {
  const message =
    error instanceof ApiError
      ? error.message
      : 'Não foi possível concluir a operação. Verifique sua conexão.';
  emitApiError(message);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: reportQueryError }),
        mutationCache: new MutationCache({ onError: reportQueryError }),
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
