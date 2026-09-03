'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import('@sentry/nextjs').then((Sentry) =>
      Sentry.captureException(error),
    );
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: '#f7f1e6',
          color: '#3a2a20',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          A Zelo teve uma falha inesperada
        </h1>
        <p style={{ maxWidth: '24rem', fontSize: '0.875rem', opacity: 0.75 }}>
          Recarregue a página. Se continuar, tente de novo em alguns minutos.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '1rem',
            border: 0,
            borderRadius: '0.375rem',
            background: '#7a1f2b',
            color: '#fff',
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
