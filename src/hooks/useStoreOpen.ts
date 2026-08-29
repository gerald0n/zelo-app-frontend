'use client';

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api';
import { catalogKeys } from '@/lib/query-keys';
import { getCatalogStoreHoursLabel } from '@/modules/catalog/store-hours';
import { canPlaceImmediateOrder } from '@/modules/scheduling/schedule';
import type { CatalogStore } from '@/modules/catalog/types';

type StoreResponse = {
  store: CatalogStore | null;
  isOpen: boolean;
};

function useCatalogStoreQuery() {
  return useQuery({
    queryKey: catalogKeys.store(),
    queryFn: () => apiJson<StoreResponse>('/api/v1/catalog/store'),
    refetchInterval: 60_000,
  });
}

/** Aberto/fechado a partir da loja real (Supabase). */
export function useStoreOpen() {
  const { data } = useCatalogStoreQuery();
  const store = data?.store ?? null;

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!store) return () => undefined;
      const id = window.setInterval(onStoreChange, 30_000);
      return () => window.clearInterval(id);
    },
    () => (store ? canPlaceImmediateOrder(store) : Boolean(data?.isOpen)),
    () => true,
  );
}

export function useStoreHoursLabel() {
  const { data } = useCatalogStoreQuery();
  const store = data?.store;
  if (!store) return 'Consulte horários';
  return getCatalogStoreHoursLabel(store);
}

export function useCatalogStore() {
  return useCatalogStoreQuery();
}
