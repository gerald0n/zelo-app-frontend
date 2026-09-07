'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, Pause, Loader2 } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import type { CatalogStore } from '@/modules/catalog/types';
import { cn } from '@/lib/cn';

type StoreResponse = {
  store: CatalogStore | null;
  acceptingOrders: boolean;
};

type Props = {
  /** Só o ícone, para a sidebar recolhida. */
  compact?: boolean;
};

/**
 * Pausar / retomar a loja a partir da sidebar do admin — disponível em
 * qualquer página. Confirma antes de aplicar e atualiza de forma otimista.
 */
export default function AdminStoreToggle({ compact = false }: Props) {
  const { ready, isAuthenticated } = useAdmin();
  const { confirm } = useAppDialog();
  const queryClient = useQueryClient();
  const enabled = ready && isAuthenticated;

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled,
    queryFn: () => apiJson<StoreResponse>('/api/v1/admin/store'),
  });

  const toggleMutation = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify({ acceptingOrders }),
      }),
    onMutate: async (acceptingOrders) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.store() });
      const previous = queryClient.getQueryData<StoreResponse>(
        adminKeys.store(),
      );
      if (previous) {
        queryClient.setQueryData<StoreResponse>(adminKeys.store(), {
          ...previous,
          acceptingOrders,
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(adminKeys.store(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.store() });
    },
  });

  if (!enabled || !storeQuery.data) return null;

  const accepting = storeQuery.data.acceptingOrders;
  const pending = toggleMutation.isPending;

  const handleClick = async () => {
    const ok = await confirm(
      accepting
        ? {
            title: 'Pausar a loja?',
            description:
              'Clientes não conseguirão finalizar novos pedidos enquanto estiver pausada.',
            confirmLabel: 'Pausar loja',
            tone: 'destructive',
          }
        : {
            title: 'Retomar os pedidos?',
            description: 'A loja volta a aceitar novos pedidos imediatamente.',
            confirmLabel: 'Retomar loja',
          },
    );
    if (!ok) return;
    toggleMutation.mutate(!accepting);
  };

  const label = accepting ? 'Loja recebendo' : 'Operação pausada';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={accepting}
      title={label}
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
  );
}
