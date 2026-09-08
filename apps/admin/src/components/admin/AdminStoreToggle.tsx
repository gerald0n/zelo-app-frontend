'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, Pause, Loader2 } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { StorePauseDialog } from '@/components/admin/StorePauseDialog';
import { cn } from '@/lib/cn';

type StoreResponse = {
  acceptingOrders: boolean;
  pausedUntil: string | null;
  pauseReason: string | null;
};

type Props = {
  /** Só o ícone, para a sidebar recolhida. */
  compact?: boolean;
};

function backLabel(pausedUntil: string | null): string {
  if (!pausedUntil) return 'Operação pausada';
  const when = new Date(pausedUntil);
  const sameDay = when.toDateString() === new Date().toDateString();
  const time = when.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (sameDay) return `Pausada · volta ${time}`;
  const day = when.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  return `Pausada · volta ${day} ${time}`;
}

/**
 * Pausar / retomar a loja a partir da sidebar do admin. Pausar abre um
 * diálogo (duração + motivo); retomar confirma. Pausa com prazo volta
 * sozinha — o texto mostra quando.
 */
export default function AdminStoreToggle({ compact = false }: Props) {
  const { ready, isAuthenticated } = useAdmin();
  const { confirm } = useAppDialog();
  const queryClient = useQueryClient();
  const enabled = ready && isAuthenticated;
  const [dialogOpen, setDialogOpen] = useState(false);

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled,
    queryFn: () => apiJson<StoreResponse>('/api/v1/admin/store'),
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.store() });
    },
    onSuccess: () => setDialogOpen(false),
  });

  if (!enabled || !storeQuery.data) return null;

  const accepting = storeQuery.data.acceptingOrders;
  const pending = mutation.isPending;

  const handleResume = async () => {
    const ok = await confirm({
      title: 'Retomar os pedidos?',
      description: 'A loja volta a aceitar novos pedidos imediatamente.',
      confirmLabel: 'Retomar loja',
    });
    if (ok) mutation.mutate({ resume: true });
  };

  const label = accepting
    ? 'Loja recebendo'
    : backLabel(storeQuery.data.pausedUntil);

  return (
    <>
      <button
        type="button"
        onClick={() => (accepting ? setDialogOpen(true) : handleResume())}
        disabled={pending}
        aria-pressed={accepting}
        title={
          storeQuery.data.pauseReason
            ? `${label} — ${storeQuery.data.pauseReason}`
            : label
        }
        className={cn(
          'flex items-center rounded-lg border text-2xs font-semibold transition-colors disabled:opacity-60',
          compact ? 'justify-center p-2.5' : 'w-full gap-2 px-3 py-2.5',
          accepting
            ? 'border-success/40 bg-success/10 text-success hover:bg-success/15'
            : 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15',
        )}
      >
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : accepting ? (
          <Store className="size-4 shrink-0" />
        ) : (
          <Pause className="size-4 shrink-0" />
        )}
        {!compact ? <span className="flex-1 text-left">{label}</span> : null}
      </button>

      <StorePauseDialog
        open={dialogOpen}
        busy={pending}
        onCancel={() => setDialogOpen(false)}
        onConfirm={(until, reason) =>
          mutation.mutate({ pause: { until, reason } })
        }
      />
    </>
  );
}
