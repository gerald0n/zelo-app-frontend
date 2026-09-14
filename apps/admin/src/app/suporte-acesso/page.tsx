'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { ApiError, apiJson } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import { adminKeys } from '@/lib/query-keys';

type OtpSupportStatus = 'pending' | 'approved' | 'consumed' | 'expired';

type AdminOtpSupportRequest = {
  id: string;
  phoneE164: string;
  requestedAt: string;
  approvedAt: string | null;
  consumedAt: string | null;
  expiresAt: string | null;
  status: OtpSupportStatus;
};

const STATUS_LABEL: Record<OtpSupportStatus, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovado — aguardando o cliente entrar',
  consumed: 'Usado',
  expired: 'Expirado',
};

const STATUS_COLOR: Record<OtpSupportStatus, string> = {
  pending: 'bg-tone-warning text-tone-warning-foreground',
  approved: 'bg-primary/15 text-primary',
  consumed: 'bg-success/15 text-success',
  expired: 'bg-muted text-muted-foreground',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SuporteAcessoContent() {
  const { ready, isAuthenticated } = useRequireAdmin();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('requestId');
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');

  const query = useQuery({
    queryKey: adminKeys.otpSupportRequests(),
    enabled: ready && isAuthenticated,
    refetchInterval: 20_000,
    queryFn: () =>
      apiJson<{ requests: AdminOtpSupportRequest[] }>(
        '/api/v1/admin/otp-support',
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiJson(`/api/v1/admin/otp-support/${requestId}/approve`, {
        method: 'POST',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: adminKeys.otpSupportRequests(),
      }),
  });

  const quickApproveMutation = useMutation({
    mutationFn: (phoneValue: string) =>
      apiJson('/api/v1/admin/otp-support', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneValue }),
      }),
    onSuccess: () => {
      setPhone('');
      return queryClient.invalidateQueries({
        queryKey: adminKeys.otpSupportRequests(),
      });
    },
  });

  const requests = query.data?.requests ?? [];
  const errorMsg =
    quickApproveMutation.error instanceof ApiError
      ? quickApproveMutation.error.message
      : quickApproveMutation.error
        ? 'Não foi possível aprovar o acesso.'
        : null;

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3.5 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-widest text-primary">
          Acesso
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Suporte de acesso
        </h1>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          Cliente sem sinal pra receber o SMS pede ajuda pelo WhatsApp e cai
          aqui. Confirme a identidade pela conversa e aprove — nenhum código é
          mostrado, o telefone só fica liberado por 15 minutos pra o cliente
          concluir sozinho na tela dele.
        </p>
      </header>

      <section className="space-y-2 rounded-xl border border-border bg-card p-3.5">
        <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">
          Aprovar direto (sem solicitação registrada)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(88) 99999-9999"
            className="flex-1"
          />
          <button
            type="button"
            disabled={!phone.trim() || quickApproveMutation.isPending}
            onClick={() => quickApproveMutation.mutate(phone)}
            className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {quickApproveMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Aprovar acesso
          </button>
        </div>
        {errorMsg ? (
          <p className="text-2xs text-destructive">{errorMsg}</p>
        ) : null}
      </section>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma solicitação de acesso ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3.5 py-2.5">Telefone</th>
                <th className="px-3.5 py-2.5">Pedido às</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className={cn(
                    'border-b border-border last:border-b-0',
                    request.id === highlightId && 'bg-primary/5',
                  )}
                >
                  <td className="px-3.5 py-2.5 font-semibold">
                    {formatPhoneDisplay(request.phoneE164)}
                  </td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">
                    {formatDateTime(request.requestedAt)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold',
                        STATUS_COLOR[request.status],
                      )}
                    >
                      {STATUS_LABEL[request.status]}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {request.status === 'pending' ? (
                      <button
                        type="button"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(request.id)}
                        className="text-xs font-semibold text-primary underline disabled:opacity-50"
                      >
                        Aprovar acesso
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SuporteAcessoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SuporteAcessoContent />
    </Suspense>
  );
}
