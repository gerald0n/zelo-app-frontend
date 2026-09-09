'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdmin } from '@/contexts/AdminContext';
import { adminKeys } from '@/lib/query-keys';
import {
  useAdminOrdersRealtime,
  type RealtimeStatus,
} from '@/modules/realtime/hooks';

type AdminRealtimeValue = { version: number; status: RealtimeStatus };

const AdminRealtimeContext = createContext<AdminRealtimeValue>({
  version: 0,
  status: 'idle',
});

/**
 * Abre um único canal realtime do painel e o compartilha. A sidebar mostra o
 * status "Ao vivo"; o `version` (já com debounce no hook) dispara **uma**
 * invalidação das queries derivadas de pedido — o React Query só refaz as
 * que estão montadas e mantém os dados na tela enquanto revalida (sem flash).
 *
 * As telas não devem mais colocar `version` no `queryKey` (isso troca a
 * identidade da query e volta a piscar o spinner a cada evento).
 */
export function AdminRealtimeProvider({ children }: { children: ReactNode }) {
  const { ready, isAuthenticated } = useAdmin();
  const queryClient = useQueryClient();
  const realtime = useAdminOrdersRealtime(ready && isAuthenticated);
  const { version } = realtime;

  useEffect(() => {
    if (version === 0) return;
    for (const prefix of ['orders', 'order', 'reports'] as const) {
      void queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, prefix],
      });
    }
  }, [version, queryClient]);

  return (
    <AdminRealtimeContext.Provider value={realtime}>
      {children}
    </AdminRealtimeContext.Provider>
  );
}

export function useAdminRealtime() {
  return useContext(AdminRealtimeContext);
}
