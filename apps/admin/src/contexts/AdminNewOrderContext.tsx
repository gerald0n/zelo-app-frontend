'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NewOrderModal } from '@/app/pedidos/novo/NewOrderModal';

const AdminNewOrderContext = createContext<{ open: () => void }>({
  open: () => {},
});

/**
 * Disponibiliza o modal "Nova comanda" em qualquer tela do painel (a sidebar
 * chama `open()`). A rota `/pedidos/novo` segue existindo para deep-link.
 */
export function AdminNewOrderProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AdminNewOrderContext.Provider value={{ open }}>
      {children}
      <NewOrderModal
        open={isOpen}
        onClose={close}
        onCreated={() => {
          setIsOpen(false);
          if (pathname !== '/pedidos') router.push('/pedidos');
        }}
      />
    </AdminNewOrderContext.Provider>
  );
}

export function useNewOrder() {
  return useContext(AdminNewOrderContext);
}
