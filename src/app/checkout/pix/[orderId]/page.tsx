'use client';

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Copy,
  Loader2,
  QrCode,
  RefreshCw,
  TimerReset,
  XCircle,
} from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { useCustomerOrderRealtime } from '@/modules/realtime/hooks';
import {
  pageBodyPadClass,
  pageHeaderBarClass,
  pagePrimaryButtonClass,
  checkoutDesktopContainerClass,
} from '@/lib/layout';
import { cn } from '@/lib/cn';

type PixView = {
  orderId: string;
  orderNumber: number;
  totalCents: number;
  status: string;
  paymentStatus: string;
  pix: {
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string | null;
    expiresAt: string;
  } | null;
};

function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function PixContent({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [view, setView] = useState<PixView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const redirectedRef = useRef(false);

  const { version: realtimeVersion } = useCustomerOrderRealtime(orderId, true);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      try {
        const response = await fetch(`/api/v1/orders/${orderId}/pix`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json?.error?.message ?? 'Não foi possível carregar o Pix.');
          return;
        }
        setView(json as PixView);
        setError(null);
      } catch {
        setError('Falha de rede ao carregar o pagamento.');
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [orderId],
  );

  // Carga inicial.
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Sinal do Realtime → refetch em segundo plano.
  useEffect(() => {
    if (realtimeVersion === 0) return;
    void load({ background: true });
  }, [realtimeVersion, load]);

  // Fallback: enquanto aguardando pagamento, refetch a cada 5s.
  useEffect(() => {
    if (view?.paymentStatus && view.paymentStatus !== 'pending') return;
    const timer = window.setInterval(() => {
      void load({ background: true });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [view?.paymentStatus, load]);

  // Relógio do contador.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  // Pagamento confirmado → tela de pedido recebido.
  useEffect(() => {
    if (!view || redirectedRef.current) return;
    if (view.paymentStatus === 'confirmed') {
      redirectedRef.current = true;
      router.replace(
        `/pedido-recebido?orderId=${encodeURIComponent(view.orderId)}&orderNumber=${view.orderNumber}`,
      );
    }
  }, [view, router]);

  const handleCopy = async () => {
    if (!view?.pix) return;
    try {
      await navigator.clipboard.writeText(view.pix.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3_000);
    } catch {
      setError('Não foi possível copiar. Selecione o código manualmente.');
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/pix`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) {
        setError(
          json?.error?.message ?? 'Não foi possível gerar um novo código.',
        );
        return;
      }
      setView(json as PixView);
      setError(null);
    } catch {
      setError('Falha de rede ao gerar um novo código.');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !view) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/pedidos" className="text-sm font-medium text-primary">
          Ver meus pedidos
        </Link>
      </div>
    );
  }

  const paymentFailed =
    view?.paymentStatus === 'failed' || view?.status === 'cancelled';
  const expiresAt = view?.pix ? new Date(view.pix.expiresAt).getTime() : 0;
  const msLeft = expiresAt - now;
  const expired = !paymentFailed && (!view?.pix || msLeft <= 0);
  const confirmed = view?.paymentStatus === 'confirmed';

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <span className="w-6" />
        <h1 className="text-lg font-semibold">Pagamento Pix</h1>
        <span className="w-6" />
      </header>

      <div
        className={cn(
          'space-y-4',
          pageBodyPadClass,
          checkoutDesktopContainerClass,
        )}
      >
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <span className="text-sm text-muted-foreground">
            Pedido #{view?.orderNumber}
          </span>
          <span className="text-xl font-bold tabular-nums">
            {view ? formatCatalogPrice(view.totalCents) : '—'}
          </span>
        </div>

        {confirmed ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-6 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="text-base font-semibold">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground">Redirecionando…</p>
          </div>
        ) : paymentFailed ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <XCircle className="size-10 text-destructive" />
            <p className="text-base font-semibold">Pagamento não concluído</p>
            <p className="text-sm text-muted-foreground">
              Este pedido foi cancelado por falta de pagamento. Monte o pedido
              novamente para tentar de novo.
            </p>
            <Link
              href="/"
              className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Voltar ao cardápio
            </Link>
          </div>
        ) : expired ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
            <TimerReset className="size-10 text-muted-foreground" />
            <p className="text-base font-semibold">O código Pix expirou</p>
            <p className="text-sm text-muted-foreground">
              Gere um novo código para concluir o pagamento deste pedido.
            </p>
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className={cn(pagePrimaryButtonClass, 'mt-1 w-auto px-5')}
            >
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Gerar novo código
            </button>
          </div>
        ) : view?.pix ? (
          <>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="rounded-lg bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${view.pix.qrCodeBase64}`}
                  alt="QR Code Pix"
                  width={220}
                  height={220}
                  className="size-[220px]"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Expira em{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCountdown(msLeft)}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold',
                copied
                  ? 'bg-success text-success-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {copied ? (
                <CheckCircle2 className="size-[18px]" />
              ) : (
                <Copy className="size-[18px]" />
              )}
              {copied ? 'Código copiado!' : 'Copiar código Pix'}
            </button>

            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-[18px] text-primary" />
                <p className="text-sm font-semibold">Como pagar</p>
              </div>
              <p className="text-sm leading-5 text-muted-foreground">
                1. Abra o app do seu banco
                <br />
                2. Escolha pagar com Pix — QR Code ou &quot;copia e cola&quot;
                <br />
                3. Confirme o valor de{' '}
                {view ? formatCatalogPrice(view.totalCents) : ''}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Aguardando confirmação do pagamento…
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Assim que o pagamento cair, esta tela avança sozinha. Você pode
              acompanhar pelos seus pedidos.
            </p>
          </>
        ) : null}

        {error && view ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Link
          href="/pedidos"
          className="block py-2 text-center text-sm font-medium text-primary"
        >
          Ver meus pedidos
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutPixPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PixContent orderId={orderId} />
    </Suspense>
  );
}
