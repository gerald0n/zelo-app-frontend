'use client';

import { Suspense, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderTracking } from '@/app/acompanhamento/[id]/useOrderTracking';
import { OrderTimeline } from '@/app/acompanhamento/[id]/_components/OrderTimeline';
import { OrderSummary } from '@/app/acompanhamento/[id]/_components/OrderSummary';

function AcompanhamentoContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const router = useRouter();

  const { order, loading, error, reordering, reorder } = useOrderTracking(id);

  if (loading && !order) {
    return (
      <div
        className="mx-auto w-full max-w-md space-y-3.5 px-4 py-5"
        aria-label="Carregando pedido"
      >
        <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-5 text-center">
          <Skeleton className="mx-auto size-16 rounded-full" />
          <Skeleton className="mx-auto h-6 w-40" />
          <Skeleton className="mx-auto h-3 w-56" />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-destructive">
          {error ?? 'Pedido não encontrado.'}
        </p>
        <Link href="/pedidos" className="text-sm font-medium text-primary">
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background lg:max-w-5xl">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-3 py-2.5 lg:px-0">
        <button
          type="button"
          aria-label="Voltar aos pedidos"
          onClick={() =>
            from === 'confirmation'
              ? router.replace('/pedidos')
              : router.push('/pedidos')
          }
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="font-serif text-lg font-semibold text-foreground">
          Pedido {order.number}
        </h1>
        <span className="w-10" aria-hidden="true" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 pb-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:px-0">
        <OrderTimeline order={order} />
        <OrderSummary
          order={order}
          reordering={reordering}
          onReorder={() => void reorder()}
        />
      </div>
    </div>
  );
}

export default function AcompanhamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <AcompanhamentoContent id={id} />
    </Suspense>
  );
}
