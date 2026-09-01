'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { pageCtaBaseClass, pageHeaderBarClass } from '@/lib/layout';
import { useAppDialog } from '@/contexts/AppDialogContext';

const REASON_SUGGESTIONS = [
  'Mudei de ideia',
  'Fiz o pedido errado',
  'Não poderei receber o pedido',
  'Outro motivo',
];

function CancelarPedidoContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber') ?? '#----';
  const router = useRouter();
  const { confirm } = useAppDialog();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = reason.trim().length >= 3 && Boolean(orderId);

  const handleCancel = async () => {
    if (!isValid || !orderId) return;
    const ok = await confirm({
      title: 'Cancelar pedido',
      description: `Tem certeza que deseja cancelar o pedido ${orderNumber}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Cancelar pedido',
      tone: 'destructive',
    });
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? 'Não foi possível cancelar.');
        setLoading(false);
        return;
      }
      router.replace(`/acompanhamento/${orderId}`);
    } catch {
      setError('Falha de rede ao cancelar o pedido.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className={pageHeaderBarClass}>
        <Link
          href={orderId ? `/acompanhamento/${orderId}` : '/pedidos'}
          aria-label="Voltar ao pedido"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Cancelar pedido</h1>
        <span className="w-6" />
      </header>

      <div className="flex-1 space-y-3 p-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="flex-1 text-sm leading-5">
            O pedido {orderNumber} será cancelado. Esta ação não pode ser
            desfeita.
          </p>
        </div>

        {!orderId ? (
          <p className="text-sm text-destructive">
            Pedido inválido. Volte e tente novamente.
          </p>
        ) : null}

        <p className="text-base font-semibold">
          Motivo do cancelamento <span className="text-destructive">*</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {REASON_SUGGESTIONS.map((s) => {
            const active = reason === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                className={cn(
                  'rounded-md border px-3.5 py-2 text-sm',
                  active
                    ? 'border-destructive bg-destructive/10 font-semibold text-destructive'
                    : 'border-border bg-card',
                )}
              >
                {s}
              </button>
            );
          })}
        </div>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Descreva o motivo"
          rows={3}
          className="min-h-[88px] w-full resize-none rounded-md border border-border bg-card p-3.5 text-base outline-none focus:border-primary"
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="border-t border-border px-3 pb-4 pt-2.5">
        <button
          type="button"
          disabled={!isValid || loading}
          onClick={() => void handleCancel()}
          className={cn(
            pageCtaBaseClass,
            'gap-2 text-white',
            isValid && !loading ? 'bg-destructive' : 'bg-muted text-muted-foreground',
          )}
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          {loading ? 'Cancelando…' : 'Confirmar cancelamento'}
        </button>
      </div>
    </div>
  );
}

export default function CancelarPedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      }
    >
      <CancelarPedidoContent />
    </Suspense>
  );
}
