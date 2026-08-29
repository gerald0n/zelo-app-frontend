'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-serif text-3xl font-semibold tracking-tight text-foreground">
        Zelo
      </p>
      <h1 className="mt-6 font-serif text-2xl font-semibold">
        Algo não carregou
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Tivemos uma falha ao montar esta tela. Tente de novo — se persistir,
        volte ao cardápio e refaça o caminho.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-2xs text-muted-foreground/70">
          {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-150 active:scale-[0.98]"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-transform duration-150 active:scale-[0.98]"
        >
          Cardápio
        </Link>
      </div>
    </main>
  );
}
