'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
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
 * Abre um único canal realtime do painel e o compartilha. Antes cada tela
 * (visão geral, quadro de pedidos) abria o seu; agora a sidebar mostra o
 * status "Ao vivo" com a mesma conexão que dispara os refetches.
 */
export function AdminRealtimeProvider({ children }: { children: ReactNode }) {
  const { ready, isAuthenticated } = useAdmin();
  const realtime = useAdminOrdersRealtime(ready && isAuthenticated);
  return (
    <AdminRealtimeContext.Provider value={realtime}>
      {children}
    </AdminRealtimeContext.Provider>
  );
}

export function useAdminRealtime() {
  return useContext(AdminRealtimeContext);
}
